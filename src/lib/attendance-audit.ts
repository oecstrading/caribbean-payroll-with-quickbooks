import { roundShiftHours, roundTimeUp } from "./hours-rounding";
import { attendanceConfirmed, type Confirmation } from "./attendance-details";
// Time & Attendance audit math. Rules: regular hours up to the employee's standard day,
// overtime (1.5x) beyond that, all Sunday hours double time (2.0x); late = more than 5 min after scheduled start.
export const LATE_GRACE_MIN = 15; // default company margin (minutes)

export interface ShiftIn extends Confirmation { clock_in: string | null; clock_out: string | null; scheduled_start: string | null; shift_date: string; break_minutes: number | null; lunch_out?: string | null; lunch_in?: string | null }

export function unconfirmedAbsence(s: ShiftIn, today = new Date().toISOString().slice(0, 10)) {
  return !s.clock_in && s.shift_date < today && !attendanceConfirmed(s);
}

export function splitHours(s: ShiftIn, stdDay = 8, graceMin = 0) {
  if (s.approved_hours == null && (!s.clock_in || !s.clock_out)) return { regular: 0, overtime: 0, double: 0 };
  const worked = s.approved_hours != null ? Number(s.approved_hours)
    : Math.max(0, (Date.parse(s.clock_out ?? "") - Date.parse(s.clock_in ?? "")) / 3_600_000 - (s.break_minutes ?? 0) / 60);
  const h = s.approved_hours != null ? roundTimeUp(worked) : roundShiftHours(roundTimeUp(worked));
  if (new Date(`${s.shift_date}T12:00:00`).getDay() === 0) return { regular: 0, overtime: 0, double: h };
  const regular = Math.min(h, stdDay);
  const extra = Math.round((h - regular) * 100) / 100;
  // Working up to the margin past the standard day is not overtime.
  if (extra * 60 <= graceMin) return { regular, overtime: 0, double: 0 };
  return { regular, overtime: extra, double: 0 };
}

/** Minutes after scheduled start, always tracked (0 when on time). */
export function lateMinutes(s: ShiftIn) {
  if (!s.clock_in || !s.scheduled_start) return 0;
  return Math.max(0, Math.round((new Date(s.clock_in).getTime() - new Date(s.scheduled_start).getTime()) / 60000));
}

/** Late only when beyond the company margin. */
export function isLate(s: ShiftIn, graceMin = LATE_GRACE_MIN) {
  return lateMinutes(s) > graceMin;
}

/** Minutes the lunch break ran over the allowed break. */
export function lunchOverMinutes(s: ShiftIn) {
  if (!s.lunch_out || !s.lunch_in) return 0;
  const taken = (new Date(s.lunch_in).getTime() - new Date(s.lunch_out).getTime()) / 60000;
  return Math.max(0, Math.round(taken - (s.break_minutes ?? 0)));
}

/** Cost of one missed day: monthly salary spread over working days in the month. */
export const dailyCost = (monthlySalary: number, workingDays = 22) => Math.round((monthlySalary / workingDays) * 100) / 100;
