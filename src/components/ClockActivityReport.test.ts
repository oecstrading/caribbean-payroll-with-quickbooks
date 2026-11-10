import { describe, it, expect } from "vitest";
import { workedHours } from "./ClockActivityReport";
const p = (t: string, direction: string) => ({ id: t, punched_at: `2026-11-10T${t}:00Z`, direction, mode: "pin", employee_id: "e", device_id: null, captured_offline: false });
describe("workedHours", () => {
  it("excludes the lunch break", () => {
    expect(workedHours([p("08:00", "clock_in"), p("12:00", "lunch_out"), p("13:00", "lunch_in"), p("17:00", "clock_out")])).toBe(8);
  });
});
