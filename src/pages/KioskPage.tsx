import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, Clock, Delete, LogIn, LogOut, Mic, Search, Utensils, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import AddToHomeScreen from "@/components/AddToHomeScreen";
import KioskDeviceSetup from "@/components/KioskDeviceSetup";
import { activationCode, KIOSK_SETUP_KEY, validActivationCode } from "@/lib/kiosk-setup";
import {
  DIR_LABEL, KioskError, cacheRoster, cachedRoster, kioskCall, kioskQueue, kioskToken, queueKioskPunch, setKioskToken, spokenDirection, syncKiosk,
  type KioskDir, type KioskPerson, type KioskRoster,
} from "@/lib/kiosk";

type Who = { person: KioskPerson | null; pin?: string; transcript?: string; voice: boolean; next?: Exclude<KioskDir, "auto">; lunchTaken?: boolean; offline?: boolean; name: string; selfie: boolean };
const SR = typeof window !== "undefined" ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : null;

function position(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("This tablet has no location"));
    navigator.geolocation.getCurrentPosition(
      (p) => { const v = { latitude: p.coords.latitude, longitude: p.coords.longitude }; localStorage.setItem("kiosk-last-pos", JSON.stringify(v)); resolve(v); },
      () => { const last = localStorage.getItem("kiosk-last-pos"); last ? resolve(JSON.parse(last)) : reject(new Error("Turn on location for this tablet")); },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 });
  });
}

function SelfieCamera({ auto, onShot }: { auto: boolean; onShot: (img: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [count, setCount] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    if (!navigator.mediaDevices?.getUserMedia) setErr("Camera not available in this browser. Open the clock in Safari or Chrome.");
    else navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 480 } }).then((s) => { if (cancelled) { s.getTracks().forEach((t) => t.stop()); return; } stream = s; if (video.current) video.current.srcObject = s; }).catch(() => setErr("Camera not available. Allow camera access for this tablet."));
    return () => { cancelled = true; stream?.getTracks().forEach((t) => t.stop()); };
  }, []);
  const shoot = useCallback(() => {
    const v = video.current; if (!v || !v.videoWidth) return;
    const c = document.createElement("canvas"); c.width = 320; c.height = Math.round(320 * v.videoHeight / v.videoWidth);
    const context = c.getContext("2d"); if (!context) return;
    context.drawImage(v, 0, 0, c.width, c.height);
    onShot(c.toDataURL("image/jpeg", 0.65));
  }, [onShot]);
  useEffect(() => {
    if (count === null) return;
    if (count === 0) { shoot(); return; }
    const t = setTimeout(() => setCount(count - 1), 1000); return () => clearTimeout(t);
  }, [count, shoot]);
  return (
    <div className="space-y-3 text-center">
      <div className="relative mx-auto aspect-[4/3] w-full max-w-sm overflow-hidden rounded-2xl bg-muted">
        <video ref={video} autoPlay playsInline muted onLoadedData={() => { setReady(true); if (auto) setCount(3); }} className="h-full w-full -scale-x-100 object-cover" />
        {count !== null && count > 0 && <span className="absolute inset-0 flex items-center justify-center text-7xl font-bold text-primary-foreground drop-shadow-lg">{count}</span>}
      </div>
      {err ? <p className="text-sm text-destructive">{err}</p> : !auto && <Button size="lg" disabled={!ready} className="h-14 w-full max-w-sm text-lg" onClick={shoot}><Camera className="mr-2" />Take selfie</Button>}
    </div>
  );
}

