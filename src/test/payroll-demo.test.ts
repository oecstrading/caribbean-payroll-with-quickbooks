import { describe, expect, it } from "vitest";
import { advanceDemo, demoEmail, demoJournal, demoLogin, demoPay, demoReports, emptyDemo } from "@/lib/payroll-demo";
describe("isolated client payroll demonstration", () => {
  it("uses the requested fictional employee and administrator", () => {
    expect(demoReports()[0].rows[0][0]).toBe("Demo Employee");
    expect(demoLogin("demo.employee", "135790", "employee")).toBe(true);
    expect(demoLogin("demo.employee", "000000", "employee")).toBe(false);
    expect(demoLogin("demo.administrator", "246802", "admin")).toBe(true);
    expect(demoLogin("demo.employee", "135790", "admin")).toBe(false);
  });
  it("cannot prepare before attendance or approve before human review", () => {
    expect(advanceDemo(emptyDemo, "prepare").prepared).toBe(false);
    expect(advanceDemo({ ...emptyDemo, prepared: true }, "approve").approved).toBe(false);
    expect(advanceDemo({ ...emptyDemo, prepared: true, adminIn: true }, "approve").approved).toBe(false);
  });
  it("cannot post or deliver an unapproved run", () => {
    expect(advanceDemo(emptyDemo, "post").posted).toBe(false);
    expect(advanceDemo(emptyDemo, "deliver").delivered).toBe(false);
    expect(demoEmail(emptyDemo)).toBeNull();
  });
  it("completes PIN to accountant delivery only through human approval", () => {
    let state = emptyDemo;
    for (const action of ["employee-login", "clock-in", "clock-out", "prepare", "admin-login", "review", "approve", "post", "deliver"] as const) state = advanceDemo(state, action);
    expect(state.delivered).toBe(true);
    expect(demoEmail(state)?.to).toBe("external.accountant@example.invalid");
    expect(demoEmail(state)?.attachments).toHaveLength(7);
  });
  it("reconciles fictional salary, loans, employer costs and the journal", () => {
    expect(demoPay.hours * 25).toBe(200);
    expect(demoPay.gross - demoPay.employeeNic - demoPay.paye - demoPay.loan).toBe(170);
    expect(demoPay.gross + demoPay.employerNic).toBe(210);
    expect(demoJournal.reduce((sum, row) => sum + row.debit, 0)).toBe(210);
    expect(demoJournal.reduce((sum, row) => sum + row.credit, 0)).toBe(210);
  });
});