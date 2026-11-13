import { describe, it, expect } from "vitest";
import { pairShifts, hoursOn } from "@/lib/roster-hours";

describe("roster hours", () => {
  it("counts an 18:00–06:00 overnight shift on the clock-in day", () => {
    const s = pairShifts([
      { user_id: "u", punch_type: "clock_in", punched_at: new Date(2026, 10, 10, 18).toISOString(), site_id: "A" },
      { user_id: "u", punch_type: "clock_out", punched_at: new Date(2026, 10, 11, 6).toISOString(), site_id: "A" },
    ]);
    expect(hoursOn(s, "u", new Date(2026, 10, 10))).toBe(12);
    expect(hoursOn(s, "u", new Date(2026, 10, 11))).toBe(0);
  });
  it("does not show one site's hours under another site", () => {
    const s = pairShifts([
      { user_id: "u", punch_type: "clock_in", punched_at: new Date(2026, 10, 10, 8).toISOString(), site_id: "A" },
      { user_id: "u", punch_type: "clock_out", punched_at: new Date(2026, 10, 10, 16).toISOString(), site_id: "A" },
    ]);
    expect(hoursOn(s, "u", new Date(2026, 10, 10), "A")).toBe(8);
    expect(hoursOn(s, "u", new Date(2026, 10, 10), "B")).toBe(0);
  });
});
