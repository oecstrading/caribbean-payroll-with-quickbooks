// Staff clock reminders: 5 minutes before shift start/end, and a missing-punch alarm
// once the shift start/end has passed by 5 minutes without the matching punch.
// Shift times are company-local wall-clock times compared against the device clock.
export const REMIND_BEFORE_MIN = 5;
export const MISSING_AFTER_MIN = 5;

export interface ClockSchedule { start: string; end: string; days: number[] }
export type ReminderKind = "before_in" | "before_out" | "missing_in" | "missing_out";

const at = (day: Date, hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); const d = new Date(day); d.setHours(h, m, 0, 0); return d; };

/** Returns the reminder due at `now`, if any. `next` is the punch the employee still owes. */
export function dueReminder(s: ClockSchedule, now: Date, next: "clock_in" | "clock_out"): { kind: ReminderKind; key: string } | null {
  if (!s.days.includes(now.getDay())) return null;
  const start = at(now, s.start); let end = at(now, s.end);
  if (end <= start) end = new Date(end.getTime() + 86_400_000);
  const min = (d: Date) => (now.getTime() - d.getTime()) / 60_000;
  const day = now.toISOString().slice(0, 10);
  if (next === "clock_in") {
    if (min(start) >= -REMIND_BEFORE_MIN && min(start) < 0) return { kind: "before_in", key: `${day}:before_in` };
    if (min(start) >= MISSING_AFTER_MIN && now < end) return { kind: "missing_in", key: `${day}:missing_in` };
  } else {
    if (min(end) >= -REMIND_BEFORE_MIN && min(end) < 0) return { kind: "before_out", key: `${day}:before_out` };
    if (min(end) >= MISSING_AFTER_MIN && min(end) < 12 * 60) return { kind: "missing_out", key: `${day}:missing_out` };
  }
  return null;
}

export const REMINDER_TEXT: Record<ReminderKind, string> = {
  before_in: "Your shift starts in 5 minutes. Remember to clock in.",
  before_out: "Your shift ends in 5 minutes. Remember to clock out.",
  missing_in: "Missing punch: you haven't clocked in for today's shift.",
  missing_out: "Missing punch: you haven't clocked out yet.",
};
