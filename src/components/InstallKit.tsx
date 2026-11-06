import { useEffect, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Copy, Download, FileDown, Mail, MessageCircle, MonitorSmartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import AddToHomeScreen from "@/components/AddToHomeScreen";
import { supabase } from "@/integrations/supabase/client";
import { PUBLISHED_URL, staffClockLink } from "@/lib/staff-clock-link";

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** Admin-only install kit: QR codes, share links and a printable install guide for phones and PCs. */
export default function InstallKit() {
  const [open, setOpen] = useState(false);
  const [org, setOrg] = useState("");
  const [which, setWhich] = useState<"staff" | "admin">("staff");
  useEffect(() => { void supabase.rpc("current_org_id").then(({ data }) => setOrg(data ?? "")); }, []);
  const link = which === "staff" && org ? staffClockLink(org) : PUBLISHED_URL;
  const message = which === "staff"
    ? `Install our staff time clock app: ${link}\n1. Open the link in Chrome (Android/PC) or Safari (iPhone).\n2. Tap "Add app to my home screen".\n3. Enter your employee code and PIN. Allow location.\nNo internet? You can still clock in and out; it sends when you're back online.`
    : `Install the HR & Payroll app on your PC or phone: ${link}\nOpen in Chrome or Edge and click the install icon in the address bar (or menu → Install app).`;
  const qrData = () => (document.getElementById("kit-qr") as HTMLCanvasElement | null)?.toDataURL("image/png") ?? "";
  const downloadQr = () => { const d = qrData(); if (!d) return; fetch(d).then(r => r.blob()).then(b => saveBlob(b, `${which}-app-qr.png`)); };
  const downloadGuide = () => {
    const esc = (t: string) => t.replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Install guide</title><style>body{font-family:system-ui,sans-serif;max-width:720px;margin:24px auto;padding:0 16px;color:#1c1917}h1{color:#0e7490}h2{color:#ea580c;margin-top:24px}img{width:220px}.box{border:2px solid #0e7490;border-radius:12px;padding:16px;text-align:center}li{margin:6px 0}</style></head><body>
<h1>${which === "staff" ? "Staff Time Clock" : "HR & Payroll"} — install guide</h1>
<div class="box"><img src="${qrData()}" alt="QR code"><p><b>Scan with your phone camera</b><br>${esc(link)}</p></div>
<h2>Android phone</h2><ol><li>Scan the QR code or open the link in <b>Chrome</b>.</li><li>Tap <b>Add app to my home screen</b> (or menu ⋮ → <b>Install app</b>).</li><li>Open the new icon on your home screen.</li></ol>
<h2>iPhone / iPad</h2><ol><li>Open the link in <b>Safari</b>.</li><li>Tap the <b>Share</b> button, then <b>Add to Home Screen</b>.</li></ol>
<h2>Windows or Mac computer</h2><ol><li>Open the link in <b>Chrome</b> or <b>Edge</b>.</li><li>Click the install icon at the right of the address bar (or menu → <b>Install app</b>).</li><li>The app opens in its own window and appears in your Start menu / Dock.</li></ol>
<h2>No internet?</h2><p>Staff can still clock in and out. Punches are saved on the device and sent automatically when the connection returns. A manager checks each offline punch before it counts for pay.</p>
<h2>Opened from WhatsApp or email?</h2><p>Tap ⋮ or the share icon and choose <b>Open in browser</b> first — apps can't be installed from inside WhatsApp or email.</p>
</body></html>`;
    saveBlob(new Blob([html], { type: "text/html;charset=utf-8" }), `${which === "staff" ? "Staff-Clock" : "Payroll-App"}-Install-Guide.html`);
  };
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}><MonitorSmartphone size={16} />Install kit</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>App install kit</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <Button variant={which === "staff" ? "default" : "outline"} onClick={() => setWhich("staff")}>Staff clock app</Button>
              <Button variant={which === "admin" ? "default" : "outline"} onClick={() => setWhich("admin")}>Full app (PC)</Button>
            </div>
            <div className="flex justify-center rounded-lg border border-border bg-card p-4"><QRCodeCanvas id="kit-qr" value={link} size={200} includeMargin /></div>
            <p className="break-all text-center text-xs text-muted-foreground">{link}</p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={downloadGuide}><FileDown size={16} />Install guide</Button>
              <Button variant="outline" onClick={downloadQr}><Download size={16} />QR image</Button>
              <Button variant="outline" asChild><a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer"><MessageCircle size={16} />WhatsApp</a></Button>
              <Button variant="outline" asChild><a href={`mailto:?subject=${encodeURIComponent("Install our app")}&body=${encodeURIComponent(message)}`}><Mail size={16} />Email</a></Button>
              <Button variant="outline" className="col-span-2" onClick={() => void navigator.clipboard.writeText(message).then(() => toast.success("Copied"))}><Copy size={16} />Copy message</Button>
            </div>
            <div className="border-t border-border pt-3 text-center"><p className="mb-2 text-sm text-muted-foreground">Install on this computer:</p><AddToHomeScreen /></div>
            <p className="text-xs text-muted-foreground">Installing works on the published app. Offline clocking works after the app has been opened once with internet.</p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
