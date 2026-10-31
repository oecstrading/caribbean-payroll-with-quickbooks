export type PayPreview = { hours: number; regular: number; overtime: number; pending: number; shifts: number; multiplier: number; pay_frequency: string; pay_rate: number; monthly_salary: number };

/** Rough gross estimate shown to staff before approval; payroll approval stays the source of truth. */
export function estimateDraftPay(p: PayPreview, start: string, end: string): number | null {
  const rate = Number(p.pay_rate) || 0;
  const round = (n: number) => Math.round(n * 100) / 100;
  if (p.pay_frequency === "Hourly" && rate > 0) return round(Number(p.regular) * rate + Number(p.overtime) * rate * Number(p.multiplier || 1.5));
  if (p.pay_frequency === "Daily" && rate > 0) return round(Number(p.shifts) * rate);
  if (Number(p.monthly_salary) > 0) {
    const days = (Date.parse(end) - Date.parse(start)) / 86400000 + 1;
    const inMonth = new Date(new Date(start).getUTCFullYear(), new Date(start).getUTCMonth() + 1, 0).getDate();
    return round(Number(p.monthly_salary) * Math.min(1, days / inMonth));
  }
  return null;
}
