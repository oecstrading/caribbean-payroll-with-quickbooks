// Keeps an unapproved Run Payroll session for the company so leaving the page never loses entered work.
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
// The company's shared draft lives on the server so every admin/Pay Master sees the same figures.
let sharedOrg: string | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
export async function syncSharedPayrollDraft(): Promise<void> {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data: org } = await supabase.rpc("current_org_id");
  sharedOrg = (org as string | null) ?? null;
  if (!sharedOrg) return;
  const { data, error } = await supabase.from("payroll_run_drafts").select("draft").eq("org_id", sharedOrg).maybeSingle();
  if (error) return;
  try { if (data?.draft) localStorage.setItem(KEY, JSON.stringify(data.draft)); else localStorage.removeItem(KEY); } catch { /* ignore */ }
}
export function savePayrollDraft(d: PayrollDraft) {
  try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* storage full */ }
  if (!sharedOrg) return;
  const org = sharedOrg; clearTimeout(timer);
  timer = setTimeout(async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    await supabase.from("payroll_run_drafts").upsert({ org_id: org, draft: d as never, updated_by: d.userId, updated_at: new Date().toISOString() });
  }, 800);
}
export function clearPayrollDraft() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  clearTimeout(timer);
  if (sharedOrg) { const org = sharedOrg; void import("@/integrations/supabase/client").then(({ supabase }) => supabase.from("payroll_run_drafts").delete().eq("org_id", org)); }
}
export function hasDraftWork(d: Pick<PayrollDraft, "manualHours" | "edits" | "notes" | "manualMode" | "decisions">) {
  return d.manualMode || Boolean(d.notes) || Object.keys(d.manualHours).length > 0 || Object.keys(d.edits).length > 0 || Object.keys(d.decisions || {}).length > 0;
}
