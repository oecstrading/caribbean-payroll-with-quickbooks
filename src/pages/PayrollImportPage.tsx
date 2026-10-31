import { useMemo, useState } from "react";
import { Bot, Download, FileSpreadsheet, Upload, CheckCircle2, AlertTriangle, Users, Building2, HandCoins, Landmark, Tags } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/checkbox";
import { NativeSelect } from "@/components/ui/native-select";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import { toast } from "sonner";
import { readWorkbook, type WorkbookSheet } from "@/lib/read-workbook";
import { parseSalarySheet, importQuestions, rulesFromAnswers, compareSheet, splitName, type ParsedSheet, type PlatformPay, type SheetEmployee } from "@/lib/salary-sheet";
import { formatCurrency } from "@/lib/payroll-engine";
import { downloadFile } from "@/lib/download-file";
import { folderUpdate, type EmployeeForm } from "@/lib/employee-folder";
import { readOnboarding, countryToJurisdiction, TEMPLATE_FILE, TEMPLATE_NAME, type OnboardingBundle, type OnboardingEmployee } from "@/lib/onboarding-sheet";

const key = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");

interface ImportSummary {
  created: number; skipped: string[]; allowances: number; deductions: number; loans: number; accounts: number;
  company: string;
}

export default function PayrollImportPage() {
  const { isAdmin, isAdminOrManager } = useRole();
  const [fileName, setFileName] = useState("");
  const [book, setBook] = useState<WorkbookSheet[]>([]);
  const [sheetName, setSheetName] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState<ImportSummary | null>(null);

  const payrollSheets = useMemo(() => book.filter(s => { try { parseSalarySheet(s.values, s.formulas); return true; } catch { return false; } }), [book]);
  const onboarding = useMemo<OnboardingBundle | null>(() => book.length ? readOnboarding(book) : null, [book]);
  const parsed = useMemo<ParsedSheet | null>(() => {
    const sheet = payrollSheets.find(s => s.name === sheetName); if (!sheet) return null;
    try { setError(""); return parseSalarySheet(sheet.values, sheet.formulas); } catch (e) { setError(e instanceof Error ? e.message : "Couldn't read this sheet"); return null; }
  }, [payrollSheets, sheetName]);
  const questions = useMemo(() => parsed ? importQuestions(parsed, answers.jurisdiction || "LC") : [], [parsed, answers.jurisdiction]);
  const answered = questions.filter(q => answers[q.id]).length;
  const complete = questions.length > 0 && answered === questions.length;
  const rules = rulesFromAnswers(answers);
  const comparison = useMemo(() => parsed && complete ? compareSheet(parsed, rules) : null, [parsed, complete, JSON.stringify(rules)]);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("Please upload a file under 10 MB"); return; }
    try {
      const sheets = readWorkbook(await file.arrayBuffer());
      const readable = sheets.filter(s => { try { parseSalarySheet(s.values, s.formulas); return true; } catch { return false; } });
      const hasEmployees = readOnboarding(sheets).employees.length > 0;
      if (!readable.length && !hasEmployees) { setError("No payroll or employee sheet found. The file needs a NAME and BASIC salary column, or a FIRST NAME column."); setBook([]); return; }
      const company = sheets.find(s => s.name === "Company");
      const country = company?.values.find(r => String(r[0] ?? "").trim() === "Country")?.[1];
      const code = countryToJurisdiction(String(country ?? ""));
      setFileName(file.name); setBook(sheets);
      setSheetName((readable.find(s => s.name === "Payroll") || readable[0])?.name || "");
      setAnswers(code ? { jurisdiction: code } : {}); setConfirmed(false); setImported(null);
    } catch { setError("This file couldn't be opened. Save it as .xlsx or .csv and try again."); }
  };

  const runImport = async () => {
    if (!onboarding || !parsed || !comparison || !isAdmin || !confirmed) return;
    setImporting(true);
    try {
      const month = new Date().toISOString().slice(0, 7);
      const { data: existing, error: readError } = await supabase.from("employee_records").select("first_name,last_name").is("deleted_at", null);
      if (readError) throw readError;
      const taken = new Set((existing || []).map(e => `${e.first_name} ${e.last_name}`.toLowerCase().trim()));
      const skipped: string[] = [];
      const creditorIds = new Map<string, string>();
      const creditorId = async (name: string) => {
        const k = key(name);
        if (creditorIds.has(k)) return creditorIds.get(k)!;
        const { data: found } = await supabase.from("creditors").select("id").ilike("name", name).maybeSingle();
        const id = found?.id || (await supabase.from("creditors").insert({ name, type: "other" }).select("id").single()).data?.id;
        if (!id) throw new Error(`Couldn't set up the creditor "${name}".`);
        creditorIds.set(k, id);
        return id;
      };

      if (onboarding.company.company_name) {
        const { data: settings } = await supabase.from("company_settings").select("id").limit(1).maybeSingle();
        const values = {
          company_name: onboarding.company.company_name, employer_nic_number: onboarding.company.employer_nic_number,
          tax_id: onboarding.company.tax_id, vat_number: onboarding.company.vat_number, telephone: onboarding.company.telephone,
          website: onboarding.company.website, address: onboarding.company.address,
        };
        const write = settings?.id
          ? supabase.from("company_settings").update({ ...values, updated_at: new Date().toISOString() }).eq("id", settings.id)
          : supabase.from("company_settings").insert(values);
        const { error: settingsError } = await write;
        if (settingsError) throw settingsError;
      }

      const byName = new Map<string, { employee: SheetEmployee; pay: PlatformPay }>();
      comparison.rows.forEach(r => byName.set(key(r.employee.name), r));
      const departmentCodes = new Map(onboarding.departments.map(d => [key(d.department), d.cost_centre]));
      const employeeRows: { values: EmployeeForm; source: OnboardingEmployee | null }[] = [
        ...onboarding.employees.map(e => ({ values: e.values, source: e })),
        ...comparison.rows
          .filter(r => !onboarding.employees.some(e => key(e.name) === key(r.employee.name)))
          .map(r => ({ values: valuesFromPayroll(r.employee, r.pay, rules.payeMethod, rules.dailyRule, rules.nicBasis, answers.groups || "Director", fileName), source: null })),
      ];

      let created = 0, allowances = 0, deductions = 0, loans = 0;
      for (const { values, source } of employeeRows) {
        const name = `${values.first_name} ${values.last_name}`.trim();
        const row = byName.get(key(name));
        const unpaid = row ? row.employee.basic === 0 && row.employee.total === 0 && row.employee.net === 0 : false;
        if (unpaid && answers.unpaid === "skip") continue;
        if (taken.has(key(name))) { skipped.push(name); continue; }
        const folder: EmployeeForm = {
          ...values,
          jurisdiction: answers.jurisdiction || onboarding.company.jurisdiction || values.jurisdiction,
          cost_centre_code: values.cost_centre_code || departmentCodes.get(key(values.department)) || "",
          monthly_salary: values.pay_frequency && values.pay_rate ? values.monthly_salary : (row?.employee.basic || values.monthly_salary),
          status: values.status || (unpaid ? (answers.unpaid === "Active" ? "Active" : "Inactive") : "Active"),
          notes: values.notes || (row ? `Imported from ${fileName} (row ${row.employee.row}).` : ""),
        };
        const { data: record, error: insertError } = await supabase.from("employee_records").insert({
          ...folderUpdate(folder), email: folder.email,
        }).select("user_id").single();
        if (insertError) throw insertError;
        taken.add(key(name)); created++;

        const sheetEntries = onboarding.entries.filter(e => key(e.name) === key(name));
        if (sheetEntries.length) {
          for (const entry of sheetEntries) {
            if (entry.kind === "allowance") {
              const { error:addError } = await supabase.from("employee_additions").insert({
                user_id: record.user_id, addition_type: /commission/i.test(entry.description) ? "commission" : "allowance",
                description: entry.description, amount: entry.amount,
                frequency: entry.recurring ? "monthly" : "one-time", period: entry.recurring ? null : month,
              });
              if (addError) throw addError;
              allowances++;
            } else {
              const { error: dError } = await supabase.from("employee_deductions").insert({
                user_id: record.user_id, creditor_id: await creditorId(entry.creditor || entry.description),
                amount: entry.amount, frequency: entry.recurring ? "monthly" : "one-time",
              });
              if (dError) throw dError;
              deductions++;
            }
          }
        } else if (row) {
          const derived = [["Travel allowance", row.employee.travel], ["Phone allowance", row.employee.phone], ["On-call allowance", row.employee.onCall], ["Commission", row.employee.commission], ["Other allowance", row.employee.otherAllowance]] as const;
          const rows = derived.filter(([, amount]) => amount > 0).map(([description, amount]) => ({
            user_id: record.user_id, addition_type: (description === "Commission" ? "commission" : "allowance") as "commission" | "allowance",
            description, amount, frequency: answers.allowances === "once" ? "one-time" : "monthly", period: answers.allowances === "once" ? month : null,
          }));
          if (rows.length) { const { error: addError } = await supabase.from("employee_additions").insert(rows); if (addError) throw addError; allowances += rows.length; }
        }

        for (const loan of onboarding.loans.filter(l => key(l.name) === key(name))) {
          const { error: loanError } = await supabase.rpc("create_employee_loan", {
            _employee: record.user_id, _creditor: await creditorId(loan.creditor), _original: loan.original,
            _balance: loan.balance, _monthly: loan.monthly, _notes: loan.notes,
          });
          if (loanError) throw loanError;
          loans++;
        }
      }

      let accounts = 0;
      for (const account of onboarding.accounts) {
        const { data: existingMapping } = await supabase.from("qbo_account_mappings").select("id").eq("payroll_item", account.payroll_item).maybeSingle();
        const payload = { qbo_account_id: account.code, qbo_account_name: account.name, account_type: account.type };
        const write = existingMapping?.id
          ? supabase.from("qbo_account_mappings").update(payload).eq("id", existingMapping.id)
          : supabase.from("qbo_account_mappings").insert({ payroll_item: account.payroll_item, ...payload });
        const { error: mapError } = await write;
        if (mapError) throw mapError;
        accounts++;
      }

      setImported({ created, skipped, allowances, deductions, loans, accounts, company: onboarding.company.company_name });
      toast.success(`${created} employee folders created`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Import stopped. Nothing after the error was saved."); }
    finally { setImporting(false); }
  };

  const employeeCount = (onboarding?.employees.length || 0) + (comparison?.rows.filter(r => !onboarding?.employees.some(e => key(e.name) === key(r.employee.name))).length || 0);
  const tiles = onboarding ? [
    { icon: Building2, label: "Company", value: onboarding.company.company_name || "not filled in", note: onboarding.company.country || "" },
    { icon: Users, label: "Employee folders", value: String(employeeCount), note: `${onboarding.employees.length} on the Employees sheet` },
    { icon: Landmark, label: "Allowances & deductions", value: String(onboarding.entries.length), note: `${onboarding.entries.filter(e => e.kind === "deduction").length} deductions` },
    { icon: HandCoins, label: "Loans & balances", value: String(onboarding.loans.length), note: `${onboarding.loans.filter(l => l.balance > 0).length} still owed` },
    { icon: Tags, label: "Account codes", value: String(onboarding.accounts.length), note: `${onboarding.departments.length} departments` },
  ] : [];

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">
      <header className="rounded-2xl p-5 md:p-6 text-primary-foreground shadow-lg" style={{ background: "var(--gradient-hero, linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent))))" }}>
        <div className="flex items-start gap-3"><Bot className="shrink-0 mt-1" size={28} />
          <div><h1 className="text-2xl font-display font-bold">Payroll Import · AI Paymaster interview</h1>
            <p className="text-sm opacity-90 mt-1">Upload a customer's salary spreadsheet or the onboarding template. The Paymaster reads every sheet, asks only what it can't safely work out, rebuilds each payslip with the platform's rules and shows every difference before anything is saved.</p></div></div>
        <div className="flex flex-wrap gap-2 mt-4">
          <Button variant="secondary" className="min-h-11" onClick={() => downloadFile(TEMPLATE_FILE, TEMPLATE_NAME)}><Download size={16} />Download blank template</Button>
          <label className="inline-flex items-center gap-2 min-h-11 px-4 rounded-md bg-background text-foreground font-medium cursor-pointer hover:opacity-90">
            <Upload size={16} />Upload salary sheet<input type="file" className="sr-only" accept=".xlsx,.xls,.csv" onChange={e => { onFile(e.target.files?.[0]); e.target.value = ""; }} /></label>
        </div>
      </header>

      {error && <p role="alert" className="text-destructive text-sm">{error}</p>}

      {onboarding && onboarding.company.missing.length > 0 && <p className="text-sm text-muted-foreground">Still needed from the Company sheet: {onboarding.company.missing.join(", ")}.</p>}

      {onboarding && <Card><CardHeader className="pb-2"><CardTitle className="text-lg flex items-center gap-2"><FileSpreadsheet size={18} />1 · What the Paymaster found</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {tiles.map(({ icon: Icon, label, value, note }) => <div key={label} className="rounded-xl bg-muted p-3">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Icon size={12} />{label}</p>
              <p className="font-bold text-base truncate" title={value}>{value}</p>
              {note && <p className="text-xs text-muted-foreground truncate">{note}</p>}
            </div>)}
          </div>
          {parsed && <div className="flex flex-wrap gap-2 items-end">
            <p><strong>{fileName}</strong>{parsed.title ? ` · ${parsed.title}` : ""}</p>
            {payrollSheets.length > 1 && <label className="space-y-1"><span className="block text-xs text-muted-foreground">Payroll sheet</span><NativeSelect value={sheetName} onChange={e => { setSheetName(e.target.value); setAnswers({}); }}>{payrollSheets.map(s => <option key={s.name}>{s.name}</option>)}</NativeSelect></label>}
            <Badge variant="secondary">{parsed.employees.length} payroll rows</Badge>
            <Badge variant="secondary">{Object.keys(parsed.columns).length} columns understood</Badge>
          </div>}
          {onboarding.employees.some(e => e.issues.length) && <div className="rounded-xl border border-destructive/40 p-3 text-destructive">
            <p className="font-medium">Fix these before importing:</p>
            <ul className="list-disc pl-5 text-xs">{onboarding.employees.filter(e => e.issues.length).map(e => <li key={e.name}>{e.name}: {e.issues.join("; ")}</li>)}</ul>
          </div>}
          {onboarding.problems.length > 0 && <div className="rounded-xl border border-amber-500/50 p-3">
            <p className="font-medium flex items-center gap-2"><AlertTriangle size={14} />Points to check</p>
            <ul className="list-disc pl-5 text-xs">{onboarding.problems.slice(0, 12).map((p, i) => <li key={i}>{p}</li>)}</ul>
            {onboarding.problems.length > 12 && <p className="text-xs text-muted-foreground">…and {onboarding.problems.length - 12} more.</p>}
          </div>}
          {onboarding.company.quickbooks && <p className="text-xs text-muted-foreground">This sheet asks for QuickBooks sync. The account codes below are saved to the mapping screen; connect the account itself under QuickBooks.</p>}
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
              <tbody>{comparison.rows.map(({ employee: e, pay: p }) => <tr key={e.row} className="border-b border-border/40"><td className="py-1 pr-2">{e.name}</td><td className="py-1 pr-2 text-right">{e.basic.toFixed(2)}</td><td className="pr-2 text-right">{p.dayAdjustment.toFixed(2)}</td><td className="pr-2 text-right">{p.overtime.toFixed(2)}</td><td className="pr-2 text-right">{p.allowances.toFixed(2)}</td><td className="pr-2 text-right">{p.gross.toFixed(2)}</td><td className="pr-2 text-right">{p.nic.toFixed(2)}</td><td className="pr-2 text-right">{p.paye.toFixed(2)}</td><td className="pr-2 text-right font-medium">{p.net.toFixed(2)}</td><td className="text-right">{e.net.toFixed(2)}</td></tr>)}</tbody></table></div>
          </details>
        </CardContent></Card>}

      {onboarding && <Card><CardHeader className="pb-2"><CardTitle className="text-lg flex items-center gap-2"><Users size={18} />4 · Approve the import</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>Creates {employeeCount} employee folders with the full HR profile, pay basis and bank details from the Employees sheet, plus {onboarding.entries.filter(e => e.kind === "allowance").length} allowances, {onboarding.entries.filter(e => e.kind === "deduction").length} deductions, {onboarding.loans.length} loan balances and {onboarding.accounts.length} QuickBooks account codes. {onboarding.company.company_name ? `Company details are saved for ${onboarding.company.company_name}. ` : ""}Existing employees with the same name are skipped. No payroll is run or saved; you still run and approve payroll on the Payroll page.</p>
          {!isAdmin ? <p className="flex items-center gap-2 text-muted-foreground"><AlertTriangle size={16} />{isAdminOrManager ? "Only an administrator can approve the import." : "Administrator access required."}</p> : imported ? <p className="font-medium">{imported.created} folders created · {imported.allowances} allowances · {imported.deductions} deductions · {imported.loans} loans · {imported.accounts} account codes.{imported.skipped.length ? ` Skipped (already exist): ${imported.skipped.join(", ")}.` : ""}</p> : <>
            <label className="flex items-start gap-2 min-h-11 cursor-pointer"><Checkbox checked={confirmed} onCheckedChange={c => setConfirmed(c === true)} /><span>I've reviewed the answers, the differences and the points to check above.</span></label>
            <Button className="min-h-11" disabled={!confirmed || importing} onClick={runImport}>{importing ? "Importing…" : `Import ${employeeCount} employees`}</Button></>}
        </CardContent></Card>}
    </div>
  );
}

