import { calculatePayroll, type CountryTaxConfig, type CreditorDeduction, type PayrollAddition } from "@/lib/payroll-engine";

export type PayType = "monthly" | "semi_monthly" | "weekly" | "custom";
export const payTypeLabels: Record<PayType, string> = {
  monthly: "Monthly", semi_monthly: "Semi-monthly", weekly: "Weekly", custom: "Custom dates (final pay / dismissal)",
};

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parse = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const monthEnd = (s: string) => { const d = parse(s); return iso(new Date(d.getFullYear(), d.getMonth() + 1, 0)); };

/** Default dates for a pay type, anchored on a reference date (YYYY-MM-DD). */
export function defaultRange(type: PayType, ref: string, half: 1 | 2 = 1): { start: string; end: string } {
  const d = parse(ref);
  if (type === "monthly") { const start = iso(new Date(d.getFullYear(), d.getMonth(), 1)); return { start, end: monthEnd(start) }; }
  if (type === "semi_monthly") {
    return half === 1 ? { start: iso(new Date(d.getFullYear(), d.getMonth(), 1)), end: iso(new Date(d.getFullYear(), d.getMonth(), 15)) }
      : { start: iso(new Date(d.getFullYear(), d.getMonth(), 16)), end: monthEnd(ref) };
  }
  if (type === "weekly") { const end = new Date(d); end.setDate(d.getDate() + 6); return { start: iso(d), end: iso(end) }; }
  return { start: ref, end: ref };
}

export function workingDays(start: string, end: string): number {
  let n = 0; const d = parse(start); const e = parse(end);
  while (d <= e) { const w = d.getDay(); if (w !== 0 && w !== 6) n++; d.setDate(d.getDate() + 1); }
  return n;
}

/** Share of a month's salary paid for the period. Mirrors the server rule exactly. */
export function periodFactor(type: PayType, start: string, end: string): number {
  if (!start || !end || end < start) throw new Error("Choose a valid pay period");
  if (type === "monthly") { if (!start.endsWith("-01") || end !== monthEnd(start)) throw new Error("Monthly payroll must cover a full calendar month"); return 1; }
  if (type === "semi_monthly") {
    const ok = (start.endsWith("-01") && end === `${start.slice(0, 8)}15`) || (start.endsWith("-16") && end === monthEnd(start));
    if (!ok) throw new Error("Semi-monthly payroll must cover the 1st–15th or 16th–month end"); return 0.5;
  }
  if (type === "weekly") { if (Math.round((parse(end).getTime() - parse(start).getTime()) / 86400000) !== 6) throw new Error("Weekly payroll must cover 7 days"); return 12 / 52; }
  return workingDays(start, end) * 12 / 260;
}

export function periodLabel(type: PayType, start: string, end: string) {
  return type === "monthly" ? start.slice(0, 7) : `${start} to ${end}`;
}

/** Prorates salary and the statutory NIC ceiling / PAYE thresholds to the pay period. */
export function calculatePeriodPayroll(monthlySalary: number, factor: number, config: CountryTaxConfig,
  deductions: CreditorDeduction[] = [], additions: PayrollAddition[] = [], overtimePay = 0,
  options: { nicBasis?: "gross" | "basic"; fixedPaye?: number | null } = {}) {
  const scaled: CountryTaxConfig = { ...config,
    nic: { ...config.nic, maxContribution: config.nic.maxContribution * factor, monthlyCeiling: config.nic.monthlyCeiling * factor },
    paye: { annualAllowance: config.paye.annualAllowance * factor, brackets: config.paye.brackets.map(b => ({ ...b, min: b.min * factor, max: b.max * factor })) },
  };
  return calculatePayroll(Math.round(monthlySalary * factor * 100) / 100, scaled, overtimePay, deductions, additions, 0, 0,
    { ...options, fixedPaye: options.fixedPaye === null || options.fixedPaye === undefined ? options.fixedPaye : Math.round(options.fixedPaye * factor * 100) / 100 });
}
