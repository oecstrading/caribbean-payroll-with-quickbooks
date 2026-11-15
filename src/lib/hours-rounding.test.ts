import { describe, it, expect } from "vitest";
import { roundShiftHours, roundTimeUp, reviewedHours } from "./hours-rounding";
import { workedHours } from "./earned-pay";
describe("7.51-hour round up", () => {
  it("7.51 becomes 8", () => expect(roundShiftHours(7.51)).toBe(8));
  it("7.5 stays 7.5", () => expect(roundShiftHours(7.5)).toBe(7.5));
  it("8.25 is unchanged", () => expect(roundShiftHours(8.25)).toBe(8.25));
  it("applies to clocked shifts", () => expect(workedHours({ clock_in: "2026-11-10T08:00:00Z", clock_out: "2026-11-10T15:31:00Z", approved_hours: null })).toBe(8));
});

describe("reviewed time rounding", () => {
  it("rounds 7.9247 upward to 7.93", () => expect(reviewedHours(7.9247)).toBe(7.93));
  it("rounds to 8 only when checked", () => expect(reviewedHours(7.9247, true)).toBe(8));
  it("rounds fractional minutes upward", () => expect(roundTimeUp(7.9247 * 60)).toBe(475.49));
  it("keeps exact hundredths unchanged", () => expect(reviewedHours(8.01)).toBe(8.01));
  it("does not turn zero into a payable hour", () => expect(reviewedHours(0, true)).toBe(0));
  it("preserves reviewed hours in earned pay", () => expect(workedHours({clock_in: null, clock_out: null, approved_hours: 7.93})).toBe(7.93));
  it("rejects hours above 24", () => expect(() => reviewedHours(24.01)).toThrow());
});
