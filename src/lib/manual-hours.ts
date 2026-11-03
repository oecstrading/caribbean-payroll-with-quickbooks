// Manually entered hours for a payroll period (used instead of clock punches).
// Must mirror public.validate_manual_pay on the server.
export interface ManualHours { regular: number; overtime: number; double_time: number }

const r2 = (n: number) => Math.round(n * 100) / 100;

export function manualEarnings(opts: { basis: string; rate: number; monthlySalary: number; stdHoursPerDay: number; otRate: number; factor: number }, h: ManualHours) {
  const { basis, rate, monthlySalary, factor } = opts;
  const std = opts.stdHoursPerDay > 0 ? opts.stdHoursPerDay : 8;
  if ([h.regular, h.overtime, h.double_time].some(v => !Number.isFinite(v) || v < 0)) throw new Error("Entered hours are not valid");
  let hourly: number; let basic: number;
  if (basis === "Hourly") { hourly = rate; basic = r2(rate * h.regular); }
  else if (basis === "Daily") { hourly = rate / std; basic = r2(hourly * h.regular); }
  else { hourly = monthlySalary / (std * 22); basic = r2(monthlySalary * factor); }
  const mult = opts.otRate > 0 ? opts.otRate : 1.5;
  return { basic, overtime: r2(hourly * h.overtime * mult + hourly * h.double_time * 2), hourly, hoursBased: basis === "Hourly" || basis === "Daily" };
}
