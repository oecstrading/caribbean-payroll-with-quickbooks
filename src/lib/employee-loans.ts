import { z } from "zod";

const money = z.number().finite().min(0).max(100000000).refine(n => Math.abs(n * 100 - Math.round(n * 100)) < 0.000001, "Use at most two decimal places");
export const loanSchema = z.object({
  employee: z.string().uuid(), creditor: z.string().uuid(),
  original: money.refine(n => n > 0), balance: money,
  monthly: money.refine(n => n > 0), notes: z.string().trim().max(500),
}).refine(v => v.balance <= v.original && v.monthly <= v.original, "Balance and repayment cannot exceed the original loan");

export function loanDeduction(balance: number, monthly: number, factor: number): number {
  if (![balance, monthly, factor].every(Number.isFinite) || balance < 0 || monthly < 0 || factor < 0) throw new Error("Invalid loan repayment");
  return Math.min(balance, Math.round((monthly * factor + Number.EPSILON) * 100) / 100);
}