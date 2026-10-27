import { useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Smartphone, Copy, Mail, MessageCircle, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Always share the published address: installed apps update automatically when new features are published.
const PUBLISHED_URL = "https://caribbean-payroll-with-quickbooks.lovable.app";

export function InstallAppShare({ org }: { org: string }) {
  const [open, setOpen] = useState(false);
  const link = `${PUBLISHED_URL}/time-clock/${org}`;
  const message = `Install our staff time clock app on your phone: ${link}\n\nOpen the link, then tap "Add to Home Screen" (iPhone: Share button in Safari; Android: Chrome menu ⋮ → Install app). Allow location when you clock in or out.`;
  const downloadQr = () => {
    const canvas = document.getElementById("install-qr") as HTMLCanvasElement | null;
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = "staff-app-qr.png";
    a.click();
  };
  return (
    <>
      <Button variant="outline" disabled={!org} onClick={() => setOpen(true)}><Smartphone size={16} />Share staff app</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Invite staff to install the app</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="flex justify-center rounded-lg bg-card p-4 border border-border">
              <QRCodeCanvas id="install-qr" value={link} size={200} includeMargin />
            </div>
            <p className="break-all text-sm text-muted-foreground">{link}</p>
            <div className="grid grid-cols-2 gap-2">
              <Button asChild><a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer"><MessageCircle size={16} />WhatsApp</a></Button>
              <Button asChild variant="outline"><a href={`mailto:?subject=${encodeURIComponent("Install the staff time clock app")}&body=${encodeURIComponent(message)}`}><Mail size={16} />Email</a></Button>
              <Button variant="outline" onClick={() => navigator.clipboard.writeText(link).then(() => toast.success("Link copied")).catch(() => toast.error("Unable to copy"))}><Copy size={16} />Copy link</Button>
              <Button variant="outline" onClick={downloadQr}><Download size={16} />Save QR code</Button>
            </div>
            <p className="text-xs text-muted-foreground">This link never changes. When you publish new features, the installed app updates itself the next time staff open it.</p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
