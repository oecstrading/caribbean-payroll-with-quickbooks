import { roundShiftHours } from "./hours-rounding";
// Time & Attendance audit math. Rules: regular hours up to the employee's standard day,
// overtime (1.5x) beyond that, all Sunday hours double time (2.0x); late = more than 5 min after scheduled start.
export const LATE_GRACE_MIN = 5;

export interface ShiftIn { clock_in: string | null; clock_out: string | null; scheduled_start: string | null; shift_date: string; break_minutes: number | null; approved_hours?: number | null }

export function splitHours(s: ShiftIn, stdDay = 8) {
  if (!s.clock_in || !s.clock_out) return { regular: 0, overtime: 0, double: 0 };
  const worked = s.approved_hours != null ? Number(s.approved_hours)
    : Math.max(0, (new Date(s.clock_out).getTime() - new Date(s.clock_in).getTime()) / 3_600_000 - (s.break_minutes ?? 0) / 60);
  const h = roundShiftHours(Math.round(worked * 100) / 100);
  if (new Date(`${s.shift_date}T12:00:00`).getDay() === 0) return { regular: 0, overtime: 0, double: h };
  const regular = Math.min(h, stdDay);
  return { regular, overtime: Math.round((h - regular) * 100) / 100, double: 0 };
}

export function isLate(s: ShiftIn) {
  if (!s.clock_in || !s.scheduled_start) return false;
  return new Date(s.clock_in).getTime() - new Date(s.scheduled_start).getTime() > LATE_GRACE_MIN * 60_000;
}

/** Cost of one missed day: monthly salary spread over working days in the month. */
export const dailyCost = (monthlySalary: number, workingDays = 22) => Math.round((monthlySalary / workingDays) * 100) / 100;
