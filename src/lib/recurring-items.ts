// Standing additions/deductions that repeat every payroll and must be confirmed per period.
export interface RecurringItem { key: string; userId: string; kind: "addition" | "deduction"; name: string; amount: number; frequency: string }
export type RecurringDecision = { action: "keep" } | { action: "zero" } | { action: "edit"; amount: number };

/** Bonuses and anything marked one-time are one-off; everything else (monthly, weekly, recurring…) repeats. */
export function isRecurringFrequency(frequency: string | null | undefined) {
  const f = (frequency || "").toLowerCase().replace(/[\s_]/g, "-");
  return f !== "" && f !== "one-time" && f !== "once" && f !== "one-off";
}

/** Amount used this period: kept (standard amount), zeroed, or the edited figure. */
export function periodAmount(decision: RecurringDecision | undefined, standard: number) {
  if (decision?.action === "zero") return 0;
  if (decision?.action === "edit") return Math.max(0, Math.round(decision.amount * 100) / 100);
  return standard;
}
