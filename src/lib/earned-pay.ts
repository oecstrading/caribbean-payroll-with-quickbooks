import { roundShiftHours } from "./hours-rounding";
/** Hourly rate from a monthly salary equivalent: monthly × 12 ÷ (52 × weekly hours). */
export function hourlyRate(monthlySalary: number | null | undefined, weeklyHours?: number | null): number {
  const m = Number(monthlySalary) || 0; const w = Number(weeklyHours) > 0 ? Number(weeklyHours) : 40;
  return m > 0 ? (m * 12) / (52 * w) : 0;
}
type ShiftLike = { clock_in: string | null; clock_out: string | null; approved_hours: number | null; break_minutes?: number | null };
/** Hours worked: approved hours when set, otherwise clock-out minus clock-in less unpaid break. */
export function workedHours(s: ShiftLike, now = new Date()): number {
  if (s.approved_hours != null) return roundShiftHours(Number(s.approved_hours));
  if (!s.clock_in) return 0;
  const end = s.clock_out ? new Date(s.clock_out) : null;
  if (!end) return 0;
  const h = (end.getTime() - new Date(s.clock_in).getTime()) / 3600000 - (Number(s.break_minutes) || 0) / 60;
  void now; return roundShiftHours(Math.max(0, h));
}
export const earnedPay = (s: ShiftLike, rate: number) => Math.round(workedHours(s) * rate * 100) / 100;
