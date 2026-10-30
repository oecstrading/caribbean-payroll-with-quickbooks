import { useMemo, useState } from "react";
import { Bot, Download, FileSpreadsheet, Upload, CheckCircle2, AlertTriangle, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { NativeSelect } from "@/components/ui/native-select";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import { toast } from "sonner";
import { readWorkbook, type WorkbookSheet } from "@/lib/read-workbook";
import { parseSalarySheet, importQuestions, rulesFromAnswers, compareSheet, splitName, type ParsedSheet } from "@/lib/salary-sheet";
import { formatCurrency } from "@/lib/payroll-engine";
import { downloadFile } from "@/lib/download-file";

const TEMPLATE = "/templates/Payroll_Onboarding_Template_v1.xlsx";
const countryNames: Record<string, string> = { "saint lucia": "LC", "antigua and barbuda": "AG", "st kitts and nevis": "KN", dominica: "DM", grenada: "GD" };

export default function PayrollImportPage() {
  const { isAdmin, isAdminOrManager } = useRole();
  const [fileName, setFileName] = useState("");
  const [sheets, setSheets] = useState<WorkbookSheet[]>([]);
  const [sheetName, setSheetName] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState<{ created: number; skipped: string[] } | null>(null);

  const parsed = useMemo<ParsedSheet | null>(() => {
    const sheet = sheets.find(s => s.name === sheetName); if (!sheet) return null;
    try { setError(""); return parseSalarySheet(sheet.values, sheet.formulas); } catch (e) { setError(e instanceof Error ? e.message : "Couldn't read this sheet"); return null; }
  }, [sheets, sheetName]);
  const questions = useMemo(() => parsed ? importQuestions(parsed, answers.jurisdiction || "LC") : [], [parsed, answers.jurisdiction]);
  const answered = questions.filter(q => answers[q.id]).length;
  const complete = questions.length > 0 && answered === questions.length;
  const rules = rulesFromAnswers(answers);
  const comparison = useMemo(() => parsed && complete ? compareSheet(parsed, rules) : null, [parsed, complete, JSON.stringify(rules)]);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("Please upload a file under 10 MB"); return; }
    try {
      const book = readWorkbook(await file.arrayBuffer());
      const readable = book.filter(s => { try { parseSalarySheet(s.values, s.formulas); return true; } catch { return false; } });
      if (!readable.length) { setError("No payroll sheet found. The sheet needs NAME and BASIC salary columns."); setSheets([]); return; }
      const company = book.find(s => s.name === "Company");
      const country = company?.values.find(r => String(r[0] ?? "").trim() === "Country")?.[1];
      const code = countryNames[String(country ?? "").trim().toLowerCase()];
      setFileName(file.name); setSheets(readable); setSheetName((readable.find(s => s.name === "Payroll") || readable[0]).name);
      setAnswers(code ? { jurisdiction: code } : {}); setConfirmed(false); setImported(null);
    } catch { setError("This file couldn't be opened. Save it as .xlsx or .csv and try again."); }
  };

  const runImport = async () => {
    if (!parsed || !comparison || !isAdmin || !confirmed) return;
    setImporting(true);
    try {
      const { data: existing, error: readError } = await supabase.from("employee_records").select("first_name,last_name").is("deleted_at", null);
      if (readError) throw readError;
      const taken = new Set((existing || []).map(e => `${e.first_name} ${e.last_name}`.toLowerCase().trim()));
      const skipped: string[] = []; let created = 0;
      const month = new Date().toISOString().slice(0, 7);
      for (const { employee: e, pay } of comparison.rows) {
        const unpaid = e.basic === 0 && e.total === 0 && e.net === 0;
        if (unpaid && answers.unpaid === "skip") continue;
        const names = splitName(e.name);
        if (taken.has(`${names.first_name} ${names.last_name}`.toLowerCase())) { skipped.push(e.name); continue; }
        const idIsNic = answers.idMeaning !== "employee";
        const group = e.staffGroup || (e.group > 0 ? answers.groups || "Director" : "Staff");
        const fixedPaye = rules.payeMethod === "sheet" || /fixed/i.test(e.taxMethod);
        const hr_details = {
          pay_frequency: "Monthly", pay_rate: e.basic ? String(e.basic) : "", tax_code: e.taxCode.trim().toUpperCase(),
          paye_method: fixedPaye ? "Fixed amount" : "Calculated", paye_fixed_amount: fixedPaye ? String(pay.paye) : "",
          nic_basis: rules.nicBasis === "basic" || (rules.nicBasis === "as_sheet" && e.nicOnBasic) ? "Basic pay" : "Total pay",
          daily_rate_rule: rules.dailyRule === "as_sheet" && e.fixedDailyRate !== null ? "Fixed daily rate" : "Monthly × 12 ÷ 52 ÷ 5",
          fixed_daily_rate: rules.dailyRule === "as_sheet" && e.fixedDailyRate !== null ? String(pay.daily) : "",
          staff_group: group, notes: `Imported from ${fileName} (row ${e.row}).`,
        };
        const { data: record, error: insertError } = await supabase.from("employee_records").insert({
          ...names, email: "", department: e.department || answers.department || "Unassigned", jurisdiction: rules.jurisdiction,
          monthly_salary: e.basic, std_hours_per_day: 8, ot_rate: rules.otMultiplier,
          nic_number: idIsNic ? e.employeeId : "", person_id: e.employeeNumber || (idIsNic ? "" : e.employeeId),
          start_date: /^\d{4}-\d{2}-\d{2}/.test(e.hireDate) ? e.hireDate.slice(0, 10) : null,
          status: unpaid ? (answers.unpaid === "Active" ? "Active" : "Inactive") : "Active", hr_details,
        }).select("user_id").single();
        if (insertError) throw insertError;
        const allowances = [["Travel allowance", e.travel], ["Phone allowance", e.phone], ["On-call allowance", e.onCall], ["Commission", e.commission], ["Other allowance", e.otherAllowance]] as const;
        const rows = allowances.filter(([, amount]) => amount > 0).map(([description, amount]) => ({
          user_id: record.user_id, addition_type: (description === "Commission" ? "commission" : "allowance") as "commission" | "allowance",
          description, amount, frequency: answers.allowances === "once" ? "one-time" : "monthly", period: answers.allowances === "once" ? month : null,
        }));
        if (rows.length) { const { error: addError } = await supabase.from("employee_additions").insert(rows); if (addError) throw addError; }
        created++; taken.add(`${names.first_name} ${names.last_name}`.toLowerCase());
      }
      setImported({ created, skipped }); toast.success(`${created} employee folders created`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Import stopped. Nothing after the error was saved."); }
    finally { setImporting(false); }
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">
      <header className="rounded-2xl p-5 md:p-6 text-primary-foreground shadow-lg" style={{ background: "var(--gradient-hero, linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent))))" }}>
        <div className="flex items-start gap-3"><Bot className="shrink-0 mt-1" size={28} />
          <div><h1 className="text-2xl font-display font-bold">Payroll Import · AI Paymaster interview</h1>
            <p className="text-sm opacity-90 mt-1">Upload a customer's salary spreadsheet. The Paymaster reads it, asks only what it can't safely work out, rebuilds every payslip with the platform's rules and shows each difference before anything is saved.</p></div></div>
        <div className="flex flex-wrap gap-2 mt-4">
          <Button variant="secondary" className="min-h-11" onClick={() => downloadFile(TEMPLATE, "Payroll_Onboarding_Template_v1.xlsx")}><Download size={16} />Download blank template</Button>
          <label className="inline-flex items-center gap-2 min-h-11 px-4 rounded-md bg-background text-foreground font-medium cursor-pointer hover:opacity-90">
            <Upload size={16} />Upload salary sheet<input type="file" className="sr-only" accept=".xlsx,.xls,.csv" onChange={e => { onFile(e.target.files?.[0]); e.target.value = ""; }} /></label>
        </div>
      </header>

      {error && <p role="alert" className="text-destructive text-sm">{error}</p>}

      {parsed && <Card><CardHeader className="pb-2"><CardTitle className="text-lg flex items-center gap-2"><FileSpreadsheet size={18} />1 · What the Paymaster found</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-3 items-end">
            <p><strong>{fileName}</strong>{parsed.title ? ` · ${parsed.title}` : ""}</p>
            {sheets.length > 1 && <label className="space-y-1"><span className="block text-xs text-muted-foreground">Sheet</span><NativeSelect value={sheetName} onChange={e => { setSheetName(e.target.value); setAnswers({}); }}>{sheets.map(s => <option key={s.name}>{s.name}</option>)}</NativeSelect></label>}
          </div>
          <div className="flex flex-wrap gap-2"><Badge variant="secondary">{parsed.employees.length} employees</Badge><Badge variant="secondary">{Object.keys(parsed.columns).length} columns understood</Badge><Badge variant="secondary">{parsed.groups + (parsed.employees.some(e => e.group === parsed.groups) ? 1 : 0)} section(s)</Badge></div>
          <p className="text-muted-foreground">Columns read: {Object.keys(parsed.columns).join(", ")}</p>
        </CardContent></Card>}

      {parsed && <Card><CardHeader className="pb-2"><CardTitle className="text-lg flex items-center gap-2"><Bot size={18} />2 · Questions before the Paymaster uses this sheet</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1"><Progress value={questions.length ? answered / questions.length * 100 : 0} /><p className="text-xs text-muted-foreground">{answered} of {questions.length} answered{complete ? " · ready to check" : ""}</p></div>
          {questions.map((q, i) => <fieldset key={q.id} className="rounded-xl border border-border p-4 space-y-2">
            <legend className="px-1 text-sm font-semibold">{i + 1}. {q.question}</legend>
            <p className="text-xs text-muted-foreground">{q.detail}</p>
            <div className="flex flex-wrap gap-2">{q.options.map(o => <Button key={o.value} type="button" size="sm" className="min-h-11" variant={answers[q.id] === o.value ? "default" : "outline"} onClick={() => setAnswers(a => ({ ...a, [q.id]: o.value }))}>{o.label}{o.value === q.recommended ? " (suggested)" : ""}</Button>)}</div>
          </fieldset>)}
          {!complete && questions.length > 0 && <Button variant="secondary" onClick={() => setAnswers(a => Object.fromEntries(questions.map(q => [q.id, a[q.id] || q.recommended])))}>Use the suggested answers for the rest</Button>}
        </CardContent></Card>}

      {comparison && parsed && <Card><CardHeader className="pb-2"><CardTitle className="text-lg flex items-center gap-2"><CheckCircle2 size={18} />3 · Platform payroll vs. the spreadsheet</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            {[["Sheet gross", comparison.totals.sheetGross], ["Platform gross", comparison.totals.platformGross], ["Sheet net", comparison.totals.sheetNet], ["Platform net", comparison.totals.platformNet]].map(([l, v]) => <div key={l} className="rounded-xl bg-muted p-3"><p className="text-xs text-muted-foreground">{l}</p><p className="font-bold text-base">{formatCurrency(Number(v))}</p></div>)}
          </div>
          <p className="text-sm">{comparison.rows.length - new Set(comparison.differences.map(d => d.name)).size} of {comparison.rows.length} employees match the sheet to the cent. {comparison.differences.length ? `${new Set(comparison.differences.map(d => d.name)).size} differ:` : "No differences."}</p>
          {comparison.differences.length > 0 && <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left border-b border-border"><th className="py-2 pr-3">Employee</th><th className="pr-3">Item</th><th className="pr-3 text-right">Sheet</th><th className="pr-3 text-right">Platform</th><th className="pr-3 text-right">Difference</th><th>Why</th></tr></thead>
            <tbody>{comparison.differences.map((d, i) => <tr key={i} className="border-b border-border/60"><td className="py-2 pr-3">{d.name} <span className="text-xs text-muted-foreground">row {d.row}</span></td><td className="pr-3">{d.field}</td><td className="pr-3 text-right">{formatCurrency(d.sheet)}</td><td className="pr-3 text-right">{formatCurrency(d.platform)}</td><td className="pr-3 text-right font-medium">{formatCurrency(d.difference)}</td><td className="text-xs">{d.reason}</td></tr>)}</tbody></table></div>}
          <details><summary className="cursor-pointer text-sm font-medium">See every employee</summary>
            <div className="overflow-x-auto mt-2"><table className="w-full text-xs"><thead><tr className="text-left border-b border-border"><th className="py-1 pr-2">Name</th><th className="pr-2 text-right">Basic</th><th className="pr-2 text-right">Days</th><th className="pr-2 text-right">Overtime</th><th className="pr-2 text-right">Allowances</th><th className="pr-2 text-right">Gross</th><th className="pr-2 text-right">NIC</th><th className="pr-2 text-right">PAYE</th><th className="pr-2 text-right">Net</th><th className="text-right">Sheet net</th></tr></thead>
              <tbody>{comparison.rows.map(({ employee: e, pay: p }) => <tr key={e.row} className="border-b border-border/40"><td className="py-1 pr-2">{e.name}</td><td className="pr-2 text-right">{e.basic.toFixed(2)}</td><td className="pr-2 text-right">{p.dayAdjustment.toFixed(2)}</td><td className="pr-2 text-right">{p.overtime.toFixed(2)}</td><td className="pr-2 text-right">{p.allowances.toFixed(2)}</td><td className="pr-2 text-right">{p.gross.toFixed(2)}</td><td className="pr-2 text-right">{p.nic.toFixed(2)}</td><td className="pr-2 text-right">{p.paye.toFixed(2)}</td><td className="pr-2 text-right font-medium">{p.net.toFixed(2)}</td><td className="text-right">{e.net.toFixed(2)}</td></tr>)}</tbody></table></div>
          </details>
        </CardContent></Card>}

      {comparison && <Card><CardHeader className="pb-2"><CardTitle className="text-lg flex items-center gap-2"><Users size={18} />4 · Approve the import</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>Creates one employee folder per person with salary, tax code, PAYE method, NIC basis, staff group and recurring allowances. Existing employees with the same name are skipped. No payroll is run or saved; you still run and approve payroll on the Payroll page.</p>
          {!isAdmin ? <p className="flex items-center gap-2 text-muted-foreground"><AlertTriangle size={16} />{isAdminOrManager ? "Only an administrator can approve the import." : "Administrator access required."}</p> : imported ? <p className="font-medium">{imported.created} folders created.{imported.skipped.length ? ` Skipped (already exist): ${imported.skipped.join(", ")}.` : ""}</p> : <>
            <label className="flex items-center gap-2 min-h-11 cursor-pointer"><Checkbox checked={confirmed} onCheckedChange={c => setConfirmed(c === true)} />I've reviewed the answers and the differences above.</label>
            <Button className="min-h-11" disabled={!confirmed || importing} onClick={runImport}>{importing ? "Importing…" : `Import ${comparison.rows.filter(r => !(answers.unpaid === "skip" && r.employee.basic === 0 && r.employee.total === 0 && r.employee.net === 0)).length} employees`}</Button></>}
        </CardContent></Card>}
    </div>
  );
}