export default function KioskPage() {
  const [token, setToken] = useState(kioskToken());
  const [code, setCode] = useState(() => activationCode(location.search, location.hash));
  const initialActivation = useRef(false);
  const [activationError, setActivationError] = useState("");
  const [roster, setRoster] = useState<KioskRoster | null>(cachedRoster());
  const [now, setNow] = useState(new Date());
  const [online, setOnline] = useState(navigator.onLine);
  const [dept, setDept] = useState("All");
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<KioskPerson | null>(null);
  const [pin, setPin] = useState("");
  const [who, setWho] = useState<Who | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [wantSelfie, setWantSelfie] = useState(false);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");
  const [pending, setPending] = useState(kioskQueue().length);
  const [done, setDone] = useState<string | null>(null);
  const voiceDir = useRef<KioskDir>("auto");

  const reset = useCallback(() => { setPicked(null); setPin(""); setWho(null); setPhoto(null); setWantSelfie(false); setHeard(""); voiceDir.current = "auto"; }, []);

  const loadRoster = useCallback(async () => {
    const t = kioskToken(); if (!t) return;
    try { const r = await kioskCall<KioskRoster>({ action: "roster", token: t }); setRoster(r); cacheRoster(r); }
    catch (e) { if (e instanceof KioskError && e.deactivated) { setKioskToken(null); setToken(null); toast.error(e.message); } }
  }, []);

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 1000);
    const sync = () => { setOnline(navigator.onLine); void syncKiosk().then((r) => { setPending(kioskQueue().length); if (r.sent) toast.success(`${r.sent} saved punch(es) sent for manager review`); }); };
    const refresh = setInterval(() => { sync(); void loadRoster(); }, 60_000);
    window.addEventListener("online", sync); window.addEventListener("offline", sync);
    void loadRoster(); sync();
    return () => { clearInterval(tick); clearInterval(refresh); window.removeEventListener("online", sync); window.removeEventListener("offline", sync); };
  }, [token, loadRoster]);

  // Return to the name list after a minute of no activity so the next person starts fresh.
  useEffect(() => { if (!picked && !who) return; const t = setTimeout(reset, 60_000); return () => clearTimeout(t); }, [picked, who, pin, photo, reset]);
  useEffect(() => { if (!done) return; const t = setTimeout(() => setDone(null), 4000); return () => clearTimeout(t); }, [done]);

  const activate = async () => {
    if (!validActivationCode(code.trim().toUpperCase())) return;
    setActivationError("");
    setBusy(true);
    try { const r = await kioskCall<{ token: string; name: string }>({ action: "activate", code: code.trim() }); localStorage.removeItem(KIOSK_SETUP_KEY); setKioskToken(r.token); setToken(r.token); history.replaceState(null, "", "/kiosk"); toast.success(`${r.name} is ready`); }
    catch (e) { const message = e instanceof Error ? e.message : "Activation failed"; setActivationError(message); toast.error(message); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    if (initialActivation.current) return;
    initialActivation.current = true;
    if (!token && validActivationCode(code)) void activate();
  }, []);

  const identify = async (body: { employee_id?: string; pin?: string; transcript?: string }, person: KioskPerson | null) => {
    setBusy(true);
    try {
      const r = await kioskCall<{ name: string; next: Exclude<KioskDir, "auto">; lunch_taken: boolean; voice: boolean; selfie_required: boolean; employee_id: string }>({ action: "status", token, ...body });
      setWho({ person: person ?? roster?.employees.find((p) => p.id === r.employee_id) ?? null, ...body, voice: r.voice, next: r.next, lunchTaken: r.lunch_taken, name: r.name, selfie: r.selfie_required });
    } catch (e) {
      if (e instanceof KioskError && e.offline) {
        const local = person ?? matchLocal(body.transcript ?? "");
        if (!local) { toast.error("No internet and I couldn't match that name. Tap your name instead."); return; }
        setWho({ person: local, ...body, voice: !!body.transcript, offline: true, name: local.name, selfie: !!body.transcript || roster?.selfie_policy === "always" });
      } else { toast.error(e instanceof Error ? e.message : "Not accepted"); setPin(""); }
    } finally { setBusy(false); }
  };

  const matchLocal = (text: string) => {
    const t = ` ${text.toLowerCase()} `;
    const hits = roster?.employees.filter((p) => p.name && t.includes(` ${p.name.toLowerCase()} `)) ?? [];
    return hits.length === 1 ? hits[0] : null;
  };

  const punch = async (direction: KioskDir, shot = photo) => {
    if (!who) return;
    if (who.selfie && !shot) { toast.error("Take a selfie first"); return; }
    setBusy(true);
    let pos: { latitude: number; longitude: number };
    try { pos = await position(); } catch (e) { setBusy(false); toast.error(e instanceof Error ? e.message : "Location needed"); return; }
    const payload = { employee_id: who.person?.id, pin: who.pin, transcript: who.transcript, direction, ...pos, photo: shot ?? undefined };
    const label = direction === "auto" ? "Punch" : DIR_LABEL[direction];
    try {
      if (who.offline) throw new KioskError("No internet", true);
      const r = await kioskCall<{ direction: Exclude<KioskDir, "auto"> }>({ action: "punch", token, ...payload });
      setDone(`${DIR_LABEL[r.direction]} recorded for ${who.name} at ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}${who.voice ? " · a manager will check your selfie" : ""}`);
      reset();
    } catch (e) {
      if (e instanceof KioskError && e.offline) {
        queueKioskPunch({ ...payload, name: who.name });
        setPending(kioskQueue().length);
        setDone(`${label} saved on this tablet for ${who.name}. It will send when internet returns and a manager will confirm it.`);
        reset();
      } else toast.error(e instanceof Error ? e.message : "Punch not accepted");
    } finally { setBusy(false); }
  };

  const listen = () => {
    if (!SR) { toast.error("Voice isn't supported on this tablet's browser. Use Chrome."); return; }
    reset();
    const rec = new SR(); rec.lang = "en-US"; rec.interimResults = false; rec.maxAlternatives = 1;
    rec.onresult = (ev: any) => {
      const text = ev.results[0][0].transcript as string;
      setHeard(text); voiceDir.current = spokenDirection(text);
      void identify({ transcript: text }, null);
    };
    rec.onerror = () => toast.error("I didn't catch that. Try again.");
    rec.onend = () => setListening(false);
    setListening(true); rec.start();
  };

  const people = useMemo(() => (roster?.employees ?? []).filter((p) => (dept === "All" || p.department === dept) && p.name.toLowerCase().includes(search.toLowerCase())), [roster, dept, search]);
  const depts = useMemo(() => ["All", ...Array.from(new Set((roster?.employees ?? []).map((p) => p.department).filter(Boolean) as string[])).sort()], [roster]);
  useEffect(() => { if (roster?.device.department && depts.includes(roster.device.department)) setDept(roster.device.department); }, [roster?.device.department, depts]);

  if (!token) return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/15 via-background to-secondary/20 p-6">
      <div className="w-full max-w-md space-y-5 rounded-3xl border bg-card p-8 shadow-xl">
        <div className="flex items-center gap-3"><Clock className="h-10 w-10 text-primary" /><div><h1 className="text-2xl font-bold">Activate this clock</h1><p className="text-sm text-muted-foreground">Enter the code from Clock devices, or scan its QR code.</p></div></div>
        <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. 7F3A92C1" className="h-14 text-center font-mono text-2xl tracking-widest" maxLength={12} />
        {activationError && <p role="alert" className="text-sm text-destructive">{activationError}</p>}
        <Button size="lg" className="h-14 w-full text-lg" disabled={busy || !validActivationCode(code.trim().toUpperCase())} onClick={activate}>{busy ? "Activating your clock…" : activationError ? "Try activation again" : "Activate"}</Button>
        <AddToHomeScreen />
      </div>
    </main>
  );

  const selfieNeeded = who && (who.selfie || wantSelfie) && !photo;
  return (
    <main className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/15 p-4 md:p-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-card p-4 shadow-sm">
        <div><p className="text-sm text-muted-foreground">{roster?.company}</p><h1 className="text-xl font-bold">{roster?.device.name ?? "Time clock"}</h1></div>
        <div className="text-right"><p className="font-mono text-4xl font-bold tabular-nums text-primary">{now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })}</p><p className="text-sm text-muted-foreground">{now.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" })}</p></div>
      </header>
      <KioskDeviceSetup active={!!token} voiceSupported={!!SR} />
      {(!online || pending > 0) && <div className="mb-4 flex items-center gap-2 rounded-2xl bg-accent/30 p-3 text-sm"><WifiOff className="h-4 w-4" />{!online ? "No internet. Punches are saved on this tablet." : ""} {pending > 0 && `${pending} punch(es) waiting to send.`}</div>}
      {done && <div role="status" className="mb-4 rounded-2xl bg-primary p-5 text-center text-lg font-semibold text-primary-foreground">{done}</div>}

      {!picked && !who && (
        <section className="space-y-4">
          <Button onClick={listen} disabled={!SR || listening || busy} className="min-h-20 h-auto py-5 whitespace-normal w-full rounded-3xl bg-secondary text-xl text-secondary-foreground hover:bg-secondary/90">
            <Mic className="mr-3 h-7 w-7" />{listening ? "Listening… say your name and “clock in”" : "Hands-free: tap once, then say your full name"}
          </Button>
          {!SR && <p className="text-sm text-muted-foreground">Voice is unavailable in this browser. Use name and PIN, or open in a voice-supported browser.</p>}
          {heard && <p className="text-center text-sm text-muted-foreground">Heard: “{heard}”</p>}
          <div className="flex flex-wrap gap-2">{depts.map((d) => <Button key={d} variant={d === dept ? "default" : "outline"} className="h-11 rounded-full" onClick={() => setDept(d)}>{d}</Button>)}</div>
          <div className="relative"><Search className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find your name" className="h-12 pl-10 text-lg" /></div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {people.map((p) => (
              <button key={p.id} onClick={() => setPicked(p)} className="flex min-h-24 flex-col items-center justify-center rounded-2xl border bg-card p-3 text-center shadow-sm transition active:scale-95">
                <span className="mb-1 flex h-11 w-11 items-center justify-center rounded-full bg-primary/15 text-lg font-bold text-primary">{p.name.split(" ").map((x) => x[0]).slice(0, 2).join("")}</span>
                <span className="font-semibold leading-tight">{p.name}</span>
              </button>
            ))}
            {!people.length && <p className="col-span-full py-10 text-center text-muted-foreground">No staff with a switched-on clock{dept !== "All" ? " in this department" : ""}.</p>}
          </div>
        </section>
      )}

      {picked && !who && (
        <section className="mx-auto max-w-sm space-y-4 rounded-3xl bg-card p-6 text-center shadow">
          <h2 className="text-2xl font-bold">{picked.name}</h2><p className="text-muted-foreground">Enter your PIN</p>
          <p className="font-mono text-4xl tracking-[0.5em]">{"•".repeat(pin.length) || "\u00a0"}</p>
          <div className="grid grid-cols-3 gap-3">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => <Button key={d} variant="outline" className="h-16 text-2xl" onClick={() => setPin((p) => (p + d).slice(0, 6))}>{d}</Button>)}
            <Button variant="ghost" className="h-16" onClick={reset}>Cancel</Button>
            <Button variant="outline" className="h-16 text-2xl" onClick={() => setPin((p) => (p + "0").slice(0, 6))}>0</Button>
            <Button variant="ghost" className="h-16" aria-label="Delete" onClick={() => setPin((p) => p.slice(0, -1))}><Delete /></Button>
          </div>
          <Button size="lg" className="h-14 w-full text-lg" disabled={busy || pin.length < 4} onClick={() => identify({ employee_id: picked.id, pin }, picked)}>Continue</Button>
        </section>
      )}

      {who && (
        <section className="mx-auto max-w-md space-y-4 rounded-3xl bg-card p-6 text-center shadow">
          <h2 className="text-2xl font-bold">Hi {who.name.split(" ")[0]}</h2>
          {who.offline && <p className="text-sm text-muted-foreground">No internet: your punch will be saved and checked by a manager.</p>}
          {selfieNeeded ? (
            <>
              <p className="text-muted-foreground">{who.voice ? "Look at the camera. Your selfie confirms it's you." : "Take a selfie for this punch."}</p>
              <SelfieCamera auto={who.voice} onShot={(img) => { setPhoto(img); if (who.voice) void punch(voiceDir.current, img); }} />
            </>
          ) : (
            <>
              {photo && <img src={photo} alt="Your selfie" className="mx-auto h-28 rounded-xl" />}
              <div className="grid gap-3">
                {(who.offline ? (["clock_in", "lunch_out", "lunch_in", "clock_out"] as const) : who.next === "clock_in" ? (["clock_in"] as const) : who.next === "lunch_in" ? (["lunch_in", "clock_out"] as const) : who.lunchTaken ? (["clock_out"] as const) : (["lunch_out", "clock_out"] as const)).map((d) => (
                  <Button key={d} disabled={busy} onClick={() => punch(d)} className={`h-16 text-xl ${d === "clock_out" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : d.startsWith("lunch") ? "bg-accent text-accent-foreground hover:bg-accent/90" : ""}`}>
                    {d === "clock_in" ? <LogIn className="mr-2" /> : d === "clock_out" ? <LogOut className="mr-2" /> : <Utensils className="mr-2" />}{DIR_LABEL[d]}
                  </Button>
                ))}
              </div>
              {!who.selfie && !photo && <Button variant="outline" className="h-12 w-full" onClick={() => setWantSelfie(true)}><Camera className="mr-2" />Add a selfie</Button>}
            </>
          )}
          <Button variant="ghost" className="h-12 w-full" onClick={reset}>Not me / cancel</Button>
        </section>
      )}
    </main>
  );
}
