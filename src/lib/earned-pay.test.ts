import { describe, it, expect } from "vitest";
import { hourlyRate, workedHours, earnedPay } from "./earned-pay";
describe("earned pay", () => {
  it("converts monthly salary to hourly at 40h/week", () => { expect(hourlyRate(2080, 40)).toBeCloseTo(12, 5); });
  it("uses clock in/out when hours not approved", () => {
    expect(workedHours({ clock_in: "2026-11-10T10:00:00Z", clock_out: "2026-11-10T14:00:00Z", approved_hours: null, break_minutes: 30 })).toBeCloseTo(3.5);
  });
  it("pays approved hours × rate", () => { expect(earnedPay({ clock_in: null, clock_out: null, approved_hours: 5 }, 12)).toBe(60); });
  it("open shift earns nothing yet", () => { expect(workedHours({ clock_in: "2026-11-10T10:00:00Z", clock_out: null, approved_hours: null })).toBe(0); });
});