/** Build an employee folder from a payroll row when the file has no Employees sheet for that person. */
function valuesFromPayroll(e: SheetEmployee, pay: PlatformPay, payeMethod: string, dailyRule: string, nicBasis: string, groupAnswer: string, fileName: string): EmployeeForm {
  const { first_name, last_name } = splitName(e.name);
  const fixedPaye = payeMethod === "sheet" || /fixed/i.test(e.taxMethod);
  const group = e.staffGroup || (e.group > 0 ? groupAnswer : "Staff");
  return {
    first_name, last_name, email: "", phone: "", person_id: e.employeeNumber, department: e.department, job_title: "",
    nic_number: e.employeeId, tan_number: "", start_date: /^\d{4}-\d{2}-\d{2}/.test(e.hireDate) ? e.hireDate.slice(0, 10) : "",
    schedule: "", jurisdiction: "LC", monthly_salary: e.basic, std_hours_per_day: 8, ot_rate: 1.5, status: "Active",
    date_of_birth: "", gender: "", marital_status: "", nationality: "", address: "", city: "", country: "", personal_email: "",
    emergency_name: "", emergency_relationship: "", emergency_phone: "", employment_type: "", work_location: "", supervisor: "",
    probation_end: "", contract_end: "", termination_date: "", termination_reason: "", pay_frequency: "Monthly",
    pay_rate: e.basic ? String(e.basic) : "", weekly_hours: "", notes: `Imported from ${fileName} (row ${e.row}).`,
    tax_code: e.taxCode.trim().toUpperCase(), paye_method: fixedPaye ? "Fixed amount" : "Calculated",
    paye_fixed_amount: fixedPaye ? String(pay.paye) : "",
    nic_basis: nicBasis === "basic" || (nicBasis === "as_sheet" && e.nicOnBasic) ? "Basic pay" : "Total pay",
    daily_rate_rule: dailyRule === "as_sheet" && e.fixedDailyRate !== null ? "Fixed daily rate" : "Monthly × 12 ÷ 52 ÷ 5",
    fixed_daily_rate: dailyRule === "as_sheet" && e.fixedDailyRate !== null ? String(pay.daily) : "",
    staff_group: group, cost_centre_code: "", bank_name: "", bank_branch: "", bank_account_number: "", bank_account_type: "",
  };
}
