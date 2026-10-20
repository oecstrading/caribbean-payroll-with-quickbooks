import { describe, expect, it } from "vitest";
import { calculatePeriodPayroll, defaultRange, periodFactor, workingDays } from "@/lib/pay-period";
import { ST_LUCIA_CONFIG } from "@/lib/payroll-engine";

describe("flexible pay periods", () => {
  it("monthly pays the full month salary", () => expect(periodFactor("monthly", "2026-11-01", "2026-11-30")).toBe(1));
  it("semi-monthly pays half the month", () => {
    expect(periodFactor("semi_monthly", "2026-11-16", "2026-11-30")).toBe(0.5);
    expect(defaultRange("semi_monthly", "2026-02-01", 2)).toEqual({ start: "2026-02-16", end: "2026-02-28" });
  });
  it("weekly pays 12/52 of a month", () => expect(periodFactor("weekly", "2026-11-02", "2026-11-08")).toBeCloseTo(12 / 52));
  it("custom range pays working days at monthly × 12 / 260", () => {
    expect(workingDays("2026-11-02", "2026-11-11")).toBe(8);
    expect(calculatePeriodPayroll(2600, periodFactor("custom", "2026-11-02", "2026-11-11"), ST_LUCIA_CONFIG).basicPay).toBe(960);
  });
  it("rejects a partial month as monthly", () => expect(() => periodFactor("monthly", "2026-11-01", "2026-11-20")).toThrow());
});
