import { useEffect, useState } from "react";
import { Camera, CheckCircle2, MapPin, Mic, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import AddToHomeScreen from "@/components/AddToHomeScreen";
import { KIOSK_SETUP_KEY } from "@/lib/kiosk-setup";

type Status = "Not checked" | "Ready" | "Allow access" | "Not supported";

export default function KioskDeviceSetup({ active, voiceSupported }: { active: boolean; voiceSupported: boolean }) {
  const [open, setOpen] = useState(!localStorage.getItem(KIOSK_SETUP_KEY));
  const [busy, setBusy] = useState(false);
  const [camera, setCamera] = useState<Status>("Not checked");
  const [mic, setMic] = useState<Status>(voiceSupported ? "Not checked" : "Not supported");
  const [gps, setGps] = useState<Status>("Not checked");

  // A separate, credential-free manifest makes the installed icon open the clock, not payroll login.
  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!link) return;
    const original = link.href;
    const url = URL.createObjectURL(new Blob([JSON.stringify({
      id: "/kiosk", name: "Company Time Clock", short_name: "Time Clock", start_url: "/kiosk", scope: "/", display: "standalone",
      icons: [{ src: `${location.origin}/pwa-icon-192.png`, sizes: "192x192", type: "image/png" }, { src: `${location.origin}/pwa-icon-512.png`, sizes: "512x512", type: "image/png" }],
    })], { type: "application/manifest+json" }));
    link.href = url;
    return () => { link.href = original; URL.revokeObjectURL(url); };
  }, []);

  const check = async () => {
    setBusy(true);
    const media = async (kind: "video" | "audio") => {
      if (!navigator.mediaDevices?.getUserMedia) return "Not supported" as const;
      try {
        const stream = await navigator.mediaDevices.getUserMedia(kind === "video" ? { video: { facingMode: "user" } } : { audio: true });
        stream.getTracks().forEach((track) => track.stop());
        return "Ready" as const;
      } catch { return "Allow access" as const; }
    };
    setCamera(await media("video"));
    if (voiceSupported) setMic(await media("audio"));
    const locationStatus = await new Promise<Status>((resolve) => {
      if (!navigator.geolocation) return resolve("Not supported");
      navigator.geolocation.getCurrentPosition(() => resolve("Ready"), () => resolve("Allow access"), { enableHighAccuracy: true, timeout: 10000 });
    });
    setGps(locationStatus);
    setBusy(false);
  };

  return <section className={active ? "mb-4 border-b border-border pb-4" : "hidden"}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 font-semibold"><Settings2 size={18} />Device setup</h2>
      {!open && <Button variant="outline" size="sm" onClick={() => setOpen(true)}>Check device</Button>}
    </div>
    <div className={open ? "mt-3 space-y-3" : "hidden"}>
      <p className="text-sm text-muted-foreground">Allow camera, microphone and location when your device asks. Voice punches always require a selfie.</p>
      <div className="grid gap-2 sm:grid-cols-3">
        {([{ label: "Selfie camera", value: camera, Icon: Camera }, { label: "Voice commands", value: mic, Icon: Mic }, { label: "Location", value: gps, Icon: MapPin }]).map(({ label, value, Icon }) =>
          <div key={label} className="flex items-center gap-2 text-sm"><Icon size={18} className="text-primary" /><span>{label}: <strong>{value}</strong></span>{value === "Ready" && <CheckCircle2 size={16} className="text-primary" />}</div>)}
      </div>
      {(camera === "Allow access" || mic === "Allow access" || gps === "Allow access") && <p role="alert" className="text-sm text-destructive">Open this browser’s site permissions, allow the blocked access, then check again.</p>}
      <Button disabled={busy} onClick={() => void check()}>{busy ? "Waiting for device permissions…" : "Set up camera, voice & location"}</Button>
    </div>
    <div className={open ? "mt-3" : "hidden"}><AddToHomeScreen /></div>
    {open && <Button variant="ghost" className="mt-2" disabled={busy} onClick={() => { localStorage.setItem(KIOSK_SETUP_KEY, "1"); setOpen(false); }}>Continue to clock</Button>}
  </section>;
}