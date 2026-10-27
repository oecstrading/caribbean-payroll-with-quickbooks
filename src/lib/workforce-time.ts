import { z } from "zod";
export const clockRulesSchema = z.object({ timezone: z.string().min(1), basis: z.enum(["daily", "weekly"]), threshold: z.coerce.number().positive(), multiplier: z.coerce.number().min(1).max(5), payroll: z.boolean() }).refine(v => v.threshold <= (v.basis === "daily" ? 24 : 168), "Overtime threshold exceeds available hours");
export interface PayHours { hours: number; regular: number; overtime: number; pending: number; shifts: number; multiplier: number; enabled: boolean }
export function scheduledHours(start: string | null, end: string | null, breakMinutes: number) {
  if (!start || !end) return null;
  return Math.max(0, Math.round(((Date.parse(end) - Date.parse(start)) / 3600000 - breakMinutes / 60) * 100) / 100);
}
export function splitHours(hours: number[], basis: "daily" | "weekly", threshold: number) {
  if (hours.some(h => !Number.isFinite(h) || h < 0) || !Number.isFinite(threshold) || threshold <= 0) throw new Error("Invalid hours");
  const total = hours.reduce((a, h) => a + h, 0);
  const overtime = basis === "daily" ? hours.reduce((a, h) => a + Math.max(0, h - threshold), 0) : Math.max(0, total - threshold);
  return { regular: total - overtime, overtime };
}
export function attendanceEarnings(rate: number, basis: string, dailyHours: number, h: PayHours) {
  if (h.pending || !h.shifts) throw new Error("Attendance review required");
  if (rate <= 0 || !Number.isFinite(rate) || basis === "Daily" && dailyHours <= 0) throw new Error("Valid rate and hours required");
  const hourly = basis === "Daily" ? rate / dailyHours : rate;
  return { basic: Math.round(hourly * h.regular * 100) / 100, overtime: Math.round(hourly * h.overtime * h.multiplier * 100) / 100, hourly };
}