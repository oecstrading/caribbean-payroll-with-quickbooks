import { describe, it, expect } from "vitest";
import { manualEarnings } from "./manual-hours";

const base = { rate: 0, monthlySalary: 0, stdHoursPerDay: 8, otRate: 1.5, factor: 1 };

describe("manual hours", () => {
  it("hourly staff are paid entered regular hours plus 1.5x overtime and 2x double time", () => {
    const r = manualEarnings({ ...base, basis: "Hourly", rate: 10 }, { regular: 160, overtime: 4, double_time: 2 });
    expect(r.basic).toBe(1600);
    expect(r.overtime).toBe(100);
  });
  it("salaried staff keep their salary and get overtime at salary ÷ (daily hours × 22)", () => {
    const r = manualEarnings({ ...base, basis: "Monthly", monthlySalary: 1760 }, { regular: 0, overtime: 2, double_time: 0 });
    expect(r.basic).toBe(1760);
    expect(r.overtime).toBe(30);
  });
  it("rejects negative hours", () => {
    expect(() => manualEarnings({ ...base, basis: "Hourly", rate: 10 }, { regular: -1, overtime: 0, double_time: 0 })).toThrow();
  });
});
