import { payrollOptions } from "@/lib/employee-folder";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { clearPayrollDraft, hasDraftWork, loadPayrollDraft, savePayrollDraft } from "@/lib/payroll-draft";
import { motion } from "framer-motion";
import { CheckCircle, ArrowRight, DollarSign, FileText, AlertCircle, Receipt, Mail, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { sampleEmployees } from "@/lib/sample-data";
import { calculatePayroll, formatCurrency, checkMinimumWageCompliance } from "@/lib/payroll-engine";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRole } from "@/hooks/useRole";
import { getConfigByJurisdiction, OECS_CONFIGS } from "@/lib/payroll-engine";
import { departmentName, reportRow, selectDepartments } from "@/lib/department-payroll";
import DepartmentSelector from "@/components/DepartmentSelector";
import DepartmentPayrollReport from "@/components/DepartmentPayrollReport";
import type { Employee } from "@/lib/sample-data";
import { NativeSelect } from "@/components/ui/native-select";
import { Checkbox } from "@/components/ui/checkbox";
import { calculatePeriodPayroll, defaultRange, periodFactor, periodLabel, payTypeLabels, workingDays, type PayType } from "@/lib/pay-period";
import PayrollOfficer from "@/components/PayrollOfficer";
import { anonymousReviewRows } from "@/lib/payroll-review";
import { loanDeduction } from "@/lib/employee-loans";
import { attendanceEarnings, type PayHours } from "@/lib/workforce-time";
import { manualEarnings, type ManualHours } from "@/lib/manual-hours";
import { computeEdited, linesFromResult, serverLines, type PayEdit } from "@/lib/pay-edits";
import PayEditDialog from "@/components/PayEditDialog";
import RecurringReview from "@/components/RecurringReview";
import { isRecurringFrequency, periodAmount, type RecurringDecision, type RecurringItem } from "@/lib/recurring-items";
import { Pencil } from "lucide-react";

const steps = ["Review & Sync", "Audit", "Approve & Run"];

export default function PayrollPage() {
  const [ready, setReady] = useState(false);
  useEffect(() => { void syncSharedPayrollDraft().finally(() => setReady(true)); }, []);
  if (!ready) return <div className="p-6 text-sm text-muted-foreground">Loading the company's payroll…</div>;
  return <RunPayroll />;
}

