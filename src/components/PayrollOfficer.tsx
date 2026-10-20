import { useEffect, useRef, useState } from "react";
import { BriefcaseBusiness, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { anonymousReviewRows } from "@/lib/payroll-review";

interface Props { payload: { source: "live" | "sample"; payType: string; start: string; end: string; jurisdiction: string; rows: ReturnType<typeof anonymousReviewRows> }; allowed: boolean }
export default function PayrollOfficer({ payload, allowed }: Props) {
  const [review, setReview] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; controller.current?.abort(); }; }, []);
  const run = async () => {
    if (busy) return;
    const abort = new AbortController(); controller.current = abort;
    setBusy(true); setReview(""); setError("");
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("payroll-officer", { body: payload, signal: abort.signal });
      if (invokeError) {
        let message = "AI review is unavailable. No payroll was changed.";
        if (invokeError.context instanceof Response) { const details = await invokeError.context.json().catch(() => null); if (typeof details?.error === "string") message = details.error; }
        throw new Error(message);
      }
      if (typeof data?.review !== "string") throw new Error("No review returned. Review payroll manually.");
      if (alive.current && !abort.signal.aborted) setReview(data.review);
    } catch (e) { if (alive.current && !abort.signal.aborted) setError(e instanceof Error ? e.message : "Review unavailable."); }
    finally { if (alive.current) setBusy(false); }
  };
  return <section className="border-y border-border py-5 space-y-4" aria-label="AI Payroll Officer">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="font-display font-semibold flex items-center gap-2 text-foreground"><BriefcaseBusiness className="text-primary h-5 w-5" /> AI Payroll Officer</h2>
      <div className="flex gap-2">
        {busy && <Button variant="outline" onClick={() => { controller.current?.abort(); setBusy(false); setError("Review stopped. No payroll was changed."); }}>Stop</Button>}
        <Button onClick={run} disabled={!allowed || busy || !payload.rows.length || payload.rows.length > 1000}>{busy ? <Loader2 className="animate-spin" /> : <BriefcaseBusiness />}{busy ? "Reviewing…" : review ? "Review again" : "Review this payroll"}</Button>
      </div>
    </div>
    <p className="text-sm text-muted-foreground">Advisory only · Anonymous amounts and flags sent to AI · Manager approval required</p>
    {busy && <p role="status" className="text-sm text-muted-foreground">Reviewing the current draft…</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {review && <div className="space-y-3 text-sm text-foreground break-words overflow-x-auto [&_h2]:font-semibold [&_h2]:mt-4 [&_h3]:font-semibold [&_h3]:mt-4 [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1 [&_td]:border-b [&_td]:border-border [&_td]:p-2 [&_th]:p-2 [&_th]:text-left" data-testid="payroll-officer-review"><ReactMarkdown remarkPlugins={[remarkGfm]}>{review}</ReactMarkdown></div>}
  </section>;
}