import { useEffect, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Camera, Copy, Mail, MessageCircle, Plus, RefreshCw, Tablet, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { PUBLISHED_URL } from "@/lib/staff-clock-link";
import { kioskActivationLink } from "@/lib/kiosk-setup";

type Device = { id: string; name: string; department: string | null; site_id: string | null; activated_at: string | null; last_seen_at: string | null; revoked_at: string | null };
type Shot = { id: string; punched_at: string; direction: string; mode: string; photo_path: string | null; employee_id: string; url?: string; name?: string; device?: string };
const fmt = (s: string | null) => (s ? new Date(s).toLocaleString() : "—");

export default function ClockDevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [sites, setSites] = useState<{ id: string; name: string }[]>([]);
  const [policy, setPolicy] = useState<"optional" | "always">("optional");
  const [shots, setShots] = useState<Shot[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", department: "", site: "" });
  const [issued, setIssued] = useState<{ code: string; expires_at: string; name: string } | null>(null);

  const load = async () => {
    const [d, s, w, p] = await Promise.all([
      supabase.from("clock_devices").select("id,name,department,site_id,activated_at,last_seen_at,revoked_at").order("created_at"),
      supabase.from("client_sites").select("id,name").order("name"),
      supabase.from("workforce_clock_settings").select("selfie_policy").maybeSingle(),
      supabase.from("workforce_punches").select("id,punched_at,direction,mode,photo_path,employee_id,device_id").not("device_id", "is", null).order("punched_at", { ascending: false }).limit(24),
    ]);
    const list = (d.data ?? []) as Device[];
    setDevices(list); setSites((s.data ?? []) as any); if (w.data) setPolicy(w.data.selfie_policy as any);
    const rows = (p.data ?? []) as (Shot & { device_id: string })[];
    const ids = [...new Set(rows.map((r) => r.employee_id))];
    const names = ids.length ? (await supabase.from("payroll_employee_directory").select("user_id,first_name,last_name").in("user_id", ids)).data ?? [] : [];
    const withUrls = await Promise.all(rows.map(async (r) => ({
      ...r, device: list.find((x) => x.id === r.device_id)?.name,
      name: (() => { const n = names.find((x: any) => x.user_id === r.employee_id) as any; return n ? `${n.first_name ?? ""} ${n.last_name ?? ""}`.trim() : "Employee"; })(),
      url: r.photo_path ? (await supabase.storage.from("clock-selfies").createSignedUrl(r.photo_path, 600)).data?.signedUrl : undefined,
    })));
    setShots(withUrls);
  };
  useEffect(() => { void load(); }, []);

  const create = async () => {
    const { data, error } = await supabase.rpc("create_clock_device", { _name: form.name, _department: form.department, _site: (form.site || null) as any });
    if (error) return toast.error(error.message);
    setIssued({ ...(data as any), name: form.name }); setOpen(false); setForm({ name: "", department: "", site: "" }); void load();
  };
  const renew = async (d: Device) => {
    const { data, error } = await supabase.rpc("renew_clock_device_code", { _id: d.id });
    if (error) return toast.error(error.message);
    setIssued({ ...(data as any), name: d.name }); void load();
  };
  const revoke = async (d: Device) => {
    if (!confirm(`Switch off "${d.name}"? The tablet stops clocking until you activate it again.`)) return;
    const { error } = await supabase.rpc("revoke_clock_device", { _id: d.id });
    error ? toast.error(error.message) : (toast.success("Clock switched off"), void load());
  };
  const savePolicy = async (v: "optional" | "always") => {
    const { error } = await supabase.rpc("set_selfie_policy", { _policy: v });
    error ? toast.error(error.message) : (setPolicy(v), toast.success("Selfie setting saved"));
  };
  const deleteSelfie = async (s: Shot) => {
    if (!confirm(`Delete the selfie for ${s.name ?? "this employee"} at ${fmt(s.punched_at)}? The punch record stays; only the photo is removed.`)) return;
    const { error } = await supabase.rpc("delete_punch_selfie", { _punch_id: s.id });
    error ? toast.error(error.message) : (toast.success("Selfie deleted"), void load());
  };
  const link = issued ? kioskActivationLink(issued.code) : "";
  const invitation = issued ? `Set up ${issued.name} on the company tablet: ${link}\nOpen the link to activate automatically, then allow camera, microphone and location and add it to the home screen. This single-use link expires at ${new Date(issued.expires_at).toLocaleTimeString()}. Use only on the intended company clock device.` : "";
  const status = (d: Device) => d.revoked_at ? { t: "Switched off", c: "bg-destructive/15 text-destructive" } : d.activated_at ? (d.last_seen_at && Date.now() - new Date(d.last_seen_at).getTime() < 10 * 60000 ? { t: "Online", c: "bg-primary/15 text-primary" } : { t: "Offline", c: "bg-accent/30 text-accent-foreground" }) : { t: "Waiting for activation", c: "bg-muted text-muted-foreground" };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold">Clock devices</h1><p className="text-muted-foreground">Shared tablets where staff clock in by name and PIN, or hands-free by voice and selfie.</p></div>
        <Button onClick={() => setOpen(true)} className="h-11"><Plus className="mr-2 h-4 w-4" />Add clock</Button>
      </div>

      <section className="rounded-2xl border bg-card p-4">
        <h2 className="mb-2 flex items-center gap-2 font-semibold"><Camera className="h-4 w-4" />Selfie with each tablet punch</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant={policy === "optional" ? "default" : "outline"} onClick={() => savePolicy("optional")}>Optional (voice punches always need one)</Button>
          <Button variant={policy === "always" ? "default" : "outline"} onClick={() => savePolicy("always")}>Always required</Button>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {devices.map((d) => { const s = status(d); return (
          <div key={d.id} className="space-y-3 rounded-2xl border bg-card p-4">
            <div className="flex items-start justify-between gap-2"><div className="flex items-center gap-2"><Tablet className="h-5 w-5 text-primary" /><h3 className="font-semibold">{d.name}</h3></div><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.c}`}>{s.t}</span></div>
            <p className="text-sm text-muted-foreground">{d.department ?? "All departments"}{d.site_id ? ` · ${sites.find((x) => x.id === d.site_id)?.name ?? "Site"}` : ""}</p>
            <p className="text-xs text-muted-foreground">Activated {fmt(d.activated_at)} · Last seen {fmt(d.last_seen_at)}</p>
            <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => renew(d)}><RefreshCw className="mr-1 h-4 w-4" />New code</Button>{!d.revoked_at && <Button size="sm" variant="outline" className="text-destructive" onClick={() => revoke(d)}><Trash2 className="mr-1 h-4 w-4" />Switch off</Button>}</div>
          </div>); })}
        {!devices.length && <p className="col-span-full rounded-2xl border border-dashed p-8 text-center text-muted-foreground">No clocks yet. Click “Add clock” to set up your first tablet.</p>}
      </div>

      <section>
        <h2 className="mb-3 font-semibold">Recent tablet punches</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {shots.map((s) => (
            <div key={s.id} className="overflow-hidden rounded-xl border bg-card text-xs">
              {s.url ? <img src={s.url} alt={`Selfie of ${s.name}`} className="aspect-[4/3] w-full object-cover" /> : <div className="flex aspect-[4/3] items-center justify-center bg-muted text-muted-foreground">No selfie</div>}
              <div className="p-2"><p className="font-semibold">{s.name}</p><p>{s.direction.replace("_", " ")} · {s.mode === "voice" ? "voice" : "PIN"}</p><p className="text-muted-foreground">{fmt(s.punched_at)} · {s.device}</p>
                {s.photo_path && <Button size="sm" variant="outline" className="mt-1 h-7 w-full text-destructive" onClick={() => deleteSelfie(s)}><Trash2 className="mr-1 h-3 w-3" />Delete selfie</Button>}</div>
            </div>
          ))}
          {!shots.length && <p className="col-span-full text-sm text-muted-foreground">No tablet punches yet.</p>}
        </div>
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add a clock</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Clock name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Kitchen – Rodney Bay" /></div>
            <div><Label>Department shown first (optional)</Label><Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="Kitchen" /></div>
            <div><Label>Work site (optional)</Label>
              <select className="h-10 w-full rounded-md border bg-background px-3" value={form.site} onChange={(e) => setForm({ ...form, site: e.target.value })}>
                <option value="">No site</option>{sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select></div>
            <Button className="w-full" disabled={!form.name.trim()} onClick={create}>Create and show activation code</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!issued} onOpenChange={(o) => !o && setIssued(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Activate “{issued?.name}”</DialogTitle></DialogHeader>
          <div className="space-y-3 text-center">
            <p className="text-sm text-muted-foreground">Scan or open the link on the company tablet. Activation starts automatically; no login or code entry needed. Expires at {issued && new Date(issued.expires_at).toLocaleTimeString()}.</p>
            {issued && <QRCodeCanvas value={link} size={220} includeMargin className="mx-auto" />}
            <p className="font-mono text-3xl font-bold tracking-widest">{issued?.code}</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="outline" onClick={() => void navigator.clipboard.writeText(link).then(() => toast.success("Activation link copied"), () => toast.error("Unable to copy. Use email or WhatsApp."))}><Copy size={16} className="mr-2" />Copy link</Button>
              <Button variant="outline" asChild><a href={`https://wa.me/?text=${encodeURIComponent(invitation)}`} target="_blank" rel="noopener noreferrer"><MessageCircle size={16} className="mr-2" />WhatsApp</a></Button>
              <Button variant="outline" asChild><a href={`mailto:?subject=${encodeURIComponent(`Activate ${issued?.name ?? "company clock"}`)}&body=${encodeURIComponent(invitation)}`}><Mail size={16} className="mr-2" />Email</a></Button>
            </div>
            <p className="text-xs text-muted-foreground">One link activates one device. Send it to whoever sets up that tablet, not the whole staff. For personal phones, use employee clock invitations.</p>
            <p className="text-xs text-muted-foreground">Camera, microphone and home-screen installation need the device owner’s approval. Manual fallback: {PUBLISHED_URL}/kiosk.</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
