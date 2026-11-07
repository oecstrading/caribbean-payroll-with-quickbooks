import { useEffect, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Send, Mail, MessageCircle, QrCode, Copy, Download, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { staffClockLink } from "@/lib/staff-clock-link";

type Staff = { id: string; name: string; email: string | null; phone: string | null; code: string | null; pin: boolean };

export function whatsappNumber(phone: string | null) {
  const d = (phone ?? "").replace(/\D/g, "");
  if (!d) return "";
  return d.length === 10 ? `1${d}` : d.length === 7 ? `1758${d}` : d;
}

export function inviteMessage(name: string, link: string, hasPin: boolean) {
  return `Hi ${name.split(" ")[0]}! 👋 This is YOUR personal time clock.\n\n1️⃣ Open this link on your OWN phone: ${link}\n2️⃣ Tap "Add app to my home screen"\n3️⃣ Enter your PIN${hasPin ? "" : " (your manager will give it to you)"}, allow location, and tap Clock in.\n\n☕ Use Lunch out / Lunch in for breaks and End shift to clock out. Your code is already filled in, and "My dashboard" shows your hours and pay.\n\n🔒 Your clock locks to the first phone you use. It will not work on anyone else's phone — never share your link or PIN. New phone? Ask your manager to reset it.`;
}

export function StaffInviteCenter({ org }: { org: string }) {
  const [open, setOpen] = useState(false);
  const [staff, setStaff] = useState<Staff[] | null>(null);
  const [qr, setQr] = useState<Staff | null>(null);

  useEffect(() => {
    if (!open || staff) return;
    (async () => {
      const { data, error } = await supabase.from("payroll_employee_directory").select("user_id,first_name,last_name,email,phone").is("deleted_at", null).ilike("status", "active");
      if (error) { toast.error(error.message); setStaff([]); return; }
      const rows = await Promise.all((data ?? []).filter(r => r.user_id).map(async r => {
        const c = await supabase.rpc("employee_clock_configuration", { _employee: r.user_id! });
        const cfg = (c.data ?? {}) as { employee_code?: string; pin_configured?: boolean };
        return { id: r.user_id!, name: `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim(), email: r.email, phone: r.phone, code: cfg.employee_code ?? null, pin: !!cfg.pin_configured };
      }));
      setStaff(rows.sort((a, b) => a.name.localeCompare(b.name)));
      const b = await supabase.rpc("clock_phone_bindings");
      if (!b.error) setBound(Object.fromEntries((b.data ?? []).map(x => [x.employee_id, x.bound_at as string])));
    })();
  }, [open, staff]);
  const [bound, setBound] = useState<Record<string, string>>({});
  const resetPhone = async (s: Staff) => {
    if (!confirm(`Reset ${s.name}'s phone? Their next clock-in will lock the clock to whichever phone they use.`)) return;
    const { error } = await supabase.rpc("reset_clock_phone", { _employee: s.id });
    if (error) return toast.error(error.message);
    setBound(b => { const n = { ...b }; delete n[s.id]; return n; }); toast.success("Phone reset — send the link to their new phone");
  };

  const link = (s: Staff) => staffClockLink(org, s.code ?? undefined);
  const saveQr = (s: Staff) => {
    const c = document.getElementById("staff-invite-qr") as HTMLCanvasElement | null;
    if (!c) return;
    const a = document.createElement("a"); a.href = c.toDataURL("image/png"); a.download = `${s.name.replace(/\s+/g, "-")}-clock-qr.png`; a.click();
  };

  return <>
    <Button disabled={!org} onClick={() => setOpen(true)}><Send size={16} />Invite staff</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Send each employee their personal app link</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Each link and QR code is unique to one employee and opens their clock with code filled in: clock in, lunch out/in and end shift, with location on every punch. To stop buddy punching, the clock locks to the first phone that uses it — a co-worker's phone is refused even with the right PIN. Use "Reset phone" if someone changes phones.</p>
        {!staff ? <p>Loading staff…</p> : !staff.length ? <p className="text-muted-foreground">No active employees yet.</p> :
          <ul className="space-y-2">{staff.map(s => {
            const msg = inviteMessage(s.name, link(s), s.pin); const wa = whatsappNumber(s.phone);
            return <li key={s.id} className="border border-border rounded-lg p-3 flex flex-wrap items-center gap-2 justify-between">
              <div className="min-w-0"><p className="font-medium">{s.name}</p>
                <p className="text-xs text-muted-foreground">{s.code ? `Code ${s.code}` : "No clock code yet — set it in Clock setup"}{s.code && !s.pin && " · No PIN yet"}{s.code && (bound[s.id] ? ` · 🔒 Locked to phone since ${new Date(bound[s.id]).toLocaleDateString()}` : " · Not yet used on a phone")}</p></div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" className="bg-success text-success-foreground hover:bg-success/90" asChild><a href={`https://wa.me/${wa}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer"><MessageCircle size={15} />WhatsApp</a></Button>
                <Button size="sm" variant="outline" asChild><a href={`mailto:${s.email ?? ""}?subject=${encodeURIComponent("Your staff time clock app")}&body=${encodeURIComponent(msg)}`}><Mail size={15} />Email</a></Button>
                <Button size="sm" variant="outline" onClick={() => setQr(s)}><QrCode size={15} />QR</Button>
                <Button size="sm" variant="ghost" title="Copy link" onClick={() => navigator.clipboard.writeText(link(s)).then(() => toast.success("Link copied"))}><Copy size={15} /></Button>
                {bound[s.id] && <Button size="sm" variant="outline" onClick={() => resetPhone(s)}><Smartphone size={15} />Reset phone</Button>}
              </div>
            </li>;
          })}</ul>}
      </DialogContent>
    </Dialog>
    <Dialog open={!!qr} onOpenChange={o => !o && setQr(null)}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{qr?.name}: scan to start</DialogTitle></DialogHeader>
        {qr && <div className="space-y-3 text-center">
          <div className="flex justify-center rounded-lg border border-border bg-card p-3"><QRCodeCanvas id="staff-invite-qr" value={link(qr)} size={220} includeMargin /></div>
          <p className="text-sm text-muted-foreground">Point the phone camera at the code, tap the link, then tap "Add app to my home screen". Scan only on {qr.name.split(" ")[0]}'s own phone — the clock locks to it.</p>
          <Button variant="outline" onClick={() => saveQr(qr)}><Download size={15} />Save / print QR</Button>
        </div>}
      </DialogContent>
    </Dialog>
  </>;
}
