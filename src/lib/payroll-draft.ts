// Keeps an unapproved Run Payroll session on this device so leaving the page never loses entered work.
import type { ManualHours } from "@/lib/manual-hours";
import type { PayEdit } from "@/lib/pay-edits";
import type { PayType } from "@/lib/pay-period";
import type { RecurringDecision } from "@/lib/recurring-items";

export interface PayrollDraft {
  userId: string | null;
  savedAt: string;
  currentStep: number;
  payType: PayType;
  range: { start: string; end: string };
  excluded: string[];
  notes: string;
  jurisdiction: string;
  selected: string[];
  manualMode: boolean;
  manualHours: Record<string, ManualHours>;
  edits: Record<string, PayEdit>;
  decisions?: Record<string, RecurringDecision>;
}

const KEY = "run-payroll-draft-v1";

export function loadPayrollDraft(): PayrollDraft | null {
  try { const raw = localStorage.getItem(KEY); return raw ? (JSON.parse(raw) as PayrollDraft) : null; } catch { return null; }
}
export function savePayrollDraft(d: PayrollDraft) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* storage full */ } }
export function clearPayrollDraft() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }
export function hasDraftWork(d: Pick<PayrollDraft, "manualHours" | "edits" | "notes" | "manualMode" | "decisions">) {
  return d.manualMode || Boolean(d.notes) || Object.keys(d.manualHours).length > 0 || Object.keys(d.edits).length > 0 || Object.keys(d.decisions || {}).length > 0;
}
