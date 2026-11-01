import { describe, it, expect } from "vitest";
import { splitHours, isLate, dailyCost } from "@/lib/attendance-audit";

describe("attendance audit", () => {
  it("weekday hours beyond 8 are overtime", () => {
    expect(splitHours({ shift_date: "2026-10-28", clock_in: "2026-10-28T08:00:00Z", clock_out: "2026-10-28T19:00:00Z", scheduled_start: null, break_minutes: 60 })).toEqual({ regular: 8, overtime: 2, double: 0 });
  });
  it("Sunday hours are double time", () => {
    expect(splitHours({ shift_date: "2026-11-01", clock_in: "2026-11-01T08:00:00Z", clock_out: "2026-11-01T12:00:00Z", scheduled_start: null, break_minutes: 0 }).double).toBe(4);
  });
  it("late only after the 5-minute grace", () => {
    const base = { shift_date: "2026-10-28", clock_out: null, break_minutes: 0, scheduled_start: "2026-10-28T08:00:00Z" };
    expect(isLate({ ...base, clock_in: "2026-10-28T08:05:00Z" })).toBe(false);
    expect(isLate({ ...base, clock_in: "2026-10-28T08:06:00Z" })).toBe(true);
  });
  it("absence costs salary / 22 days", () => { expect(dailyCost(2200)).toBe(100); });
});
