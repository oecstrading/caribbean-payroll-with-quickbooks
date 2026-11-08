import { useEffect, useMemo, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Copy, Mail, MessageCircle, Power, Tablet } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { NativeSelect } from "@/components/ui/native-select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { kioskActivationLink } from "@/lib/kiosk-setup";

type Clock = { id: string; name: string; department: string | null; org_id: string; company: string; activated_at: string | null; last_seen_at: string | null; revoked_at: string | null };
type Issued = { id: string; name: string; org_id: string; code: string; expires_at: string };

const state = (c: Clock) => c.revoked_at ? "Switched off" : !c.activated_at ? "Waiting for activation" : c.last_seen_at && Date.now() - new Date(c.last_seen_at).getTime() < 10 * 60000 ? "Online" : "Offline";

export default function BulkClockActivation() {
  const [clocks, setClocks] = useState<Clock[]>([]);
  const [company, setCompany] = useState("all");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<Issued[]>([]);

  const load = async () => {
    const { data, error } = await supabase.rpc("list_activatable_clocks" as never);
    if (error) return;
    setClocks((data as unknown as Clock[]) ?? []);
  };
  useEffect(() => { void load(); }, []);

  const companies = useMemo(() => Array.from(new Map(clocks.map((c) => [c.org_id, c.company])).entries()), [clocks]);
  const shown = clocks.filter((c) => company === "all" || c.org_id === company);
  const allPicked = shown.length > 0 && shown.every((c) => picked.has(c.id));
  if (!clocks.length) return null;

  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setPicked((p) => { const n = new Set(p); shown.forEach((c) => allPicked ? n.delete(c.id) : n.add(c.id)); return n; });

  const activate = async () => {
    const ids = [...picked];
    if (!ids.length) return;
    if (!confirm(`Create new activation links for ${ids.length} clock(s)? Any tablet currently using these clocks will stop until it is set up again with the new link.`)) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("bulk_issue_clock_codes" as never, { _ids: ids } as never);
    setBusy(false);
    if (error) return void toast.error((error as { message: string }).message);
    setIssued((data as unknown as Issued[]) ?? []);
    setPicked(new Set());
    void load();
  };

  const companyName = (org: string) => clocks.find((c) => c.org_id === org)?.company ?? "";
  const message = (i: Issued) => `Set up ${i.name} (${companyName(i.org_id)}) on the company tablet: ${kioskActivationLink(i.code)}\nOpen the link to activate automatically, allow camera, microphone and location, then add it to the home screen. Single-use link, expires ${new Date(i.expires_at).toLocaleTimeString()}.`;
  const allMessages = issued.map(message).join("\n\n");

  return (
    <div className="rounded-2xl border border-sidebar-border bg-sidebar-accent p-4 text-sidebar-accent-foreground">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-semibold"><Power className="h-4 w-4 text-sidebar-primary" />Activate clocks</h3>
          <p className="text-xs opacity-75">Pick one, several or all tablets in any company you manage, then send each its own setup link.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <NativeSelect aria-label="Company" value={company} onChange={(e) => setCompany(e.target.value)} className="min-h-11 text-foreground">
            <option value="all">All companies</option>
            {companies.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </NativeSelect>
          <Button variant="outline" className="min-h-11 text-foreground" onClick={toggleAll}>{allPicked ? "Clear" : "Select all"}</Button>
          <Button className="min-h-11" disabled={!picked.size || busy} onClick={() => void activate()}>Activate {picked.size || ""} selected</Button>
        </div>
      </div>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((c) => (
          <li key={c.id}>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-sidebar-border bg-sidebar p-3 text-sidebar-foreground">
              <Checkbox checked={picked.has(c.id)} onCheckedChange={() => toggle(c.id)} aria-label={`Select ${c.name}`} />
              <Tablet className="h-4 w-4 shrink-0 text-sidebar-primary" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{c.name}</span>
                <span className="block truncate text-xs opacity-70">{c.company}{c.department ? ` · ${c.department}` : ""} · {state(c)}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>

      <Dialog open={issued.length > 0} onOpenChange={(o) => !o && setIssued([])}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{issued.length} activation link{issued.length === 1 ? "" : "s"} ready</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Each link works once, on one tablet, for 15 minutes. Scan the QR on the tablet or send the link to whoever sets it up.</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => { void navigator.clipboard.writeText(allMessages); toast.success("All links copied"); }}><Copy className="mr-2 h-4 w-4" />Copy all</Button>
            <Button variant="outline" asChild><a href={`https://wa.me/?text=${encodeURIComponent(allMessages)}`} target="_blank" rel="noreferrer"><MessageCircle className="mr-2 h-4 w-4" />WhatsApp all</a></Button>
            <Button variant="outline" asChild><a href={`mailto:?subject=${encodeURIComponent("Clock activation links")}&body=${encodeURIComponent(allMessages)}`}><Mail className="mr-2 h-4 w-4" />Email all</a></Button>
          </div>
          <div className="grid gap-3">
            {issued.map((i) => (
              <div key={i.id} className="flex items-center gap-3 rounded-xl border p-3">
                <QRCodeCanvas value={kioskActivationLink(i.code)} size={96} />
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-semibold">{i.name}</p>
                  <p className="text-xs text-muted-foreground">{companyName(i.org_id)} · code {i.code}</p>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => { void navigator.clipboard.writeText(message(i)); toast.success("Link copied"); }}><Copy className="h-4 w-4" /></Button>
                    <Button size="sm" variant="outline" asChild><a href={`https://wa.me/?text=${encodeURIComponent(message(i))}`} target="_blank" rel="noreferrer" aria-label="WhatsApp"><MessageCircle className="h-4 w-4" /></a></Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
