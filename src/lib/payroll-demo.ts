// Fictional fixtures only: no service/network dependencies or production tax rules.
export const DEMO_EMPLOYEE = { name: "Demo Employee", username: "demo.employee", pin: "135790", department: "Operations", rate: 25 };
export const DEMO_ADMIN = { name: "Human in the Middle Administrator", username: "demo.administrator", pin: "246802" };
export const DEMO_PERIOD = "1–31 October 2026";
export type DemoEmployee = { name: string; department: string; basis: string; hours: number; basic: number; overtime: number; bonus: number; allowance: number; absence: number; loanBalance: number; loanScheduled: number; insurance: number; union: number; creditor: number; advance: number };
const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const employee = (data: Partial<DemoEmployee> & Pick<DemoEmployee, "name" | "department" | "basis" | "basic" | "hours">): DemoEmployee => ({ overtime: 0, bonus: 0, allowance: 0, absence: 0, loanBalance: 0, loanScheduled: 0, insurance: 0, union: 0, creditor: 0, advance: 0, ...data });
export const demoEmployees = [
  employee({ name: "Demo Employee", department: "Operations", basis: "Hourly · 160h × 25 + 10h OT × 37.50", hours: 170, basic: 4000, overtime: 375, loanBalance: 800, loanScheduled: 100, insurance: 50 }),
  employee({ name: "Maya Joseph", department: "Operations", basis: "Daily · 26 days × 80; 1 unpaid day", hours: 156, basic: 2080, overtime: 90, absence: 80, union: 25 }),
  employee({ name: "Noah James", department: "Administration", basis: "Monthly · 6,500 + 500 bonus", hours: 173.33, basic: 6500, bonus: 500, loanBalance: 180, loanScheduled: 250, insurance: 120 }),
  employee({ name: "Ava Charles", department: "Finance", basis: "Monthly · 4,500 + 200 allowance", hours: 156, basic: 4500, allowance: 200, creditor: 180, insurance: 75 }),
  employee({ name: "Eli Thomas", department: "Sales", basis: "Weekly · 4 × 750 + 600 commission", hours: 160, basic: 3000, bonus: 600, advance: 200, union: 30 }),
];
export function calculateDemoPay(person: DemoEmployee) {
  const gross = round(person.basic + person.overtime + person.bonus + person.allowance - person.absence);
  const employeeNic = round(gross * .05);
  const employerNic = employeeNic;
  const taxable = round(Math.max(0, gross - employeeNic - 2500));
  const paye = round(taxable * .20);
  const loan = round(Math.min(person.loanScheduled, person.loanBalance));
  const other = round(person.insurance + person.union + person.creditor + person.advance);
  const deductions = round(employeeNic + paye + loan + other);
  return { ...person, gross, employeeNic, employerNic, taxable, paye, loan, other, deductions, net: round(gross - deductions), employerCost: round(gross + employerNic), loanRemaining: round(person.loanBalance - loan) };
}
export const demoPayroll = demoEmployees.map(calculateDemoPay);
const total = (key: keyof (typeof demoPayroll)[number]) => round(demoPayroll.reduce((sum, row) => sum + Number(row[key]), 0));
export const demoPay = { hours: total("hours"), gross: total("gross"), employeeNic: total("employeeNic"), employerNic: total("employerNic"), paye: total("paye"), loan: total("loan"), other: total("other"), net: total("net"), employerCost: total("employerCost"), deductions: total("deductions") };
export const demoDepartments = [...new Set(demoPayroll.map(row => row.department))].map(department => {
  const rows = demoPayroll.filter(row => row.department === department);
  return { department, count: rows.length, gross: round(rows.reduce((s, r) => s + r.gross, 0)), deductions: round(rows.reduce((s, r) => s + r.deductions, 0)), net: round(rows.reduce((s, r) => s + r.net, 0)), cost: round(rows.reduce((s, r) => s + r.employerCost, 0)) };
});
export const demoExceptions = [
  { id: "missing-punch", employee: "Maya Joseph", title: "Missing clock-out · 14 October", detail: "Suggested 16:00 clock-out, 6 paid hours. Pending evidence; never invent a punch.", resolution: "I checked the fictional supervisor log and confirmed 6 hours; the draft includes this shift." },
  { id: "unusual-bonus", employee: "Noah James", title: "Unusual bonus and final loan instalment", detail: "XCD 500 bonus needs authorization. Scheduled loan 250 exceeds remaining balance 180; repayment capped at 180.", resolution: "I verified the fictional bonus authorization and the capped final loan repayment of XCD 180." },
  { id: "bank-details", employee: "Ava Charles", title: "Changed bank details", detail: "Payment destination changed. Payroll approval is not bank payment authorization.", resolution: "I verified the fictional bank-change request independently before releasing the report package." },
] as const;
export type DemoException = typeof demoExceptions[number]["id"];
export type DemoState = { employeeIn: boolean; clockedIn: boolean; clockedOut: boolean; prepared: boolean; adminIn: boolean; reviewed: boolean; approved: boolean; posted: boolean; delivered: boolean; resolved: DemoException[] };
export const emptyDemo: DemoState = { employeeIn: false, clockedIn: false, clockedOut: false, prepared: false, adminIn: false, reviewed: false, approved: false, posted: false, delivered: false, resolved: [] };
export type DemoAction = "employee-login" | "clock-in" | "clock-out" | "prepare" | "admin-login" | "review" | "approve" | "post" | "deliver";
export function resolveDemoException(state: DemoState, id: DemoException, checked: boolean): DemoState {
  if (!state.adminIn || state.approved) return state;
  return { ...state, reviewed: false, resolved: checked ? [...new Set([...state.resolved, id])] : state.resolved.filter(value => value !== id) };
}
export const demoReadyForReview = (state: DemoState) => demoExceptions.every(flag => state.resolved.includes(flag.id));
export function advanceDemo(state: DemoState, action: DemoAction): DemoState {
  const transitions: Record<DemoAction, [keyof DemoState, boolean]> = {
    "employee-login": ["employeeIn", true], "clock-in": ["clockedIn", state.employeeIn],
    "clock-out": ["clockedOut", state.clockedIn], prepare: ["prepared", state.clockedOut],
    "admin-login": ["adminIn", state.prepared], review: ["reviewed", state.adminIn && state.prepared && demoReadyForReview(state)],
    approve: ["approved", state.adminIn && state.reviewed && demoReadyForReview(state)], post: ["posted", state.approved], deliver: ["delivered", state.approved && state.posted],
  };
  const [field, allowed] = transitions[action];
  return allowed ? { ...state, [field]: true } : state;
}
export function demoLogin(username: string, pin: string, role: "employee" | "admin") {
  const account = role === "employee" ? DEMO_EMPLOYEE : DEMO_ADMIN;
  return username === account.username && pin === account.pin;
}
export const demoJournal = [
  ...demoDepartments.map(row => ({ account: `Wages expense · ${row.department}`, debit: row.gross, credit: 0 })),
  { account: "Employer NIC expense", debit: demoPay.employerNic, credit: 0 },
  { account: "Wages payable", debit: 0, credit: demoPay.net },
  { account: "NIC payable", debit: 0, credit: round(demoPay.employeeNic + demoPay.employerNic) },
  { account: "PAYE payable", debit: 0, credit: demoPay.paye },
  { account: "Employee loan receivable", debit: 0, credit: demoPay.loan },
  { account: "Insurance payable", debit: 0, credit: total("insurance") },
  { account: "Union dues payable", debit: 0, credit: total("union") },
  { account: "Creditor deductions payable", debit: 0, credit: total("creditor") },
  { account: "Salary advance receivable", debit: 0, credit: total("advance") },
];
export type DemoReport = { title: string; headers: string[]; rows: (string | number)[][] };
export function demoReports(): DemoReport[] {
  return [
    { title: "Attendance", headers: ["Employee", "Department", "Period", "Hours", "Review basis"], rows: demoPayroll.map(r => [r.name, r.department, DEMO_PERIOD, r.hours, r.name === "Maya Joseph" ? "6h missing punch confirmed by human; 1 unpaid day" : "Fictional approved timesheet; Castries simulated location"]) },
    { title: "Payroll summary", headers: ["Employee", "Department", "Gross", "NIC", "PAYE", "Loan", "Other", "Net XCD"], rows: demoPayroll.map(r => [r.name, r.department, r.gross, r.employeeNic, r.paye, r.loan, r.other, r.net]) },
    { title: "Departmental payroll", headers: ["Department", "Staff", "Gross XCD", "Deductions", "Net", "Employer cost"], rows: demoDepartments.map(r => [r.department, r.count, r.gross, r.deductions, r.net, r.cost]) },
    { title: "Consolidated payroll", headers: ["Staff", "Gross", "Employee NIC", "Employer NIC", "PAYE", "Loans", "Other", "Net", "Cost XCD"], rows: [[5, demoPay.gross, demoPay.employeeNic, demoPay.employerNic, demoPay.paye, demoPay.loan, demoPay.other, demoPay.net, demoPay.employerCost]] },
    ...demoPayroll.map(r => ({ title: `Salary slip - ${r.name}`, headers: ["Employee", "Item", "XCD"], rows: [[r.name, r.basis, r.basic], [r.name, "Overtime", r.overtime], [r.name, "Bonus / commission", r.bonus], [r.name, "Allowance", r.allowance], [r.name, "Unpaid absence", -r.absence], [r.name, "Gross", r.gross], [r.name, "Employee NIC", -r.employeeNic], [r.name, "PAYE (fictional)", -r.paye], [r.name, "Loan repayment", -r.loan], [r.name, "Insurance", -r.insurance], [r.name, "Union dues", -r.union], [r.name, "Creditor", -r.creditor], [r.name, "Salary advance", -r.advance], [r.name, "Net salary", r.net]] })),
    { title: "NIC and PAYE worksheet", headers: ["Employee", "Employee NIC", "Employer NIC", "Taxable demo basis", "PAYE"], rows: demoPayroll.map(r => [r.name, r.employeeNic, r.employerNic, r.taxable, r.paye]) },
    { title: "Deductions and loan balances", headers: ["Employee", "Opening loan", "Scheduled", "Actual loan", "Closing loan", "Insurance", "Union", "Creditor", "Advance"], rows: demoPayroll.map(r => [r.name, r.loanBalance, r.loanScheduled, r.loan, r.loanRemaining, r.insurance, r.union, r.creditor, r.advance]) },
    { title: "Human review audit", headers: ["Employee", "Exception", "Human confirmation"], rows: demoExceptions.map(r => [r.employee, r.title, r.resolution]) },
    { title: "QuickBooks journal", headers: ["Account", "Debit XCD", "Credit XCD"], rows: demoJournal.map(r => [r.account, r.debit, r.credit]) },
  ];
}
export function demoEmail(state: DemoState) {
  if (!state.approved || !state.posted) return null;
  return { to: "external.accountant@example.invalid", subject: `SIMULATION — five-person approved payroll, ${DEMO_PERIOD}`, body: `Human in the Middle Administrator resolved three exceptions and approved five employees across four departments. Gross XCD ${demoPay.gross.toFixed(2)}; PAYE ${demoPay.paye.toFixed(2)}; loans ${demoPay.loan.toFixed(2)}; other deductions ${demoPay.other.toFixed(2)}; net ${demoPay.net.toFixed(2)}. Employer cost and balanced journal XCD ${demoPay.employerCost.toFixed(2)}. Accountant receives the authorized full report package; employees receive only their own slip in separate simulated emails. No money moved, email sent, statutory filing submitted or QuickBooks record created.`, attachments: demoReports().map(r => `${r.title}.pdf`), employeeDeliveries: demoPayroll.map((r, i) => ({ name: r.name, to: `demo.staff${i + 1}@example.invalid`, attachment: `Salary slip - ${r.name}.pdf` })) };
}
