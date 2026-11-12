import { useEffect, useState } from "react";
import { Download, Share, PlusSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { tagLinkWithDeviceId } from "@/lib/clock-device-id";

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;

/** Lets staff pin the clock app to their phone or desktop home screen. */
export default function AddToHomeScreen({ staffClock = false }: { staffClock?: boolean }) {
  const [prompt, setPrompt] = useState<PromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone());
  const [help, setHelp] = useState(false);
  const ua = navigator.userAgent;
  const ios = /iphone|ipad|ipod/i.test(ua) || (ua.includes("Mac") && "ontouchend" in document);

  useEffect(() => {
    if (!staffClock || isStandalone()) return;
    tagLinkWithDeviceId();
    // Clock-specific manifest so the installed icon opens this clock (Android) and is named correctly.
    const start = window.location.pathname + window.location.hash;
    const manifest = { id: window.location.pathname, name: "Staff Time Clock", short_name: "Time Clock", start_url: window.location.origin + start, scope: window.location.origin + "/", display: "standalone", background_color: "#06516b", theme_color: "#06516b",
      icons: [192, 512].map((n) => ({ src: `${window.location.origin}/pwa-icon-${n}.png`, sizes: `${n}x${n}`, type: "image/png" })) };
    let link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    const created = !link;
    if (!link) { link = document.createElement("link"); link.rel = "manifest"; document.head.appendChild(link); }
    const prev = link.href;
    link.href = "data:application/manifest+json," + encodeURIComponent(JSON.stringify(manifest));
    return () => { if (created) link?.remove(); else if (link) link.href = prev; };
  }, [staffClock]);

  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setPrompt(e as PromptEvent); };
    const onInstalled = () => { setInstalled(true); setPrompt(null); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  if (installed) return null;

  const install = async () => {
    if (prompt) { await prompt.prompt(); const c = await prompt.userChoice; if (c.outcome === "accepted") setInstalled(true); setPrompt(null); }
    else setHelp(true);
  };

  return (
    <div className="rounded-lg border-2 border-primary/40 bg-primary/5 p-3 text-left space-y-2">
      <Button className="w-full min-h-11" onClick={install}><Download size={18} />Add app to my home screen</Button>
      {help && (
        <div className="relative text-sm space-y-1 pt-1">
          <button aria-label="Close" className="absolute right-0 top-0 p-1 text-muted-foreground" onClick={() => setHelp(false)}><X size={16} /></button>
          {ios ? (
            <>
              <p className="font-semibold">iPhone / iPad — use Safari (not WhatsApp or Chrome):</p>
              <p className="flex items-center gap-1">1. Tap <Share size={14} /> Share at the bottom.</p>
              <p className="flex items-center gap-1">2. Tap <PlusSquare size={14} /> “Add to Home Screen”, then “Add”.</p>
              <p>3. Open the new Time Clock icon and clock in from there.</p>
            </>
          ) : (
            <>
              <p className="font-semibold">Android (Chrome) or computer:</p>
              <p>1. Tap the ⋮ menu (top right).</p>
              <p>2. Tap “Add to Home screen” or “Install app”.</p>
              <p className="text-muted-foreground">If this opened inside WhatsApp or email, first tap ⋮ → “Open in browser”.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
