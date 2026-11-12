import { useEffect, useState } from "react";
import { Copy, Mail, MessageCircle, RefreshCw, Smartphone, UserMinus, Power } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { staffClockLink } from "@/lib/staff-clock-link";

type Emp = { employee_id: string; org_id: string; name: string; code: string | null; has_credential: boolean; enabled: boolean; bound: boolean; last_seen_at: string | null };
const rpc = (fn: string, args: Record<string, unknown>) => supabase.rpc(fn as never, args as never) as unknown as Promise<{ error: { message: string } | null }>;

/** Staff phone clocks for the active company: turn on, reset phone, resend link, or remove when someone leaves. */
export default function EmployeeClockManager() {
  const [emps, setEmps] = useState<Emp[]>([]);
  const [q, setQ] = useState("");
  const [share, setShare] = useState<Emp | null>(null);
  const load = async () => {
    const [{ data: org }, { data }] = await Promise.all([supabase.rpc("current_org_id"), supabase.rpc("list_activatable_employee_clocks" as never)]);
    setEmps(((data as unknown as Emp[]) ?? []).filter((e) => e.org_id === org));
  };
  useEffect(() => { void load(); }, []);

  const act = async (e: Emp, kind: "reset" | "on" | "left") => {
    const msg = kind === "reset" ? `Reset ${e.name}'s clock? Their old phone stops working; the next phone they clock in with becomes their clock. You can then resend the link.`
      : kind === "left" ? `${e.name} has left? This switches their clock off and unlinks their phone. Their hours and pay history are kept. You can turn it back on later.`
      : `Turn on ${e.name}'s clock?`;
    if (!confirm(msg)) return;
    const { error } = kind === "reset" ? await rpc("admin_reset_employee_clock", { _employee: e.employee_id })
      : await rpc("set_employee_clock_active", { _employee: e.employee_id, _active: kind === "on", _reason: kind === "left" ? "Staff member left" : null });
    if (error) return void toast.error(error.message);
    toast.success(kind === "reset" ? "Clock reset — send the link again" : kind === "left" ? "Clock removed for departed staff" : "Clock turned on");
    await load();
    if (kind !== "left") setShare(e);
  };

  const list = emps.filter((e) => e.name.toLowerCase().includes(q.toLowerCase()));
  const link = share ? staffClockLink(share.org_id, share.code ?? undefined) : "";
  const text = share ? `Hi ${share.name}, here is your work clock: ${link}\nOpen it in Safari (iPhone) or Chrome (Android), enter your PIN, then add it to your home screen. It will only work on this one phone.` : "";

  return (
    <section className="space-y-3 rounded-2xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold"><Smartphone className="h-4 w-4" />Staff phone clocks</h2>
        <Input className="h-10 max-w-xs" placeholder="Search staff…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="divide-y">
        {list.map((e) => {
          const st = !e.has_credential ? ["Not set up", "bg-muted text-muted-foreground"] : !e.enabled ? ["Off", "bg-destructive/15 text-destructive"] : e.bound ? ["On · phone linked", "bg-primary/15 text-primary"] : ["On · waiting for phone", "bg-accent/30 text-accent-foreground"];
          return (
            <div key={e.employee_id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div><p className="font-medium">{e.name || "Employee"}</p><p className="text-xs text-muted-foreground">Code {e.code ?? "—"} · Last used {e.last_seen_at ? new Date(e.last_seen_at).toLocaleString() : "never"}</p></div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${st[1]}`}>{st[0]}</span>
                {!e.has_credential ? <Button size="sm" variant="outline" asChild><a href="/employees">Set up in employee folder</a></Button>
                  : e.enabled ? <>
                    <Button size="sm" variant="outline" onClick={() => setShare(e)}><MessageCircle className="mr-1 h-4 w-4" />Send link</Button>
                    <Button size="sm" variant="outline" onClick={() => act(e, "reset")}><RefreshCw className="mr-1 h-4 w-4" />Reset & resend</Button>
                    <Button size="sm" variant="outline" className="text-destructive" onClick={() => act(e, "left")}><UserMinus className="mr-1 h-4 w-4" />Staff left – remove clock</Button>
                  </> : <Button size="sm" variant="outline" onClick={() => act(e, "on")}><Power className="mr-1 h-4 w-4" />Turn on</Button>}
              </div>
            </div>);
        })}
        {!list.length && <p className="py-4 text-sm text-muted-foreground">No staff found.</p>}
      </div>

      <Dialog open={!!share} onOpenChange={(o) => !o && setShare(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Send clock link to {share?.name}</DialogTitle></DialogHeader>
          <p className="break-all rounded-md bg-muted p-2 text-sm">{link}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void navigator.clipboard.writeText(link).then(() => toast.success("Link copied"), () => toast.error("Unable to copy"))}><Copy className="mr-2 h-4 w-4" />Copy link</Button>
            <Button variant="outline" asChild><a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer"><MessageCircle className="mr-2 h-4 w-4" />WhatsApp</a></Button>
            <Button variant="outline" asChild><a href={`mailto:?subject=${encodeURIComponent("Your work clock")}&body=${encodeURIComponent(text)}`}><Mail className="mr-2 h-4 w-4" />Email</a></Button>
          </div>
          <p className="text-xs text-muted-foreground">Their PIN is not in the link. If they forgot it, set a new PIN in their employee folder.</p>
        </DialogContent>
      </Dialog>
    </section>
  );
}
