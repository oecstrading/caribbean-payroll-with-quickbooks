import { useEffect, useState } from "react";
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

const steps = ["Review & Sync", "Audit", "Approve & Run"];

export default function PayrollPage() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const bulkEmailing = false;
  const [processing, setProcessing] = useState(false);
  const [approved, setApproved] = useState(false);
  const [source, setSource] = useState("live");
  const [payType, setPayType] = useState<PayType>("monthly");
  const [range, setRange] = useState(() => defaultRange("monthly", new Date().toISOString().slice(0, 10)));
  const [excluded, setExcluded] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  let factor = 0; let periodError = "";
  try { factor = periodFactor(payType, range.start, range.end); } catch (e) { periodError = (e as Error).message; }
  const period = periodLabel(payType, range.start, range.end);
  const startMonth = range.start.slice(0, 7);
  const changePayType = (t: PayType) => { setPayType(t); setRange(defaultRange(t, range.start)); setExcluded([]); };
  const [jurisdiction, setJurisdiction] = useState("LC");
  const [liveEmployees, setLiveEmployees] = useState<Employee[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [deductionsMap, setDeductionsMap] = useState<Record<string, import("@/lib/payroll-engine").CreditorDeduction[]>>({});
  const [additionsMap, setAdditionsMap] = useState<Record<string, import("@/lib/payroll-engine").PayrollAddition[]>>({});
  const { isAdminOrManager } = useRole();
  const config = getConfigByJurisdiction(source === "sample" ? "LC" : jurisdiction);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setLoadError("");
    const load = async () => {
      const [profiles, deductions, additions, records] = await Promise.all([
        supabase.from("profiles").select("*").is("deleted_at", null).eq("jurisdiction", jurisdiction),
        supabase.from("employee_deductions").select("*, creditors(name)").eq("is_active", true),
        supabase.from("employee_additions").select("*").eq("is_active", true),
        supabase.from("employee_records").select("*").is("deleted_at", null).eq("jurisdiction", jurisdiction),
      ]);
      if (profiles.error || deductions.error || additions.error || records.error) throw profiles.error || deductions.error || additions.error || records.error;
      if (cancelled) return;
      setLiveEmployees([...(profiles.data || []), ...(records.data || [])].filter(p => p.status.toLowerCase() === "active").map(p => ({
        id: p.user_id, firstName: p.first_name, lastName: p.last_name, department: departmentName(p.department),
        monthlySalary: Number(p.monthly_salary || 0), stdHoursPerDay: Number(p.std_hours_per_day || 8),
        nicNumber: p.nic_number || "", personId: p.person_id || "", jobTitle: p.job_title || "", email: p.email,
        phone: p.phone || "", startDate: p.start_date || "", schedule: p.schedule || "", otRate: p.ot_rate || 1.5,
        status: "Active", tanNumber: p.tan_number || "",
      })));
      const dm: typeof deductionsMap = {}; const am: typeof additionsMap = {};
      for (const d of deductions.data || []) {
        if ((d.start_date && d.start_date > range.end) || (d.end_date && d.end_date < range.start)) continue;
        (dm[d.user_id] ||= []).push({ creditorName: d.creditors?.name || "Creditor", amount: Number(d.amount) });
      }
      for (const a of additions.data || []) {
        if (a.period && a.period !== startMonth) continue;
        (am[a.user_id] ||= []).push({ type: a.addition_type, description: a.description || a.addition_type, amount: Number(a.amount) });
      }
      setDeductionsMap(dm); setAdditionsMap(am);
    };
    load().catch(e => { if (!cancelled) setLoadError(e.message || "Unable to load employees"); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [jurisdiction, range.start, range.end]);
  const employees = source === "sample" ? sampleEmployees.filter(e => e.status === "Active") : liveEmployees;
  const departments = [...new Set(employees.map(e => departmentName(e.department)))].sort();
  const departmentKey = departments.join("\u0000");
  useEffect(() => { setSelected(departments); }, [departmentKey, source]);
  useEffect(() => { setApproved(false); setCurrentStep(0); }, [source, period, jurisdiction, selected, excluded]);
  const handleBulkEmail = () => toast.info("Use saved payslips for email delivery.");
  const handleApprovePayroll = async () => {
    if (!payrollData.length || !selected.length || !isAdminOrManager || periodError) return;
    if (source === "sample") { setApproved(true); toast.success("Sample completed; no live payroll saved."); return; }
    setProcessing(true);
    const { error } = await supabase.rpc("approve_payroll_run", {
      _pay_type: payType, _start: range.start, _end: range.end, _notes: notes || undefined, _jurisdiction: jurisdiction, _departments: selected,
      _rows: payrollData.map(e => ({ user_id: e.id, department: e.department, basic_pay: e.payroll.basicPay,
        overtime_pay: e.payroll.overtimePay, gross_pay: e.payroll.grossMonthly, employee_nic: e.payroll.employeeNIC,
        employer_nic: e.payroll.employerNIC, paye: e.payroll.paye, total_deductions: e.payroll.totalDeductions, net_pay: e.payroll.netPay })),
    });
    setProcessing(false);
    if (error) { toast.error(error.message); return; }
    setApproved(true); toast.success("Department payroll saved with payslips and reports.");
  };

  const inDepartments = selectDepartments(employees, selected);
  const payrollData = (periodError ? [] : inDepartments.filter(e => payType !== "custom" || !excluded.includes(e.id)))
    .map((e) => {
      // Recurring deductions are monthly amounts; prorate them to the pay period.
      const creditorDeductions = source === "live" ? (deductionsMap[e.id] || []).map(d => ({ ...d, amount: Math.round(d.amount * factor * 100) / 100 })) : [];
      const additions = source === "live" ? additionsMap[e.id] || [] : [];
      const result = calculatePeriodPayroll(e.monthlySalary, factor, config, creditorDeductions, additions);
      const hourlyRate = e.monthlySalary / (e.stdHoursPerDay * 22);
      const compliance = checkMinimumWageCompliance(hourlyRate, config);
      return { ...e, payroll: result, hourlyRate, compliance };
    });

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

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Run Payroll</h1>
        <p className="text-sm text-muted-foreground mt-1">{period} • {config.countryName} ({config.currency})</p>
        <p className="text-xs text-muted-foreground mt-1">{source === "sample" ? "Fictional sample payroll · No live records or emails" : `Live employee payroll · ${payTypeLabels[payType]}`}</p>
      </div>

      <section className="space-y-4 border-y border-border py-4">
        <Tabs value={source} onValueChange={setSource}><TabsList><TabsTrigger value="live" disabled={processing}>Live employees</TabsTrigger><TabsTrigger value="sample" disabled={processing}>Sample company</TabsTrigger></TabsList></Tabs>
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
      </section>

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
                    <p className="font-medium text-foreground">All checks passed</p>
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
                disabled={processing || approved || !payrollData.length || !isAdminOrManager || (source === "live" && (loading || !!loadError))}
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
