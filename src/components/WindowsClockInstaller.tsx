import { Copy, Download, Mail, MessageCircle, Monitor } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import installer from "@/assets/OECS_Time_Clock_Setup.exe.asset.json";
import { PUBLISHED_URL } from "@/lib/staff-clock-link";

const shareUrl = `${PUBLISHED_URL.replace(/\/$/, "")}${installer.url}`;
const msg = `Install the OECS Time Clock on this Windows PC (one click): ${shareUrl}\nThen enter the activation code from your manager.`;

export default function WindowsClockInstaller() {
  return (
    <section className="rounded-xl border bg-card p-5 space-y-3">
      <div className="flex items-center gap-3"><Monitor className="h-6 w-6 text-primary" /><h2 className="text-lg font-semibold">Add Windows clock</h2></div>
      <p className="text-sm text-muted-foreground">Turn any office Windows PC into a shared clock for every employee. One click installs it — no admin rights needed. It starts with Windows, lives in the tray, and the PC stays free for normal work.</p>
      <ol className="list-decimal pl-5 text-sm space-y-1">
        <li>Download and open the installer on the PC (if Windows warns, click “More info” → “Run anyway”).</li>
        <li>Click “Add tablet clock” above for the company and site, then enter its code in the PC clock.</li>
      </ol>
      <div className="flex flex-wrap gap-2">
        <Button asChild className="h-11"><a href={shareUrl} target="_blank" rel="noreferrer"><Download className="mr-2 h-4 w-4" />Download installer (80 MB)</a></Button>
        <Button variant="outline" className="h-11" onClick={() => { navigator.clipboard.writeText(shareUrl); toast.success("Download link copied"); }}><Copy className="mr-2 h-4 w-4" />Copy link</Button>
        <Button variant="outline" className="h-11" asChild><a href={`https://wa.me/?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer"><MessageCircle className="mr-2 h-4 w-4" />WhatsApp</a></Button>
        <Button variant="outline" className="h-11" asChild><a href={`mailto:?subject=${encodeURIComponent("OECS Time Clock for Windows")}&body=${encodeURIComponent(msg)}`}><Mail className="mr-2 h-4 w-4" />Email</a></Button>
      </div>
    </section>
  );
}
