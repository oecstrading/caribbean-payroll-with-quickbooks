import { describe, expect, it } from "vitest";
import { advanceDemo, demoEmail, demoJournal, demoLogin, demoPay, demoReports, emptyDemo, demoPayroll, demoDepartments, demoExceptions, resolveDemoException } from "@/lib/payroll-demo";
describe("isolated complex client payroll demonstration", () => {
  it("contains exactly five employees across four departments", () => {
    expect(demoPayroll).toHaveLength(5);
    expect(demoDepartments).toHaveLength(4);
    expect(demoDepartments.map(r => r.count)).toEqual([2, 1, 1, 1]);
  });
  it("has PAYE for some, not all employees", () => {
    expect(demoPayroll.map(r => r.paye)).toEqual([331.25, 0, 830, 393, 184]);
  });
  it("deducts NIC and additional deductions from every employee", () => {
    for (const r of demoPayroll) { expect(r.employeeNic).toBeGreaterThan(0); expect(r.loan + r.other).toBeGreaterThan(0); expect(r.net).toBeCloseTo(r.gross - r.deductions, 2); }
    expect(demoPayroll.map(r => r.net)).toEqual([3675, 1960.5, 5520, 3817, 3006]);
  });
  it("caps the final loan instalment at the remaining balance", () => {
    expect(demoPayroll[2].loanScheduled).toBe(250);
    expect(demoPayroll[2].loan).toBe(180);
    expect(demoPayroll[2].loanRemaining).toBe(0);
  });
  it("uses public fictional credentials with separate roles", () => {
    expect(demoLogin("demo.employee", "135790", "employee")).toBe(true);
    expect(demoLogin("demo.employee", "000000", "employee")).toBe(false);
    expect(demoLogin("demo.administrator", "246802", "admin")).toBe(true);
    expect(demoLogin("demo.employee", "135790", "admin")).toBe(false);
  });
  it("cannot prepare or post without the prior gates", () => {
    expect(advanceDemo(emptyDemo, "prepare").prepared).toBe(false);
    expect(advanceDemo(emptyDemo, "post").posted).toBe(false);
    expect(advanceDemo(emptyDemo, "deliver").delivered).toBe(false);
    expect(demoEmail(emptyDemo)).toBeNull();
  });
  it("blocks approval until every exception is resolved by a signed-in human", () => {
    expect(resolveDemoException(emptyDemo, "missing-punch", true).resolved).toEqual([]);
    let s = { ...emptyDemo, prepared: true, adminIn: true };
    expect(advanceDemo(s, "approve").approved).toBe(false);
    for (const flag of demoExceptions.slice(0, 2)) s = resolveDemoException(s, flag.id, true);
    expect(advanceDemo(s, "review").reviewed).toBe(false);
    s = resolveDemoException(s, "bank-details", true);
    s = advanceDemo(s, "review");
    s = resolveDemoException(s, "missing-punch", false);
    expect(advanceDemo(s, "approve").approved).toBe(false);
  });
  it("completes all stages and isolates each employee salary slip", () => {
    let s = emptyDemo;
    for (const action of ["employee-login", "clock-in", "clock-out", "prepare", "admin-login"] as const) s = advanceDemo(s, action);
    for (const flag of demoExceptions) s = resolveDemoException(s, flag.id, true);
    for (const action of ["review", "approve", "post", "deliver"] as const) s = advanceDemo(s, action);
    expect(s.delivered).toBe(true);
    const email = demoEmail(s);
    expect(email?.attachments).toHaveLength(13);
    expect(email?.employeeDeliveries).toHaveLength(5);
    for (const r of email?.employeeDeliveries ?? []) expect(r.attachment).toBe(`Salary slip - ${r.name}.pdf`);
    expect(demoReports().filter(r => r.title.startsWith("Salary slip"))).toHaveLength(5);
  });
  it("reconciles departments, consolidated totals and the balanced journal", () => {
    expect(demoPay.gross).toBe(21765);
    expect(demoPay.net).toBe(17978.5);
    expect(demoPay.employerCost).toBe(22853.25);
    expect(demoDepartments.reduce((s, r) => s + r.net, 0)).toBe(demoPay.net);
    expect(demoJournal.reduce((s, r) => s + r.debit, 0)).toBe(22853.25);
    expect(demoJournal.reduce((s, r) => s + r.credit, 0)).toBe(22853.25);
  });
});
