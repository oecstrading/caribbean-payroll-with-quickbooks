import { periodFactor, workingDays, type PayType } from "@/lib/pay-period";

export interface ForecastLine { name: string; gross: number; employeeNic: number; employerNic: number; paye: number; otherDeductions: number; net: number }
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Share of a month a saved run covered; falls back to working days when dates don't fit the strict pay-type rule. */
export function runFactor(payType: string, start: string | null, end: string | null): number {
  if (!start || !end) return payType === "semi_monthly" ? 0.5 : payType === "weekly" ? 12 / 52 : 1;
  try { return periodFactor(payType as PayType, start, end); } catch { return workingDays(start, end) * 12 / 260; }
}

/** Estimate a future period by scaling the last payroll's per-employee figures by the ratio of period lengths. Estimate only — never saved. */
export function estimatePayroll(lines: ForecastLine[], lastFactor: number, targetFactor: number): ForecastLine[] {
  const k = lastFactor > 0 ? targetFactor / lastFactor : 1;
  return lines.map(l => {
    const gross = r2(l.gross * k), employeeNic = r2(l.employeeNic * k), employerNic = r2(l.employerNic * k), paye = r2(l.paye * k), otherDeductions = r2(l.otherDeductions * k);
    return { name: l.name, gross, employeeNic, employerNic, paye, otherDeductions, net: r2(gross - employeeNic - paye - otherDeductions) };
  });
}
