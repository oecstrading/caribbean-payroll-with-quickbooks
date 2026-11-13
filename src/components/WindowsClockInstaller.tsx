import { Copy, Download, Mail, MessageCircle, Monitor, MousePointerClick } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import installer from "@/assets/OECS_Time_Clock_Setup.exe.asset.json";
import { PUBLISHED_URL } from "@/lib/staff-clock-link";

const shareUrl = `${PUBLISHED_URL.replace(/\/$/, "")}${installer.url}`;
const kioskUrl = `${PUBLISHED_URL.replace(/\/$/, "")}/kiosk`;
const msg = `Install the OECS Time Clock on this Windows PC (one click): ${shareUrl}\nThen enter the activation code from your manager.`;

export default function WindowsClockInstaller() {
  return (
    <section className="rounded-xl border bg-card p-5 space-y-3">
      <div className="flex items-center gap-3"><Monitor className="h-6 w-6 text-primary" /><h2 className="text-lg font-semibold">Add Windows clock</h2></div>
      <p className="text-sm text-muted-foreground">Turn any office Windows PC into a shared clock for every employee. One click installs it — no admin rights needed. It starts with Windows, lives in the tray, and the PC stays free for normal work.</p>
      <ol className="list-decimal pl-5 text-sm space-y-1">
        <li>Click “One Click Installation”, then open the downloaded file (if Windows warns, click “More info” → “Run anyway”).</li>
        <li>Click “Add tablet clock” above for the company and site, then enter its code in the PC clock.</li>
      </ol>
      <div className="flex flex-wrap gap-2">
        <Button asChild size="lg" className="h-12 text-base shadow-sm">
          <a href={kioskUrl} target="_blank" rel="noreferrer">
            <MousePointerClick className="mr-2 h-5 w-5" />One Click Installation
          </a>
        </Button>
        <Button variant="outline" className="h-11" asChild>
          <a href={shareUrl} target="_blank" rel="noreferrer"><Download className="mr-2 h-4 w-4" />Backup: .exe installer (80 MB)</a>
        </Button>
        <Button variant="outline" className="h-11" onClick={() => { navigator.clipboard.writeText(shareUrl); toast.success("Download link copied"); }}><Copy className="mr-2 h-4 w-4" />Copy link</Button>
        <Button variant="outline" className="h-11" asChild><a href={`https://wa.me/?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer"><MessageCircle className="mr-2 h-4 w-4" />WhatsApp</a></Button>
        <Button variant="outline" className="h-11" asChild><a href={`mailto:?subject=${encodeURIComponent("OECS Time Clock for Windows")}&body=${encodeURIComponent(msg)}`}><Mail className="mr-2 h-4 w-4" />Email</a></Button>
      </div>
      <p className="text-xs text-muted-foreground">The installer opens from {PUBLISHED_URL.replace(/^https?:\/\//, "")} — the same link the WhatsApp and Email buttons send.</p>
    </section>
  );
}
