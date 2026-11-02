/** Pure, side-effect-free QuickBooks payroll journal construction. Amounts are checked in cents. */
export interface PayrollSlipForJournal {
  basic_pay: number | null; overtime_pay: number | null; gross_pay: number | null;
  employee_nic: number | null; employer_nic: number | null; paye: number | null;
  total_deductions: number | null; net_pay: number | null;
}
export interface QboMapping { payroll_item: string; qbo_account_id: string; qbo_account_name: string }
type Side = "Debit" | "Credit";
export interface QboJournalLine {
  Amount: number; DetailType: "JournalEntryLineDetail"; Description: string;
  JournalEntryLineDetail: { PostingType: Side; AccountRef: { value: string; name: string } };
}
const cents = (value: number | null | undefined, label: string): number => {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n < 0) throw new Error(`Invalid ${label}: expected a finite nonnegative amount`);
  if (Math.abs(n * 100 - Math.round(n * 100)) > 0.00001) throw new Error(`Invalid ${label}: more than two decimal places`);
  return Math.round(n * 100);
};
export function buildPayrollJournal(slips: PayrollSlipForJournal[], mappings: QboMapping[], options: { requireMappedAccounts?: boolean } = {}) {
  if (!slips.length) throw new Error("Cannot journal an empty payroll run");
  const sums = { gross: 0, overtime: 0, employeeNic: 0, employerNic: 0, paye: 0, otherDed: 0, net: 0 };
  for (const [index, slip] of slips.entries()) {
    const gross = cents(slip.gross_pay, `payslip ${index} gross_pay`);
    const overtime = cents(slip.overtime_pay, `payslip ${index} overtime_pay`);
    const empNic = cents(slip.employee_nic, `payslip ${index} employee_nic`);
    const erNic = cents(slip.employer_nic, `payslip ${index} employer_nic`);
    const paye = cents(slip.paye, `payslip ${index} paye`);
    const deductions = cents(slip.total_deductions, `payslip ${index} total_deductions`);
    const net = cents(slip.net_pay, `payslip ${index} net_pay`);
    if (overtime > gross) throw new Error(`Payslip ${index}: overtime exceeds gross`);
    if (deductions < empNic + paye) throw new Error(`Payslip ${index}: deductions below statutory amounts`);
    if (gross !== net + deductions) throw new Error(`Payslip ${index}: gross does not equal net plus deductions`);
    sums.gross += gross; sums.overtime += overtime; sums.employeeNic += empNic;
    sums.employerNic += erNic; sums.paye += paye; sums.otherDed += deductions - empNic - paye; sums.net += net;
  }
  const mapped = new Map(mappings.map(m => [m.payroll_item, m]));
  const lines: QboJournalLine[] = [];
  const add = (key: string, amountCents: number, side: Side) => {
    if (!amountCents) return;
    const m = mapped.get(key);
    if (options.requireMappedAccounts && (!m?.qbo_account_id || m.qbo_account_id.startsWith("MOCK-")))
      throw new Error(`Missing QuickBooks account mapping: ${key}`);
    lines.push({ Amount: amountCents / 100, DetailType: "JournalEntryLineDetail",
      Description: m?.qbo_account_name || key,
      JournalEntryLineDetail: { PostingType: side, AccountRef: {
        value: m?.qbo_account_id || `MOCK-${key}`, name: m?.qbo_account_name || key,
      } } });
  };
  // Gross less overtime includes basic wages and all additional earnings not separately represented in payslips.
  add("gross_wages", sums.gross - sums.overtime, "Debit");
  add("overtime", sums.overtime, "Debit");
  add("employer_nic", sums.employerNic, "Debit");
  add("employee_nic_payable", sums.employeeNic + sums.employerNic, "Credit");
  add("paye_payable", sums.paye, "Credit");
  add("creditor_deductions", sums.otherDed, "Credit");
  add("net_pay_clearing", sums.net, "Credit");
  const debits = lines.filter(l => l.JournalEntryLineDetail.PostingType === "Debit").reduce((s,l) => s + Math.round(l.Amount * 100),0);
  const credits = lines.filter(l => l.JournalEntryLineDetail.PostingType === "Credit").reduce((s,l) => s + Math.round(l.Amount * 100),0);
  if (debits !== credits) throw new Error(`Unbalanced payroll journal: debits ${debits / 100}, credits ${credits / 100}`);
  return { lines, debitTotal: debits / 100, creditTotal: credits / 100 };
}
