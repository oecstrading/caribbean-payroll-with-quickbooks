import { describe, it, expect } from "vitest";
import { roundShiftHours } from "./hours-rounding";
import { workedHours } from "./earned-pay";
describe("7.51-hour round up", () => {
  it("7.51 becomes 8", () => expect(roundShiftHours(7.51)).toBe(8));
  it("7.5 stays 7.5", () => expect(roundShiftHours(7.5)).toBe(7.5));
  it("8.25 is unchanged", () => expect(roundShiftHours(8.25)).toBe(8.25));
  it("applies to clocked shifts", () => expect(workedHours({ clock_in: "2026-11-10T08:00:00Z", clock_out: "2026-11-10T15:31:00Z", approved_hours: null })).toBe(8));
});
