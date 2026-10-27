import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ReactMarkdownless from "react";
import { Bot, Sparkles, AlertTriangle, TrendingUp, TrendingDown, Clock, Landmark, Users, CheckCircle2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useRole } from "@/hooks/useRole";
import { usePaymasterDraft } from "@/components/PaymasterAlert";

void ReactMarkdownless;
const money = (n: number | null | undefined) => n == null ? "—" : `XCD ${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
type Flag = { severity: string; title: string; detail: string };
type Suggestion = { action: string; path: string };

export default function AiPaymasterPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { isAdmin } = useRole() as { isAdmin?: boolean };
  const { data: draft, isLoading } = usePaymasterDraft();
  const [running, setRunning] = useState(false);
  const { data: settings } = useQuery({
    queryKey: ["paymaster-settings"],
    queryFn: async () => (await supabase.from("paymaster_settings").select("*").maybeSingle()).data,
  });
  const [payDay, setPayDay] = useState<string>("");

  const runNow = async () => {
    setRunning(true);
    const { data, error } = await supabase.functions.invoke("ai-paymaster", { body: {} });
    setRunning(false);
    if (error || data?.error) return toast({ title: "AI Paymaster unavailable", description: data?.error ?? "No payroll was changed. Try again later.", variant: "destructive" });
    qc.invalidateQueries({ queryKey: ["paymaster-draft"] }); qc.invalidateQueries({ queryKey: ["paymaster-settings"] });
    toast({ title: "Draft refreshed", description: "The AI Paymaster re-checked this period's payroll." });
  };

  const savePayDay = async () => {
    const day = Number(payDay);
    if (!settings || !(day >= 1 && day <= 28)) return toast({ title: "Pick a day from 1 to 28", variant: "destructive" });
    const { error } = await supabase.from("paymaster_settings").update({ pay_day: day, updated_at: new Date().toISOString() }).eq("org_id", settings.org_id);
    if (error) return toast({ title: "Could not save", description: error.message, variant: "destructive" });
    qc.invalidateQueries({ queryKey: ["paymaster-settings"] });
    toast({ title: "Pay day saved" });
  };

  const flags = (draft?.flags as Flag[] | null) ?? [];
  const suggestions = (draft?.suggestions as Suggestion[] | null) ?? [];
  const up = (draft?.change_pct ?? 0) >= 0;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl p-6 bg-gradient-to-br from-primary via-secondary to-accent text-primary-foreground">
        <div className="flex items-center gap-3"><Bot className="h-8 w-8" /><h1 className="text-2xl font-bold">AI Paymaster</h1></div>
        <p className="mt-2 max-w-2xl opacity-95">Watches hours, punches, loans and pay changes every day, prepares this period's payroll, and reminds you until you approve. You stay in control — the AI never pays or approves on its own.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" className="min-h-11" onClick={runNow} disabled={running}><RefreshCw className={`h-4 w-4 mr-2 ${running ? "animate-spin" : ""}`} />{running ? "Checking…" : "Re-check now"}</Button>
          <Button variant="secondary" className="min-h-11" onClick={() => navigate("/payroll")}><CheckCircle2 className="h-4 w-4 mr-2" />Review & approve payroll</Button>
        </div>
      </div>

      {settings?.paused_reason && <Card className="border-destructive"><CardContent className="p-4 text-sm">AI briefings paused: {settings.paused_reason}. Monitoring figures still update; payroll can be reviewed manually.</CardContent></Card>}

      {isLoading ? <p className="text-muted-foreground">Loading…</p> : !draft ? (
        <Card><CardContent className="p-6 text-center space-y-3"><Sparkles className="h-8 w-8 mx-auto text-primary" /><p>No draft yet. Click <b>Re-check now</b> to let the AI Paymaster prepare this period.</p></CardContent></Card>
      ) : (<>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={draft.status === "approved" ? "default" : "destructive"}>{draft.status === "approved" ? "Approved by a manager" : "Awaiting your approval"}</Badge>
          <span className="text-sm text-muted-foreground">Period {draft.period_start} – {draft.period_end} · Pay date {draft.pay_date} · Last checked {new Date(draft.updated_at).toLocaleString()}</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat icon={Users} label="Staff" value={String(draft.employee_count)} />
          <Stat icon={up ? TrendingUp : TrendingDown} label="Projected gross" value={money(draft.projected_gross)} sub={draft.change_pct == null ? "No earlier run" : `${up ? "+" : ""}${draft.change_pct}% vs ${money(draft.last_gross)}`} />
          <Stat icon={Clock} label="Missing punches / pending shifts" value={`${draft.missing_punches} / ${draft.pending_shifts}`} />
          <Stat icon={Landmark} label="Loan repayments" value={money(draft.loan_repayments)} sub={`${draft.active_loans} active loans`} />
        </div>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />AI briefing</CardTitle></CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm leading-relaxed">{draft.summary ?? "AI briefing unavailable for this check; figures below are still current."}</CardContent>
        </Card>
        <div className="grid lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-accent" />Flags ({flags.length})</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {flags.length === 0 ? <p className="text-sm text-muted-foreground">No unusual changes found.</p> : flags.map((f, i) => (
                <div key={i} className="rounded-lg border p-3"><div className="flex items-center gap-2"><Badge variant={f.severity === "high" ? "destructive" : "secondary"}>{f.severity}</Badge><b className="text-sm">{f.title}</b></div><p className="text-sm text-muted-foreground mt-1">{f.detail}</p></div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Suggested next steps</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {suggestions.map((s, i) => <Button key={i} variant="outline" className="w-full justify-start min-h-11" onClick={() => navigate(s.path)}>{i + 1}. {s.action}</Button>)}
            </CardContent>
          </Card>
        </div>
      </>)}

      {isAdmin && settings && (
        <Card>
          <CardHeader><CardTitle>Reminder settings</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3 text-sm">
            <label className="space-y-1"><span>Pay day of month (1–28)</span><Input type="number" min={1} max={28} className="w-32" placeholder={String(settings.pay_day)} value={payDay} onChange={e => setPayDay(e.target.value)} /></label>
            <Button className="min-h-11" onClick={savePayDay}>Save</Button>
            <p className="text-muted-foreground w-full">Daily reminders start {settings.lead_days} days before pay day and repeat until payroll is approved.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: string; sub?: string }) {
  return <Card><CardContent className="p-4"><Icon className="h-5 w-5 text-primary" /><p className="text-xs text-muted-foreground mt-2">{label}</p><p className="text-lg font-bold">{value}</p>{sub && <p className="text-xs text-muted-foreground">{sub}</p>}</CardContent></Card>;
}
