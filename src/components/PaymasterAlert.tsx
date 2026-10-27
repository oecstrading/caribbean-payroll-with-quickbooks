import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Bot, BellRing } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export function usePaymasterDraft() {
  return useQuery({
    queryKey: ["paymaster-draft"],
    queryFn: async () => {
      const { data } = await supabase.from("paymaster_drafts").select("*").order("period_start", { ascending: false }).limit(1).maybeSingle();
      return data;
    },
    refetchInterval: 5 * 60_000,
  });
}

/** Dashboard reminder shown to payroll managers until the period's payroll is approved. */
export default function PaymasterAlert() {
  const navigate = useNavigate();
  const { data: draft } = usePaymasterDraft();
  if (!draft || draft.status !== "awaiting_review") return null;
  const flags = Array.isArray(draft.flags) ? draft.flags.length : 0;
  return (
    <div className="rounded-2xl border-2 border-accent bg-accent/10 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex items-center gap-3 flex-1">
        <div className="h-11 w-11 shrink-0 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
          {draft.reminder_count > 0 ? <BellRing className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
        </div>
        <div>
          <p className="font-semibold text-foreground">AI Paymaster: payroll for {draft.period_start.slice(0, 7)} is ready for your review</p>
          <p className="text-sm text-muted-foreground">
            Pay date {draft.pay_date} · {draft.employee_count} staff · {flags} issue{flags === 1 ? "" : "s"} flagged
            {draft.reminder_count > 0 ? ` · reminder ${draft.reminder_count}` : ""}
          </p>
        </div>
      </div>
      <Button className="min-h-11" onClick={() => navigate("/ai-paymaster")}>Review now</Button>
    </div>
  );
}
