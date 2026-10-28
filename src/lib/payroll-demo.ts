// Fictional client-demo fixtures only. This module has no service/network dependencies.
export const DEMO_EMPLOYEE = { name: "Demo Employee", username: "demo.employee", pin: "135790", department: "Demonstration", rate: 25 };
export const DEMO_ADMIN = { name: "Human in the Middle Administrator", username: "demo.administrator", pin: "246802" };
export type DemoState = { employeeIn: boolean; clockedIn: boolean; clockedOut: boolean; prepared: boolean; adminIn: boolean; reviewed: boolean; approved: boolean; posted: boolean; delivered: boolean };
export const emptyDemo: DemoState = { employeeIn: false, clockedIn: false, clockedOut: false, prepared: false, adminIn: false, reviewed: false, approved: false, posted: false, delivered: false };
export type DemoAction = "employee-login" | "clock-in" | "clock-out" | "prepare" | "admin-login" | "review" | "approve" | "post" | "deliver";
export function advanceDemo(state: DemoState, action: DemoAction): DemoState {
  const transitions: Record<DemoAction, [keyof DemoState, boolean]> = {
    "employee-login": ["employeeIn", true], "clock-in": ["clockedIn", state.employeeIn],
    "clock-out": ["clockedOut", state.clockedIn], prepare: ["prepared", state.clockedOut],
    "admin-login": ["adminIn", state.prepared], review: ["reviewed", state.adminIn && state.prepared],
    approve: ["approved", state.adminIn && state.reviewed], post: ["posted", state.approved],
    deliver: ["delivered", state.approved && state.posted],
  };
  const [field, allowed] = transitions[action];
  return allowed ? { ...state, [field]: true } : state;
}
export function demoLogin(username: string, pin: string, role: "employee" | "admin") {
  const account = role === "employee" ? DEMO_EMPLOYEE : DEMO_ADMIN;
  return username === account.username && pin === account.pin;
}
export const demoPay = { hours: 8, gross: 200, employeeNic: 10, employerNic: 10, paye: 0, loan: 20, net: 170, employerCost: 210 };
export const demoJournal = [
  { account: "Wages expense", debit: 200, credit: 0 },
  { account: "Employer NIC expense", debit: 10, credit: 0 },
  { account: "Wages payable", debit: 0, credit: 170 },
  { account: "NIC payable", debit: 0, credit: 20 },
  { account: "Employee loan receivable", debit: 0, credit: 20 },
];
export type DemoReport = { title: string; headers: string[]; rows: (string | number)[][] };
export function demoReports(): DemoReport[] {
  const payrollHeaders = ["Employee", "Department", "Gross XCD", "NIC", "PAYE", "Loan", "Net XCD"];
  const payrollRow = [DEMO_EMPLOYEE.name, DEMO_EMPLOYEE.department, 200, 10, 0, 20, 170];
  return [
    { title: "Attendance", headers: ["Employee", "Date", "In (AST)", "Out (AST)", "Hours", "Location"], rows: [[DEMO_EMPLOYEE.name, "2026-10-26", "08:00", "16:00", 8, "Simulated: Castries, Saint Lucia"]] },
    { title: "Payroll summary", headers: payrollHeaders, rows: [payrollRow] },
    { title: "Departmental payroll", headers: payrollHeaders, rows: [payrollRow] },
    { title: "Consolidated payroll", headers: ["Staff", "Gross XCD", "Employee NIC", "Employer NIC", "PAYE", "Loans", "Net", "Employer cost"], rows: [[1, 200, 10, 10, 0, 20, 170, 210]] },
    { title: "Salary slip", headers: ["Employee", "Item", "XCD"], rows: [[DEMO_EMPLOYEE.name, "Basic: 8 hours x 25", 200], [DEMO_EMPLOYEE.name, "Employee NIC", -10], [DEMO_EMPLOYEE.name, "PAYE", 0], [DEMO_EMPLOYEE.name, "Loan repayment", -20], [DEMO_EMPLOYEE.name, "Net salary", 170]] },
    { title: "NIC and PAYE worksheet", headers: ["Employee", "Employee NIC", "Employer NIC", "PAYE", "Basis"], rows: [[DEMO_EMPLOYEE.name, 10, 10, 0, "Fictional test rates; not a statutory filing"]] },
    { title: "QuickBooks journal", headers: ["Account", "Debit XCD", "Credit XCD"], rows: demoJournal.map(row => [row.account, row.debit, row.credit]) },
  ];
}
export function demoEmail(state: DemoState) {
  if (!state.approved || !state.posted) return null;
  return { to: "external.accountant@example.invalid", cc: "demo.employee@example.invalid", subject: "SIMULATION — approved demo payroll, 26 October 2026", body: "Human in the Middle Administrator reviewed and approved Demo Employee’s fictional payroll. Gross XCD 200.00; employee NIC 10.00; PAYE 0.00; loan repayment 20.00; net 170.00. Employer cost XCD 210.00. Balanced QuickBooks journal simulated: debit/credit XCD 210.00. Reports attached in this demo preview. No money moved, email sent, statutory filing submitted or QuickBooks record created.", attachments: demoReports().map(report => `${report.title}.pdf`) };
}