import { QRCodeCanvas } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download, Mail, MessageCircle, Copy, QrCode, BookOpen, FileText, Heart, Share2 } from "lucide-react";
import { toast } from "sonner";
import { downloadFile } from "@/lib/download-file";
import hero from "@/assets/promo-hero.jpg";

const PUBLISHED = "https://caribbean-payroll-with-quickbooks.lovable.app";
export const PROMO_LINK = `${PUBLISHED}/discover`;
const BROCHURE = "/training/OECS_Brochure_v8.pdf";
const GUIDE = "/training/OECS_User_Manual_v12.pdf";

export const PROMO_MESSAGE =
  "🌴 Payroll in minutes, not days! Your staff clock in from any phone or site, AI prepares the payroll, you approve with one tap — and it syncs to QuickBooks. Built for the Caribbean. 👉 See the brochure & guide:";

export default function PromoPage() {
  const full = `${PROMO_MESSAGE} ${PROMO_LINK}`;
  const copy = async () => { await navigator.clipboard.writeText(full); toast.success("Message and link copied"); };
  const saveQr = () => {
    const c = document.getElementById("promo-qr") as HTMLCanvasElement | null;
    if (!c) return;
    const a = document.createElement("a");
    a.href = c.toDataURL("image/png"); a.download = "Caribbean-Payroll-QR.png"; a.click();
  };
  const share = async () => {
    if (navigator.share) { try { await navigator.share({ title: "Caribbean AI Payroll", text: PROMO_MESSAGE, url: PROMO_LINK }); } catch { /* cancelled */ } }
    else copy();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/10 via-background to-accent/10 px-4 py-8">
      <div className="max-w-xl mx-auto space-y-6">
        {/* Social post mockup */}
        <Card className="overflow-hidden shadow-xl border-2 border-primary/20">
          <div className="flex items-center gap-3 p-3">
            <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">OE</div>
            <div className="leading-tight">
              <div className="font-semibold text-foreground">Caribbean AI Payroll</div>
              <div className="text-xs text-muted-foreground">Sponsored · 🌴 Made for the islands</div>
            </div>
          </div>
          <p className="px-4 pb-3 text-foreground">
            <span className="font-bold text-lg block mb-1">Payroll in minutes, not days. ⏱️</span>
            Staff clock in from any phone or job site. AI prepares the payroll. You approve with one tap — and it syncs to QuickBooks.
          </p>
          <img src={hero} alt="Security guard and construction worker clocking in by phone in Saint Lucia" width={1200} height={630} className="w-full h-auto" />
          <div className="bg-primary text-primary-foreground p-4 space-y-3">
            <div className="text-sm font-medium">✅ Geofenced clock-in · ✅ AI Paymaster · ✅ QuickBooks · ✅ Every island</div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" className="h-12" onClick={() => downloadFile(BROCHURE)}><BookOpen className="h-4 w-4 mr-2" />Get the brochure</Button>
              <Button variant="secondary" className="h-12" onClick={() => downloadFile(GUIDE)}><FileText className="h-4 w-4 mr-2" />Get the user guide</Button>
            </div>
          </div>
          <div className="flex justify-around py-2 text-sm text-muted-foreground border-t">
            <span className="flex items-center gap-1"><Heart className="h-4 w-4" />Like</span>
            <button className="flex items-center gap-1" onClick={share}><Share2 className="h-4 w-4" />Share</button>
            <a href="/auth" className="flex items-center gap-1 text-primary font-medium">Try it →</a>
          </div>
        </Card>

        {/* Share kit */}
        <Card>
          <CardContent className="p-5 space-y-4">
            <h2 className="font-bold text-lg text-foreground">Send this to a customer</h2>
            <div className="text-xs bg-muted rounded p-3 break-all text-foreground">{full}</div>
            <div className="grid grid-cols-2 gap-2">
              <Button className="h-11" asChild><a href={`https://wa.me/?text=${encodeURIComponent(full)}`} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4 mr-2" />WhatsApp</a></Button>
              <Button className="h-11" variant="secondary" asChild><a href={`mailto:?subject=${encodeURIComponent("Payroll in minutes, not days 🌴")}&body=${encodeURIComponent(full)}`}><Mail className="h-4 w-4 mr-2" />Email</a></Button>
              <Button className="h-11" variant="outline" onClick={copy}><Copy className="h-4 w-4 mr-2" />Copy link</Button>
              <Button className="h-11" variant="outline" onClick={saveQr}><Download className="h-4 w-4 mr-2" />Save QR code</Button>
            </div>
            <div className="flex flex-col items-center gap-1 pt-2">
              <QRCodeCanvas id="promo-qr" value={PROMO_LINK} size={180} includeMargin />
              <span className="text-xs text-muted-foreground flex items-center gap-1"><QrCode className="h-3 w-3" />Scan to open the brochure & guide</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