function RunPayroll() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [draft] = useState(() => loadPayrollDraft());
  const restoring = useRef({ step: Boolean(draft), edits: Boolean(draft), selected: draft?.selected ?? null });
  const [restoredAt, setRestoredAt] = useState<string | null>(draft?.savedAt ?? null);
  const [currentStep, setCurrentStep] = useState(draft?.currentStep ?? 0);
  const bulkEmailing = false;
  const [processing, setProcessing] = useState(false);
  const [approved, setApproved] = useState(false);
  const [source, setSource] = useState("live");
  const [payType, setPayType] = useState<PayType>(draft?.payType ?? "monthly");
  const [range, setRange] = useState(() => draft?.range ?? defaultRange("monthly", new Date().toISOString().slice(0, 10)));
  const [excluded, setExcluded] = useState<string[]>(draft?.excluded ?? []);
  const [notes, setNotes] = useState(draft?.notes ?? "");
  let factor = 0; let periodError = "";
  try { factor = periodFactor(payType, range.start, range.end); } catch (e) { periodError = (e as Error).message; }
  const period = periodLabel(payType, range.start, range.end);
  const startMonth = range.start.slice(0, 7);
  const changePayType = (t: PayType) => { setPayType(t); setRange(defaultRange(t, range.start)); setExcluded([]); };
  const [jurisdiction, setJurisdiction] = useState(draft?.jurisdiction ?? "LC");
  const [liveEmployees, setLiveEmployees] = useState<Employee[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [deductionsMap, setDeductionsMap] = useState<Record<string, (import("@/lib/payroll-engine").CreditorDeduction & { key: string })[]>>({});
  const [additionsMap, setAdditionsMap] = useState<Record<string, (import("@/lib/payroll-engine").PayrollAddition & { key: string })[]>>({});
  const [recurring, setRecurring] = useState<RecurringItem[]>([]);
  const [decisions, setDecisions] = useState<Record<string, RecurringDecision>>(draft?.decisions ?? {});
  const [loans, setLoans] = useState<{ user_id: string; balance: number; monthly_repayment: number }[]>([]);
  const [attendance, setAttendance] = useState<Record<string, PayHours>>({});
  const [manualMode, setManualMode] = useState(draft?.manualMode ?? false);
  const [manualHours, setManualHours] = useState<Record<string, ManualHours>>(draft?.manualHours ?? {});
  const [edits, setEdits] = useState<Record<string, PayEdit>>(draft?.edits ?? {});
  const [editing, setEditing] = useState<string | null>(null);
  const [payBases, setPayBases] = useState<Record<string, { basis: string; rate: number; options: ReturnType<typeof payrollOptions> }>>({});
  const { isAdminOrManager, demoMode } = useRole();
  const config = getConfigByJurisdiction(source === "sample" ? "LC" : jurisdiction);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setLoadError("");
    const load = async () => {
      const [profiles, deductions, additions, records, loanRows] = await Promise.all([
        supabase.from("profiles").select("*").eq("is_employee", true).is("deleted_at", null).eq("jurisdiction", jurisdiction),
        supabase.from("employee_deductions").select("*, creditors(name)").eq("is_active", true),
        supabase.from("employee_additions").select("*").eq("is_active", true),
        supabase.from("employee_records").select("*").is("deleted_at", null).eq("jurisdiction", jurisdiction),
        supabase.from("employee_loans").select("user_id,balance,monthly_repayment").eq("is_active", true).gt("balance", 0),
      ]);
      if (profiles.error || deductions.error || additions.error || records.error || loanRows.error) throw profiles.error || deductions.error || additions.error || records.error || loanRows.error;
      if (cancelled) return;
      setLoans(loanRows.data || []);
      const directory = [...(profiles.data || []), ...(records.data || [])].filter(p => p.status.toLowerCase() === "active");
      const hours = await Promise.all(directory.map(async p => {
        const result = await supabase.rpc("workforce_pay_hours", { _employee: p.user_id, _start: range.start, _end: range.end });
        if (result.error) throw result.error;
        return [p.user_id, result.data as unknown as PayHours] as const;
      }));
      if (cancelled) return;
      setAttendance(Object.fromEntries(hours));
      setPayBases(Object.fromEntries(directory.map(p => { const hr = p.hr_details as Record<string, string>; return [p.user_id, { basis: hr.pay_frequency || "", rate: Number(hr.pay_rate || 0), options: payrollOptions(hr) }]; })));
      setLiveEmployees([...(profiles.data || []), ...(records.data || [])].filter(p => p.status.toLowerCase() === "active").map(p => ({
        id: p.user_id, firstName: p.first_name, lastName: p.last_name, department: departmentName(p.department),
        monthlySalary: Number(p.monthly_salary || 0), stdHoursPerDay: Number(p.std_hours_per_day || 8),
        nicNumber: p.nic_number || "", personId: p.person_id || "", jobTitle: p.job_title || "", email: p.email,
        phone: p.phone || "", startDate: p.start_date || "", schedule: p.schedule || "", otRate: p.ot_rate || 1.5,
        status: "Active", tanNumber: p.tan_number || "",
      })));
      const dm: typeof deductionsMap = {}; const am: typeof additionsMap = {}; const rec: RecurringItem[] = [];
      for (const d of deductions.data || []) {
        if ((d.start_date && d.start_date > range.end) || (d.end_date && d.end_date < range.start)) continue;
        (dm[d.user_id] ||= []).push({ creditorName: d.creditors?.name || "Creditor", amount: Number(d.amount), key: `d:${d.id}` });
        rec.push({ key: `d:${d.id}`, userId: d.user_id, kind: "deduction", name: d.creditors?.name || "Deduction", amount: Number(d.amount), frequency: d.frequency });
      }
      for (const a of additions.data || []) {
        if (a.period && a.period !== startMonth) continue;
        if ((a.start_date && a.start_date > range.end) || (a.end_date && a.end_date < range.start)) continue;
        (am[a.user_id] ||= []).push({ type: a.addition_type, description: a.description || a.addition_type, amount: Number(a.amount), key: `a:${a.id}` });
        if (isRecurringFrequency(a.frequency)) rec.push({ key: `a:${a.id}`, userId: a.user_id, kind: "addition", name: a.description || a.addition_type.replace("_", " "), amount: Number(a.amount), frequency: a.frequency });
      }
      setDeductionsMap(dm); setAdditionsMap(am); setRecurring(rec);
    };
    load().catch(e => { if (!cancelled) setLoadError(e.message || "Unable to load employees"); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [jurisdiction, range.start, range.end]);
  const employees = source === "sample" ? sampleEmployees.filter(e => e.status === "Active") : liveEmployees;
  const departments = [...new Set(employees.map(e => departmentName(e.department)))].sort();
  const departmentKey = departments.join("\u0000");
  useEffect(() => {
    const keep = restoring.current.selected;
    if (keep && source === "live" && departments.length) { restoring.current.selected = null; setSelected(departments.filter(d => keep.includes(d))); return; }
    if (keep && source === "live") return;
    setSelected(departments);
  }, [departmentKey, source]);
  useEffect(() => { if (restoring.current.step) return; setApproved(false); setCurrentStep(0); }, [source, period, jurisdiction, selected, excluded, manualMode, manualHours, edits]);
  useEffect(() => { if (restoring.current.edits) { restoring.current.edits = false; return; } setEdits({}); setDecisions({}); }, [source, range.start, range.end, jurisdiction]);
  // Release the step lock once the restored departments are in place.
  useEffect(() => { if (restoring.current.step && !restoring.current.selected) { const t = setTimeout(() => { restoring.current.step = false; }, 0); return () => clearTimeout(t); } }, [selected]);
  // Autosave every change to the unapproved payroll so leaving the page never loses work.
  const draftWork = { manualMode, manualHours, edits, notes, decisions };
  const dirty = source === "live" && !approved && hasDraftWork(draftWork);
  useEffect(() => {
    if (source !== "live" || approved || loading) return;
    if (!hasDraftWork(draftWork)) return;
    savePayrollDraft({ userId: user?.id ?? null, savedAt: new Date().toISOString(), currentStep, payType, range, excluded, notes, jurisdiction, selected, manualMode, manualHours, edits, decisions });
  }, [source, approved, loading, currentStep, payType, range, excluded, notes, jurisdiction, selected, manualMode, manualHours, edits, decisions, user?.id]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (ev: BeforeUnloadEvent) => { ev.preventDefault(); ev.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const discardDraft = () => { clearPayrollDraft(); window.location.reload(); };
  const handleBulkEmail = () => toast.info("Use saved payslips for email delivery.");
  const handleApprovePayroll = async () => {
    if (!payrollData.length || !selected.length || !isAdminOrManager || periodError || attendanceBlocked || negativeNet.length) return;
    if (recurringPending.length) { toast.error(`Review ${recurringPending.length} recurring item(s) first: keep, edit or zero each one.`); return; }
    if (source === "sample") { setApproved(true); toast.success("Sample completed; no live payroll saved."); return; }
    setProcessing(true);
    const { data: runId, error } = await supabase.rpc("approve_payroll_run", {
      _pay_type: payType, _start: range.start, _end: range.end, _notes: ([notes, manualMode ? "Hours entered manually" : "", Object.keys(edits).length ? `Pay edited for ${Object.keys(edits).length} employee(s)` : ""].filter(Boolean).join(" · ") || (manualMode ? [notes, "Hours entered manually"].filter(Boolean).join(" · ") : notes)) || undefined, _jurisdiction: jurisdiction, _departments: selected,
      _rows: payrollData.map(e => ({ user_id: e.id, department: e.department, basic_pay: e.payroll.basicPay,
        overtime_pay: e.payroll.overtimePay, gross_pay: e.payroll.grossMonthly, employee_nic: e.payroll.employeeNIC,
        employer_nic: e.payroll.employerNIC, paye: e.payroll.paye, total_deductions: e.payroll.totalDeductions, net_pay: e.payroll.netPay, loan_deductions: e.edited ? Math.round(e.edited.lines.filter(l => l.label === "Employee loan repayment" && l.kind === "deduction").reduce((t, l) => t + (l.amount || 0), 0) * 100) / 100 : e.loanDeductions,
        ...(e.edited ? { pay_lines: serverLines(e.edited) } : {}),
        ...(!e.edited && e.manual ? { manual_hours: { ...e.manual } as Record<string, number> } : {}) })),
    });
    setProcessing(false);
    if (error) { toast.error(error.message); return; }
    clearPayrollDraft(); setRestoredAt(null); setApproved(true); toast.success("Department payroll saved with payslips and reports.");
    void runAfterApproval(runId as string | null);
  };

  // After the human approves, finish the routine steps automatically: email payslips and post to QuickBooks.
  const runAfterApproval = async (runId: string | null) => {
    const period = `${range.start} to ${range.end}`;
    let sent = 0, skipped = 0;
    for (const e of payrollData) {
      if (!e.email) { skipped++; continue; }
      const p = e.payroll;
      const html = `<h2>Payslip ${period}</h2><p>${e.firstName} ${e.lastName} · ${e.department}</p><table cellpadding="6"><tr><td>Basic pay</td><td>${p.basicPay.toFixed(2)}</td></tr><tr><td>Overtime</td><td>${p.overtimePay.toFixed(2)}</td></tr><tr><td>Gross</td><td>${p.grossMonthly.toFixed(2)}</td></tr><tr><td>NIC</td><td>${p.employeeNIC.toFixed(2)}</td></tr><tr><td>PAYE</td><td>${p.paye.toFixed(2)}</td></tr><tr><td>Total deductions</td><td>${p.totalDeductions.toFixed(2)}</td></tr><tr><td><strong>Net pay</strong></td><td><strong>XCD ${p.netPay.toFixed(2)}</strong></td></tr></table>`;
      const { data, error } = await supabase.functions.invoke("email-payslip", { body: { user_id: e.id, payslip_html: html, period } });
      if (error || data?.error) skipped++; else sent++;
    }
    toast.info(`Payslips emailed: ${sent}${skipped ? ` · ${skipped} need manual delivery (no email or login)` : ""}`);
    if (!runId) return;
    const { data, error } = await supabase.functions.invoke("qbo-sync", { body: { action: "sync", payroll_run_id: runId } });
    if (error || data?.error) toast.warning("QuickBooks post queued for review on the QuickBooks page.");
    else toast.success("Payroll journal posted to QuickBooks.");
  };

  const inDepartments = selectDepartments(employees, selected);
  const payrollData = (periodError ? [] : inDepartments.filter(e => payType !== "custom" || !excluded.includes(e.id)))
    .map((e) => {
      // Recurring deductions are monthly amounts; prorate them to the pay period.
      const creditorDeductions = source === "live" ? (deductionsMap[e.id] || []).map(d => ({ creditorName: d.creditorName, amount: periodAmount(decisions[d.key], Math.round(d.amount * factor * 100) / 100) })).filter(d => d.amount > 0) : [];
      const loanDeductions = source === "live" ? Math.round(loans.filter(l => l.user_id === e.id).reduce((total, l) => total + loanDeduction(l.balance, l.monthly_repayment, factor), 0) * 100) / 100 : 0;
      if (loanDeductions > 0) creditorDeductions.push({ creditorName: "Employee loan repayment", amount: loanDeductions });
      const additions = source === "live" ? (additionsMap[e.id] || []).map(a => ({ type: a.type, description: a.description, amount: periodAmount(decisions[a.key], a.amount) })).filter(a => a.amount > 0) : [];
      const h = attendance[e.id]; const basis = payBases[e.id];
      let salary = e.monthlySalary; let overtime = 0; let attendanceError = "";
      let hourlyRate = e.monthlySalary / (e.stdHoursPerDay * 22);
      const manual = source === "live" && manualMode ? (manualHours[e.id] || { regular: 0, overtime: 0, double_time: 0 }) : undefined;
      if (manual) {
        try { const m = manualEarnings({ basis: basis?.basis || "", rate: basis?.rate || 0, monthlySalary: e.monthlySalary, stdHoursPerDay: e.stdHoursPerDay, otRate: Number(e.otRate) || 1.5, factor }, manual);
          if (m.hoursBased) salary = factor > 0 ? m.basic / factor : 0; overtime = m.overtime; hourlyRate = m.hourly;
          if (m.hoursBased && m.hourly <= 0) attendanceError = "Pay rate missing"; }
        catch (err) { salary = 0; attendanceError = err instanceof Error ? err.message : "Check hours"; }
      } else if (source === "live" && h?.enabled && basis && ["Hourly", "Daily"].includes(basis.basis)) {
        try { const earnings = attendanceEarnings(basis.rate, basis.basis, e.stdHoursPerDay, h); salary = factor > 0 ? earnings.basic / factor : 0; overtime = earnings.overtime; hourlyRate = earnings.hourly; }
        catch (err) { salary = 0; attendanceError = err instanceof Error ? err.message : "Review attendance"; }
      }
      const calculated = calculatePeriodPayroll(salary, factor, config, creditorDeductions, additions, overtime, source === "live" ? basis?.options : undefined);
      const edited = source === "live" ? edits[e.id] : undefined;
      const result = edited ? computeEdited(edited, config, factor) : calculated;
      if (edited) attendanceError = "";
      const compliance = checkMinimumWageCompliance(hourlyRate, config);
      return { ...e, payroll: result, hourlyRate, compliance, loanDeductions, attendance: h, attendanceError, manual, edited, calculated, payBasis: basis?.basis || "Monthly" };
    });
  const liveIds = new Set(payrollData.map(e => e.id));
  const recurringHere = source === "live" ? recurring.filter(r => liveIds.has(r.userId)) : [];
  const recurringPending = recurringHere.filter(r => !decisions[r.key]);
  const attendanceBlocked = source === "live" && payrollData.some(e => Boolean(e.attendanceError));
  const negativeNet = payrollData.filter(e => e.payroll.netPay < 0 || e.payroll.paye > e.payroll.grossMonthly);

  const totals = payrollData.reduce(
    (acc, e) => ({
      gross: acc.gross + e.payroll.grossMonthly,
      additions: acc.additions + e.payroll.totalAdditions,
      nicEmployee: acc.nicEmployee + e.payroll.employeeNIC,
      nicEmployer: acc.nicEmployer + e.payroll.employerNIC,
      paye: acc.paye + e.payroll.paye,
      creditor: acc.creditor + e.payroll.totalCreditorDeductions,
      net: acc.net + e.payroll.netPay,
    }),
    { gross: 0, additions: 0, nicEmployee: 0, nicEmployer: 0, paye: 0, creditor: 0, net: 0 }
  );

  const anomalies = payrollData.filter((e) => !e.compliance.compliant);
  const officerPayload = { source: source === "sample" ? "sample" as const : "live" as const, payType, start: range.start, end: range.end, jurisdiction: source === "sample" ? "LC" : jurisdiction, rows: anonymousReviewRows(payrollData) };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Run Payroll</h1>
        <p className="text-sm text-muted-foreground mt-1">{period} • {config.countryName} ({config.currency})</p>
        <p className="text-xs text-muted-foreground mt-1">{source === "sample" ? "Fictional sample payroll · No live records or emails" : `Live employee payroll · ${payTypeLabels[payType]}`}</p>
      </div>

      {source === "live" && (restoredAt || dirty) && !approved && <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm">
        <span>{restoredAt ? `Your unapproved payroll was restored (last saved ${new Date(restoredAt).toLocaleString()}). Changes keep saving automatically.` : "Your payroll entries are saved automatically on this device until you approve."}</span>
        <Button variant="outline" size="sm" onClick={discardDraft}>Discard saved entries</Button>
      </div>}
      <section className="space-y-4 border-y border-border py-4">
        <Tabs value={source} onValueChange={setSource}><TabsList><TabsTrigger value="live" disabled={processing}>Live employees</TabsTrigger>{demoMode && <TabsTrigger value="sample" disabled={processing}>Sample company</TabsTrigger>}</TabsList></Tabs>
        <div className="flex flex-wrap gap-4">
          <div className="space-y-1"><Label htmlFor="pay-type">Pay period</Label><NativeSelect id="pay-type" value={payType} disabled={processing} onChange={e => changePayType(e.target.value as PayType)}>
            {(Object.keys(payTypeLabels) as PayType[]).map(t => <option key={t} value={t}>{payTypeLabels[t]}</option>)}</NativeSelect></div>
          {payType === "monthly" ? <div className="space-y-1"><Label htmlFor="payroll-month">Payroll month</Label><Input id="payroll-month" type="month" min="2000-01" max="2099-12" value={startMonth} disabled={processing} onChange={e => { if (e.target.value) setRange(defaultRange("monthly", `${e.target.value}-01`)); }} /></div>
          : payType === "semi_monthly" ? <>
            <div className="space-y-1"><Label htmlFor="payroll-month">Month</Label><Input id="payroll-month" type="month" value={startMonth} disabled={processing} onChange={e => { if (e.target.value) setRange(defaultRange("semi_monthly", `${e.target.value}-01`, range.start.endsWith("-16") ? 2 : 1)); }} /></div>
            <div className="space-y-1"><Label htmlFor="payroll-half">Half</Label><NativeSelect id="payroll-half" value={range.start.endsWith("-16") ? "2" : "1"} disabled={processing} onChange={e => setRange(defaultRange("semi_monthly", `${startMonth}-01`, e.target.value === "2" ? 2 : 1))}>
              <option value="1">1st – 15th</option><option value="2">16th – month end</option></NativeSelect></div></>
          : payType === "weekly" ? <div className="space-y-1"><Label htmlFor="payroll-start">Week starting</Label><Input id="payroll-start" type="date" value={range.start} disabled={processing} onChange={e => { if (e.target.value) setRange(defaultRange("weekly", e.target.value)); }} /></div>
          : <>
            <div className="space-y-1"><Label htmlFor="payroll-start">From</Label><Input id="payroll-start" type="date" value={range.start} disabled={processing} onChange={e => e.target.value && setRange(r => ({ ...r, start: e.target.value }))} /></div>
            <div className="space-y-1"><Label htmlFor="payroll-end">To (e.g. last day worked)</Label><Input id="payroll-end" type="date" value={range.end} min={range.start} disabled={processing} onChange={e => e.target.value && setRange(r => ({ ...r, end: e.target.value }))} /></div></>}
          <div className="space-y-1"><Label htmlFor="payroll-island">Jurisdiction</Label><select id="payroll-island" className="h-10 w-full rounded-md border border-input bg-background text-foreground px-3" value={jurisdiction} disabled={source === "sample" || processing} onChange={e => setJurisdiction(e.target.value)}>
            {Object.values(OECS_CONFIGS).map(c => <option key={c.countryCode} value={c.countryCode}>{c.countryName}</option>)}
          </select></div>
        </div>
        {source === "live" && loading ? <p className="text-sm text-muted-foreground">Loading employees…</p> : source === "live" && loadError ? <p role="alert" className="text-sm text-destructive">{loadError}</p> : <DepartmentSelector departments={departments} selected={selected} onChange={setSelected} disabled={processing} />}
        {payType === "custom" && !periodError && inDepartments.length > 0 && <fieldset className="space-y-2" disabled={processing}>
          <legend className="text-sm font-semibold text-foreground">Employees to pay</legend>
          <div className="flex flex-wrap gap-x-6 gap-y-1">{inDepartments.map(e => <label key={e.id} className="flex items-center gap-2 min-h-11 text-sm cursor-pointer">
            <Checkbox className="min-h-4 h-4 w-4" checked={!excluded.includes(e.id)} onCheckedChange={c => setExcluded(x => c ? x.filter(i => i !== e.id) : [...x, e.id])} />{e.firstName} {e.lastName}</label>)}</div>
          <div className="space-y-1 max-w-md"><Label htmlFor="payroll-notes">Reason / notes (optional)</Label><Input id="payroll-notes" maxLength={500} placeholder="e.g. Final pay — dismissal" value={notes} onChange={e => setNotes(e.target.value)} /></div>
        </fieldset>}
        {periodError ? <p role="alert" className="text-sm text-destructive">{periodError}</p>
          : <p className="text-sm text-muted-foreground">{range.start} to {range.end}{payType === "custom" ? ` · ${workingDays(range.start, range.end)} working days` : ""} · {Math.round(factor * 10000) / 100}% of monthly salary</p>}
        <p className="text-sm text-muted-foreground">{payrollData.length} employees · {selected.length} departments selected</p>
        {negativeNet.length > 0 && <p role="alert" className="text-destructive">Net pay is below zero or PAYE is more than gross pay for {negativeNet.map(e => `${e.firstName} ${e.lastName}`).join(", ")}. Check the PAYE setting in their employee folder, or click Edit to correct this payroll.</p>}
        {attendanceBlocked && <p role="alert" className="text-destructive">Attendance review required: {payrollData.filter(e => e.attendanceError).map(e => `${e.firstName} ${e.lastName}`).join(", ")}. Confirm worked hours under Attendance before approval.</p>}
        {recurringHere.length > 0 && <RecurringReview items={recurringHere} names={Object.fromEntries(payrollData.map(e => [e.id, `${e.firstName} ${e.lastName}`]))} factor={factor} decisions={decisions} disabled={processing || approved} onChange={(k, d) => setDecisions(m => { const n = { ...m }; if (d) n[k] = d; else delete n[k]; return n; })} />}
        {source === "live" && <Button variant="outline" onClick={() => navigate("/attendance")}>Review attendance and missing punches</Button>}
        {source === "live" && <div className="rounded-lg border border-accent/40 bg-accent/5 p-3 space-y-3">
          <label className="flex items-center gap-2 min-h-11 text-sm font-semibold cursor-pointer">
            <Checkbox className="h-4 w-4" checked={manualMode} disabled={processing} onCheckedChange={c => setManualMode(Boolean(c))} />
            Enter hours manually (ignore clock-in / clock-out for this payroll)
          </label>
          {manualMode && <>
            <p className="text-xs text-muted-foreground">Daily staff are paid for the days you enter (half days allowed, e.g. 5.5). Hourly staff are paid for the regular hours you enter. Salaried staff keep their salary; only overtime is added. Overtime uses each employee's overtime rate (usually 1.5×); double time is 2×.</p>
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead><tr className="text-left text-muted-foreground"><th className="py-1 pr-2">Employee</th><th className="pr-2">Paid</th><th className="pr-2">Days worked</th><th className="pr-2">Regular hrs</th><th className="pr-2">Overtime hrs</th><th className="pr-2">Double-time hrs</th><th className="text-right">Gross</th></tr></thead>
              <tbody>{payrollData.map(e => { const v = manualHours[e.id] || { regular: 0, overtime: 0, double_time: 0 }; const hoursBased = e.payBasis === "Hourly" || e.payBasis === "Daily";
                const isDaily = e.payBasis === "Daily"; const std = e.stdHoursPerDay > 0 ? e.stdHoursPerDay : 8;
                const set = (k: keyof ManualHours, val: string) => setManualHours(m => ({ ...m, [e.id]: { ...v, [k]: Math.max(0, Number(val) || 0) } }));
                const setDays = (val: string) => setManualHours(m => ({ ...m, [e.id]: { ...v, regular: Math.round(Math.max(0, Number(val) || 0) * std * 10000) / 10000 } }));
                const days = v.regular ? Math.round((v.regular / std) * 100) / 100 : 0;
                return <tr key={e.id} className="border-t border-border">
                  <td className="py-1 pr-2">{e.firstName} {e.lastName}</td><td className="pr-2 text-muted-foreground">{e.payBasis}</td>
                  <td className="pr-2"><Input aria-label={`days worked for ${e.firstName}`} type="number" min={0} step="0.5" className="w-24" disabled={processing || !isDaily} value={isDaily ? days || "" : ""} placeholder={isDaily ? "0" : "—"} onChange={ev => setDays(ev.target.value)} /></td>
                  {(["regular", "overtime", "double_time"] as const).map(k => { const locked = k === "regular" && (!hoursBased || isDaily);
                    return <td key={k} className="pr-2"><Input aria-label={`${k} hours for ${e.firstName}`} type="number" min={0} step="0.25" className="w-24" disabled={processing || locked} value={k === "regular" && !hoursBased ? "" : v[k] || ""} placeholder={k === "regular" && !hoursBased ? "salary" : "0"} onChange={ev => set(k, ev.target.value)} /></td>; })}
                  <td className="text-right">{e.payroll.grossMonthly.toFixed(2)}</td></tr>; })}</tbody>
            </table></div>
          </>}
        </div>}
      </section>

      {(() => { const emp = payrollData.find(x => x.id === editing); if (!emp) return null;
        return <PayEditDialog key={emp.id} open name={`${emp.firstName} ${emp.lastName}`} config={config} factor={factor}
          initial={edits[emp.id] ?? linesFromResult(emp.calculated, payBases[emp.id]?.options.nicBasis === "basic", emp.loanDeductions)}
          onSave={ed => setEdits(m => ({ ...m, [emp.id]: ed }))} onReset={() => setEdits(m => { const n = { ...m }; delete n[emp.id]; return n; })} onClose={() => setEditing(null)} />; })()}
      {/* Stepper */}
      <div className="flex items-center gap-2">
        {steps.map((step, i) => (
          <div key={step} className="flex items-center gap-2">
            <Button
              disabled={processing || !payrollData.length || (source === "live" && (loading || !!loadError))} onClick={() => setCurrentStep(i)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                i === currentStep
                  ? "bg-primary text-primary-foreground"
                  : i < currentStep
                  ? "bg-success/10 text-success"
                  : "bg-secondary text-muted-foreground"
              }`}
            >
              {i < currentStep ? <CheckCircle size={16} /> : <span className="w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs">{i + 1}</span>}
              <span className="hidden sm:inline">{step}</span>
            </Button>
            {i < steps.length - 1 && <ArrowRight size={14} className="text-muted-foreground" />}
          </div>
        ))}
      </div>

      {/* Step Content */}
      {currentStep === 0 && (
        <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
          <Card className="shadow-card border-border/60 overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-display flex items-center gap-2">
                <FileText size={16} />
                Employee Payroll Preview
              </CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Employee</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Basic Pay</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Additions</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Gross</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Employee NIC</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">PAYE</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Creditor Ded.</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Net Pay</th>
                    {source === "live" && <th className="py-3 px-4"><span className="sr-only">Edit</span></th>}
                  </tr>
                </thead>
                <tbody>
                  {payrollData.map((emp, i) => (
                    <motion.tr
                      key={emp.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.02 }}
                      className="border-b border-border/50 hover:bg-secondary/30 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-xs font-bold text-primary">{emp.firstName[0]}{emp.lastName[0]}</span>
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{emp.firstName} {emp.lastName}</p>
                            <p className="text-xs text-muted-foreground">{emp.department} · {emp.nicNumber}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-foreground">{formatCurrency(emp.payroll.basicPay)}</td>
                      <td className="py-3 px-4 text-right font-mono text-success">{formatCurrency(emp.payroll.totalAdditions)}</td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-foreground">{formatCurrency(emp.payroll.grossMonthly)}</td>
                      <td className="py-3 px-4 text-right font-mono text-destructive">{formatCurrency(emp.payroll.employeeNIC)}</td>
                      <td className="py-3 px-4 text-right font-mono text-destructive">{formatCurrency(emp.payroll.paye)}</td>
                      <td className="py-3 px-4 text-right font-mono text-destructive">{formatCurrency(emp.payroll.totalCreditorDeductions)}</td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-success">{formatCurrency(emp.payroll.netPay)}</td>
                      {source === "live" && <td className="py-3 px-4 text-right"><Button size="sm" variant={emp.edited ? "default" : "outline"} disabled={processing || approved || !isAdminOrManager} onClick={() => setEditing(emp.id)}><Pencil size={14} className="mr-1" />{emp.edited ? "Edited" : "Edit"}</Button></td>}
                    </motion.tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-secondary/80 font-semibold">
                    <td className="py-3 px-4 text-foreground">Totals</td>
                    <td className="py-3 px-4 text-right font-mono text-foreground">{formatCurrency(totals.gross - totals.additions)}</td>
                    <td className="py-3 px-4 text-right font-mono text-success">{formatCurrency(totals.additions)}</td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-foreground">{formatCurrency(totals.gross)}</td>
                    <td className="py-3 px-4 text-right font-mono text-destructive">{formatCurrency(totals.nicEmployee)}</td>
                    <td className="py-3 px-4 text-right font-mono text-destructive">{formatCurrency(totals.paye)}</td>
                    <td className="py-3 px-4 text-right font-mono text-destructive">{formatCurrency(totals.creditor)}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-success">{formatCurrency(totals.net)}</td>
                    {source === "live" && <td />}
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
          <div className="flex justify-end">
            <Button disabled={!payrollData.length || (source === "live" && (loading || !!loadError))} onClick={() => setCurrentStep(1)} className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
              Continue to Audit <ArrowRight size={16} />
            </Button>
          </div>
        </motion.div>
      )}

      {currentStep === 1 && (
        <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
          <Card className="shadow-card border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-display flex items-center gap-2">
                <AlertCircle size={16} className="text-primary" />
                Payroll Audit
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {anomalies.length === 0 ? (
                <div className="flex items-center gap-3 p-4 rounded-lg bg-success/10 border border-success/20">
                  <CheckCircle size={20} className="text-success" />
                  <div>
                    <p className="font-medium text-foreground">Configured minimum-wage check passed</p>
                    <p className="text-sm text-muted-foreground">Selected employees meet the configured minimum wage.</p>
                  </div>
                </div>
              ) : (
                anomalies.map((a) => (
                  <div key={a.id} className="flex items-center gap-3 p-4 rounded-lg bg-warning/10 border border-warning/20">
                    <AlertCircle size={20} className="text-warning" />
                    <div>
                      <p className="font-medium text-foreground">{a.firstName} {a.lastName}</p>
                      <p className="text-sm text-muted-foreground">{a.compliance.message}</p>
                    </div>
                  </div>
                ))
              )}

              <div className="mt-4 space-y-2">
                <h3 className="text-sm font-medium text-foreground">Audit Checklist</h3>
                {[
                  `${selected.length} selected departments`,
                  `Employer NIC contribution: ${formatCurrency(totals.nicEmployer)} XCD`,
                  `Tax configuration: ${config.countryName}`,
                  `Total creditor deductions: ${formatCurrency(totals.creditor)} XCD`,
                ].map((check) => (
                  <div key={check} className="flex items-center gap-2 text-sm">
                    <CheckCircle size={14} className="text-success" />
                    <span className="text-foreground">{check}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <PayrollOfficer key={JSON.stringify(officerPayload)} payload={officerPayload} allowed={isAdminOrManager && !loading && !loadError} />
          <div className="flex justify-between">
            <Button onClick={() => setCurrentStep(0)} className="px-6 py-2.5 bg-secondary text-foreground rounded-lg text-sm font-medium hover:bg-muted transition-colors">
              Back
            </Button>
            <Button onClick={() => setCurrentStep(2)} className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
              Continue to Approve <ArrowRight size={16} />
            </Button>
          </div>
        </motion.div>
      )}

      {currentStep === 2 && (
        <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
          <Card className="shadow-card border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-display">Payroll Summary — {period}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Earnings</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between py-2 border-b border-border/50">
                      <span className="text-sm text-foreground">Basic Pay</span>
                      <span className="font-semibold font-mono text-foreground">{formatCurrency(totals.gross - totals.additions)} XCD</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border/50">
                      <span className="text-sm text-success">Additions (Bonus, OT, etc.)</span>
                      <span className="font-semibold font-mono text-success">+{formatCurrency(totals.additions)} XCD</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border/50">
                      <span className="text-sm font-medium text-foreground">Total Gross Pay</span>
                      <span className="font-bold font-mono text-foreground">{formatCurrency(totals.gross)} XCD</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border/50">
                      <span className="text-sm text-foreground">Employees Paid</span>
                      <span className="font-semibold text-foreground">{payrollData.length}</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Deductions</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between py-2 border-b border-border/50">
                      <span className="text-sm text-foreground">NIC (Employee)</span>
                      <span className="font-mono text-destructive">{formatCurrency(totals.nicEmployee)}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border/50">
                      <span className="text-sm text-foreground">NIC (Employer)</span>
                      <span className="font-mono text-muted-foreground">{formatCurrency(totals.nicEmployer)}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border/50">
                      <span className="text-sm text-foreground">PAYE Income Tax</span>
                      <span className="font-mono text-destructive">{formatCurrency(totals.paye)}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border/50">
                      <span className="text-sm text-foreground">Creditor Deductions</span>
                      <span className="font-mono text-destructive">{formatCurrency(totals.creditor)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 p-4 rounded-lg bg-success/5 border border-success/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Net Pay</p>
                    <p className="text-3xl font-display font-bold text-success">{formatCurrency(totals.net)} <span className="text-lg">XCD</span></p>
                  </div>
                  <DollarSign size={32} className="text-success/30" />
                </div>
              </div>
            </CardContent>
          </Card>
          <div className="flex flex-col sm:flex-row justify-between gap-3">
            <Button disabled={!payrollData.length || (source === "live" && (loading || !!loadError))} onClick={() => setCurrentStep(1)} className="px-6 py-2.5 bg-secondary text-foreground rounded-lg text-sm font-medium hover:bg-muted transition-colors">
              Back
            </Button>
            <div className="flex flex-wrap gap-2 justify-end">
              <Button
                onClick={handleBulkEmail}
                disabled
                className="flex items-center gap-2 px-4 md:px-6 py-2.5 md:py-3 bg-secondary text-foreground rounded-lg text-xs md:text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
              >
                {bulkEmailing ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
                <span className="hidden sm:inline">{bulkEmailing ? `Emailing ${payrollData.length}...` : `Email All (${payrollData.length})`}</span>
                <span className="sm:hidden">{bulkEmailing ? "Emailing..." : "Email"}</span>
              </Button>
              <Button
                onClick={() => navigate("/payslips")}
                className="flex items-center gap-2 px-4 md:px-6 py-2.5 md:py-3 bg-secondary text-foreground rounded-lg text-xs md:text-sm font-medium hover:bg-muted transition-colors"
              >
                <Receipt size={16} />
                <span className="hidden sm:inline">Generate Payslips</span>
                <span className="sm:hidden">Payslips</span>
              </Button>
              <Button
                onClick={handleApprovePayroll}
                disabled={processing || approved || attendanceBlocked || negativeNet.length > 0 || !payrollData.length || !isAdminOrManager || (source === "live" && (loading || !!loadError))}
                className="flex items-center gap-2 px-4 md:px-8 py-2.5 md:py-3 bg-success text-success-foreground rounded-lg text-xs md:text-sm font-bold hover:bg-success/90 transition-colors disabled:opacity-50"
              >
                {processing ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />}
                {approved ? "Completed ✓" : processing ? "Processing..." : source === "sample" ? "Complete Sample Payroll" : "Approve & Save Payroll"}
              </Button>
            </div>
          </div>
        </motion.div>
      )}
      <DepartmentPayrollReport rows={payrollData.map(e => reportRow(e.id, `${e.firstName} ${e.lastName}`, e.department, e.payroll))} period={period} sample={source === "sample"} />
      {approved && source === "live" && <Button variant="outline" onClick={() => navigate("/reports")}>View approved payroll reports <ArrowRight /></Button>}
    </div>
  );
}
