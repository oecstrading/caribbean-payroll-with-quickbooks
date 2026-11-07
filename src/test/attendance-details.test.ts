import { describe, it, expect } from "vitest";
import { matchesAttendanceDetail } from "@/lib/attendance-details";
const shift = { clock_in: "2026-11-07T08:00:00Z", clock_out: null, scheduled_start: "2026-11-07T08:00:00Z", scheduled_end: "2026-11-07T16:00:00Z", approved_hours: null };
describe("attendance card details", () => {
  it("on-clock lists open shifts only", () => {
    expect(matchesAttendanceDetail(shift, "on-clock")).toBe(true);
    expect(matchesAttendanceDetail({ ...shift, clock_out: "2026-11-07T16:00:00Z" }, "on-clock")).toBe(false);
  });
  it("missing punches exclude shifts that have not ended", () => {
    expect(matchesAttendanceDetail(shift, "missing", Date.parse("2026-11-07T15:00:00Z"))).toBe(false);
    expect(matchesAttendanceDetail(shift, "missing", Date.parse("2026-11-07T17:00:00Z"))).toBe(true);
  });
  it("late details use the five-minute grace period", () => {
    expect(matchesAttendanceDetail({ ...shift, clock_in: "2026-11-07T08:05:00Z" }, "late")).toBe(false);
    expect(matchesAttendanceDetail({ ...shift, clock_in: "2026-11-07T08:06:00Z" }, "late")).toBe(true);
  });
});