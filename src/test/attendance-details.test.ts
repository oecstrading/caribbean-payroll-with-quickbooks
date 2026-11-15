import { describe, it, expect } from "vitest";
import { matchesAttendanceDetail, manuallyConfirmed } from "@/lib/attendance-details";
const shift = { clock_in: "2026-11-07T08:00:00Z", clock_out: null, scheduled_start: "2026-11-07T08:00:00Z", scheduled_end: "2026-11-07T16:00:00Z", approved_hours: null };
describe("attendance card details", () => {
  it("identifies manual reviews even when both punch times exist", () => {
    expect(manuallyConfirmed({ ...shift, review_status: "reviewed" })).toBe(true);
    expect(manuallyConfirmed({ approved_hours: 8, review_status: "pending" })).toBe(false);
  });
  it("on-clock lists open shifts only", () => {
    expect(matchesAttendanceDetail(shift, "on-clock")).toBe(true);
    expect(matchesAttendanceDetail({ ...shift, clock_out: "2026-11-07T16:00:00Z" }, "on-clock")).toBe(false);
  });
  it("missing punches exclude shifts that have not ended", () => {
    expect(matchesAttendanceDetail(shift, "missing", Date.parse("2026-11-07T15:00:00Z"))).toBe(false);
    expect(matchesAttendanceDetail(shift, "missing", Date.parse("2026-11-07T17:00:00Z"))).toBe(true);
  });
  it("manually confirmed missing punches leave missing, review and on-clock totals", () => {
    const confirmed = { ...shift, approved_hours: 8, review_status: "reviewed", reviewed_at: "2026-11-08T09:00:00Z" };
    expect(matchesAttendanceDetail(confirmed, "missing")).toBe(false);
    expect(matchesAttendanceDetail(confirmed, "review")).toBe(false);
    expect(matchesAttendanceDetail(confirmed, "on-clock")).toBe(false);
    expect(matchesAttendanceDetail(confirmed, "complete")).toBe(true);
  });
  it("zero confirmed hours are still confirmed and not missing", () => {
    expect(matchesAttendanceDetail({ ...shift, clock_in: null, approved_hours: 0 }, "missing")).toBe(false);
  });
  it("all three unconfirmed ended shifts count as missing, including recorded pairs", () => {
    expect(matchesAttendanceDetail(shift, "missing")).toBe(true);
    const rows = [shift, { ...shift, clock_out: "2026-11-07T16:00:00Z" }, { ...shift, clock_out: "2026-11-07T12:00:00Z" }];
    expect(rows.filter(s => matchesAttendanceDetail(s, "missing")).length).toBe(3);
    expect(matchesAttendanceDetail(rows[1], "complete")).toBe(false);
  });
  it("late details use the five-minute grace period", () => {
    expect(matchesAttendanceDetail({ ...shift, clock_in: "2026-11-07T08:05:00Z" }, "late")).toBe(false);
    expect(matchesAttendanceDetail({ ...shift, clock_in: "2026-11-07T08:06:00Z" }, "late")).toBe(true);
  });
});