import { describe, it, expect } from "vitest";
import { isLate, lateMinutes, splitHours } from "./attendance-audit";
const base = { shift_date: "2026-11-11", break_minutes: 0, clock_out: null, scheduled_start: "2026-11-11T12:30:00Z" };
describe("15-minute clock margin", () => {
  it("8 min late is within margin but still tracked", () => {
    const s = { ...base, clock_in: "2026-11-11T12:38:00Z" };
    expect(isLate(s, 15)).toBe(false); expect(lateMinutes(s)).toBe(8);
  });
  it("16 min late is late", () => { expect(isLate({ ...base, clock_in: "2026-11-11T12:46:00Z" }, 15)).toBe(true); });
  it("up to 15 min past the standard day is not overtime", () => {
    const s = { ...base, clock_in: "2026-11-11T12:00:00Z", clock_out: "2026-11-11T20:15:00Z" };
    expect(splitHours(s, 8, 15).overtime).toBe(0);
    expect(splitHours({ ...s, clock_out: "2026-11-11T21:00:00Z" }, 8, 15).overtime).toBe(1);
  });
});
