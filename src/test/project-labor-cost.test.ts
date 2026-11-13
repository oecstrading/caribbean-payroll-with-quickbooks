import { describe, it, expect } from "vitest";
import { allocateLabor } from "@/lib/project-labor-cost";

describe("project labour cost", () => {
  it("splits approved gross + employer NIC by hours worked on each project", () => {
    const r = allocateLabor(
      [{ project_id: "P1", user_id: "u", log_date: "2026-11-05", hours: 30 }, { project_id: "P2", user_id: "u", log_date: "2026-11-06", hours: 10 }],
      [{ user_id: "u", gross_pay: 1900, employer_nic: 100, period_start: "2026-11-01", period_end: "2026-11-15" }],
    );
    expect(r.cost.P1).toBe(1500);
    expect(r.cost.P2).toBe(500);
  });
  it("never invents a rate for hours with no approved payroll", () => {
    const r = allocateLabor([{ project_id: "P1", user_id: "u", log_date: "2026-11-20", hours: 8 }], []);
    expect(r.cost.P1).toBeUndefined();
    expect(r.unpaidHours.P1).toBe(8);
  });
});
