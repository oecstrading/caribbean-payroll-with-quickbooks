import { describe, it, expect } from "vitest";
import { dueReminder } from "@/lib/clock-reminders";

const s = { start: "08:00", end: "16:00", days: [1, 2, 3, 4, 5] };
const wed = (h: number, m: number) => new Date(2026, 9, 28, h, m);

describe("clock reminders", () => {
  it("reminds 5 minutes before start", () => { expect(dueReminder(s, wed(7, 55), "clock_in")?.kind).toBe("before_in"); });
  it("no reminder 6 minutes before start", () => { expect(dueReminder(s, wed(7, 54), "clock_in")).toBeNull(); });
  it("reminds 5 minutes before end", () => { expect(dueReminder(s, wed(15, 56), "clock_out")?.kind).toBe("before_out"); });
  it("missing clock-in alarm 5 minutes after start", () => { expect(dueReminder(s, wed(8, 5), "clock_in")?.kind).toBe("missing_in"); });
  it("missing clock-out alarm 5 minutes after end", () => { expect(dueReminder(s, wed(16, 5), "clock_out")?.kind).toBe("missing_out"); });
  it("no alarms on days off", () => { expect(dueReminder(s, new Date(2026, 10, 1, 7, 56), "clock_in")).toBeNull(); });
});
