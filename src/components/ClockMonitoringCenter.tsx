import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bot, Check, CheckCircle2, Clock3, CloudCog, ExternalLink, Eye, MapPin, RefreshCw, ShieldAlert, Smartphone, Tablet, Wifi, WifiOff } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import { SummaryCard } from "@/components/SummaryCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import {
  CLOCK_STATUS_LABELS,
  clockIsWorking,
  clockLocationLabel,
  clockNeedsAttention,
  clockStatusTone,
  filterMonitoredClocks,
  type ClockFilter,
  type ClockIncident,
  type ClockMonitoringData,
  type MonitoredClock,
} from "@/lib/clock-monitoring";

const timeAgo = (value: string | null) => {
  if (!value) return "Never";
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
};

const toneClasses = {
  success: "border-success/30 bg-success/10 text-success",
  warning: "border-warning/40 bg-warning/15 text-warning-foreground",
  destructive: "border-destructive/40 bg-destructive/10 text-destructive",
  muted: "border-border bg-muted text-muted-foreground",
};

function ClockMap({ clocks, selected, onSelect }: { clocks: MonitoredClock[]; selected?: MonitoredClock; onSelect: (key: string) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markers = useRef<L.LayerGroup | null>(null);
  const first = clocks[0];

  useEffect(() => {
    if (!container.current || map.current) return;
    map.current = L.map(container.current, { scrollWheelZoom: false }).setView([first?.latitude ?? 13.9094, first?.longitude ?? -60.9789], 11);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(map.current);
    markers.current = L.layerGroup().addTo(map.current);
    window.setTimeout(() => map.current?.invalidateSize(), 0);
    return () => { map.current?.remove(); map.current = null; markers.current = null; };
  }, []);

  useEffect(() => {
    if (!map.current || !markers.current) return;
    markers.current.clearLayers();
    for (const clock of clocks) {
      if (clock.latitude == null || clock.longitude == null) continue;
      const color = clockNeedsAttention(clock) ? "hsl(var(--destructive))" : "hsl(var(--primary))";
      const marker = L.circleMarker([clock.latitude, clock.longitude], { radius: clockNeedsAttention(clock) ? 12 : 10, color, fillColor: color, fillOpacity: 0.85, weight: 3 });
      const popup = document.createElement("div");
      const name = document.createElement("strong");
      name.textContent = clock.name;
      const detail = document.createElement("div");
      detail.textContent = `${CLOCK_STATUS_LABELS[clock.status]} · ${clockLocationLabel(clock)} · ${timeAgo(clock.last_seen_at)}`;
      popup.append(name, detail);
      marker.bindPopup(popup).on("click", () => onSelect(`${clock.type}:${clock.id}`));
      markers.current.addLayer(marker);
    }
    if (selected?.latitude != null && selected.longitude != null) map.current.setView([selected.latitude, selected.longitude], 15, { animate: true });
    else if (first?.latitude != null && first.longitude != null) map.current.setView([first.latitude, first.longitude], 11);
  }, [clocks, selected, first, onSelect]);

  return <div ref={container} className="h-[360px] w-full" aria-label="Map of reported clock locations" />;
}

export default function ClockMonitoringCenter() {
  const { isAdmin } = useRole();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const initialFilter = (params.get("clock_view") || "all") as ClockFilter;
  const [data, setData] = useState<ClockMonitoringData | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [siteFilter, setSiteFilter] = useState("all");
  const filter: ClockFilter = ["all", "attention", "working", "shared", "personal"].includes(initialFilter) ? initialFilter : "all";

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    const { data: result, error: loadError } = await supabase.rpc("clock_monitoring");
    if (loadError) setError(loadError.message);
    else {
      setData(result as unknown as ClockMonitoringData);
      setError("");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const refresh = window.setInterval(() => void load(true), 60_000);
    const focus = () => void load(true);
    window.addEventListener("focus", focus);
    const channel = supabase.channel(`clock-monitoring-${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "clock_incidents" }, () => void load(true))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "workforce_punches" }, () => void load(true))
      .subscribe();
    return () => {
      window.clearInterval(refresh);
      window.removeEventListener("focus", focus);
      void supabase.removeChannel(channel);
    };
  }, [load]);

  const clocks = useMemo(() => data?.clocks ?? [], [data]);
  const incidents = useMemo(() => data?.incidents ?? [], [data]);
  const sites = useMemo(() => [...new Set(clocks.map((clock) => clock.site_name).filter(Boolean) as string[])].sort(), [clocks]);
  const visible = useMemo(() => filterMonitoredClocks(clocks, filter).filter((clock) => siteFilter === "all" || clock.site_name === siteFilter), [clocks, filter, siteFilter]);
  const located = visible.filter((clock) => clock.latitude != null && clock.longitude != null);
  const selected = clocks.find((clock) => `${clock.type}:${clock.id}` === selectedId) ?? located[0];
  const working = clocks.filter(clockIsWorking).length;
  const shared = clocks.filter((clock) => clock.type === "shared");
  const sharedOnline = shared.filter((clock) => clock.status === "online").length;
  const attention = clocks.filter(clockNeedsAttention).length;

  const chooseFilter = (next: ClockFilter) => {
    const updated = new URLSearchParams(params);
    if (next === "all") updated.delete("clock_view");
    else updated.set("clock_view", next);
    setParams(updated);
  };

  const runCheck = async () => {
    setChecking(true);
    const { data: result, error: checkError } = await supabase.functions.invoke("ai-paymaster", { body: { monitoring: true } });
    setChecking(false);
    if (checkError || result?.error) {
      toast.error("AI clock check is unavailable. The live dashboard still shows the latest saved heartbeats.");
      return;
    }
    await load(true);
    const count = result?.monitoring?.new_incidents ?? 0;
    toast.success(count ? `AI Paymaster found ${count} new clock incident${count === 1 ? "" : "s"}.` : "AI Paymaster checked every clock. No new failure was found. No payroll was changed.");
  };

  const reviewIncident = async (incident: ClockIncident, action: "acknowledge" | "resolve") => {
    if (action === "resolve" && !window.confirm(`Resolve “${incident.title}”? If the problem is still present, the next automatic health check will open a new alert.`)) return;
    const { error: reviewError } = await supabase.rpc("review_clock_incident", { _id: incident.id, _action: action });
    if (reviewError) toast.error(reviewError.message);
    else {
      toast.success(action === "acknowledge" ? "Incident acknowledged. It remains visible until resolved." : "Incident resolved.");
      await load(true);
    }
  };

  const openOfflineReview = () => {
    const updated = new URLSearchParams(params);
    updated.set("filter", "review");
    setParams(updated);
    window.setTimeout(() => document.getElementById("live-shift-details")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  return (
    <section aria-labelledby="clock-monitoring-title" className="overflow-hidden rounded-3xl border border-sidebar-border bg-sidebar text-sidebar-foreground shadow-elevated">
      <div className="carib-band border-b border-sidebar-border p-4 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="rounded-2xl bg-sidebar-primary/15 p-3 text-sidebar-primary"><CloudCog className="h-7 w-7" /></span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="clock-monitoring-title" className="text-xl font-bold md:text-2xl">Clock Monitoring Center</h2>
                <Badge className="border-success/30 bg-success/15 text-success"><span className="mr-1.5 h-2 w-2 animate-pulse rounded-full bg-success" />Live</Badge>
              </div>
              <p className="mt-1 max-w-2xl text-sm text-sidebar-foreground/75">Every shared tablet and enabled personal clock, its latest activity, work site, connectivity and review status.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent/80" disabled={checking} onClick={() => void runCheck()}><Bot className={cn("mr-2 h-4 w-4", checking && "animate-pulse")} />{checking ? "AI checking…" : "AI health check"}</Button>
            <Button variant="outline" className="border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent/80" onClick={() => void load()}><RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />Refresh</Button>
            {isAdmin && <Button variant="outline" className="border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent/80" onClick={() => navigate("/clock-devices")}><Tablet className="mr-2 h-4 w-4" />Manage tablets</Button>}
          </div>
        </div>
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-sidebar-primary/25 bg-sidebar-primary/10 p-3 text-sm text-sidebar-foreground/85">
          <Bot className="mt-0.5 h-4 w-4 shrink-0 text-sidebar-primary" />
          <p><strong>AI Paymaster is watching:</strong> the existing five-minute attendance check detects silent tablets and synced offline punches, raises one deduplicated incident, and clears it after recovery or manager review. It never changes hours or payroll.</p>
        </div>
      </div>

      <div className="space-y-5 p-4 md:p-6">
        {error && <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm"><p>Unable to load the monitoring center: {error}</p><Button variant="link" className="h-auto p-0 text-sidebar-primary" onClick={() => void load()}>Try again</Button></div>}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryCard label="All clocks" value={clocks.length} icon={Clock3} active={filter === "all"} onClick={() => chooseFilter("all")} className="border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground" />
          <SummaryCard label="Shared tablets online" value={`${sharedOnline} / ${shared.length}`} icon={Wifi} active={filter === "shared"} onClick={() => chooseFilter("shared")} className="border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground" />
          <SummaryCard label="Staff on clock" value={working} icon={Smartphone} active={filter === "working"} onClick={() => chooseFilter("working")} className="border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground" />
          <SummaryCard label="Needs attention" value={attention} icon={ShieldAlert} active={filter === "attention"} onClick={() => chooseFilter("attention")} className="border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground" valueClassName={attention || incidents.length ? "text-sidebar-primary" : "text-success"} />
        </div>

        {incidents.length > 0 && (
          <div className="space-y-3 rounded-2xl border border-warning/30 bg-warning/10 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="flex items-center gap-2 font-semibold"><ShieldAlert className="h-5 w-5 text-warning" />Active clock incidents ({incidents.length})</h3><span className="text-xs text-sidebar-foreground/65">Acknowledge when seen; resolve only after corrective action.</span></div>
            {incidents.map((incident) => (
              <article key={incident.id} className="rounded-xl border border-sidebar-border bg-sidebar-accent p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><div className="flex flex-wrap items-center gap-2"><Badge variant={incident.severity === "high" ? "destructive" : "secondary"}>{incident.severity === "high" ? "Urgent" : "Review"}</Badge><Badge variant="outline" className="border-sidebar-border text-sidebar-foreground/75">{incident.status === "open" ? "New" : "Acknowledged"}</Badge><h4 className="font-semibold">{incident.title}</h4></div><p className="mt-1 text-sm text-sidebar-foreground/75">{incident.detail}</p><p className="mt-1 text-xs text-sidebar-foreground/60">First detected {new Date(incident.first_detected_at).toLocaleString()} · Latest check {timeAgo(incident.last_detected_at)}</p></div>
                  <div className="flex flex-wrap gap-2">{incident.kind === "offline_sync_review" && <Button size="sm" variant="outline" className="border-sidebar-border bg-sidebar text-sidebar-foreground" onClick={openOfflineReview}><Eye className="mr-1 h-4 w-4" />Review punches</Button>}{incident.status === "open" && <Button size="sm" variant="outline" className="border-sidebar-border bg-sidebar text-sidebar-foreground" onClick={() => void reviewIncident(incident, "acknowledge")}><Check className="mr-1 h-4 w-4" />Acknowledge</Button>}<Button size="sm" variant="outline" className="border-sidebar-border bg-sidebar text-sidebar-foreground" onClick={() => void reviewIncident(incident, "resolve")}><CheckCircle2 className="mr-1 h-4 w-4" />Resolve</Button></div>
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-sidebar-foreground/70">Showing {visible.length} clock{visible.length === 1 ? "" : "s"}{data ? ` · checked ${timeAgo(data.generated_at)}` : ""}</p>
          <label className="flex items-center gap-2 text-sm"><span className="text-sidebar-foreground/70">Work site</span><NativeSelect value={siteFilter} onChange={(event) => setSiteFilter(event.target.value)} className="min-w-44 border-sidebar-border bg-sidebar-accent text-sidebar-foreground"><option value="all">All work sites</option>{sites.map((site) => <option key={site} value={site}>{site}</option>)}</NativeSelect></label>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
          <div className="space-y-3">
            {loading && !data ? <p className="rounded-xl border border-sidebar-border p-8 text-center text-sidebar-foreground/65">Locating company clocks…</p> : visible.map((clock) => {
              const key = `${clock.type}:${clock.id}`;
              const tone = clockStatusTone(clock);
              return (
                <button key={key} type="button" onClick={() => setSelectedId(key)} className={cn("w-full rounded-2xl border bg-sidebar-accent p-4 text-left transition hover:border-sidebar-primary/60", selected?.id === clock.id && selected.type === clock.type ? "border-sidebar-primary ring-1 ring-sidebar-primary" : "border-sidebar-border")}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3"><span className="rounded-xl bg-sidebar-primary/15 p-2 text-sidebar-primary">{clock.type === "shared" ? <Tablet className="h-5 w-5" /> : <Smartphone className="h-5 w-5" />}</span><div className="min-w-0"><h3 className="truncate font-semibold">{clock.name}</h3><p className="text-xs capitalize text-sidebar-foreground/60">{clock.type === "shared" ? "Shared tablet" : "Personal clock"}{clock.department ? ` · ${clock.department}` : ""}</p></div></div>
                    <Badge className={cn("shrink-0 border", toneClasses[tone])}>{clock.status === "offline" && <WifiOff className="mr-1 h-3 w-3" />}{CLOCK_STATUS_LABELS[clock.status]}</Badge>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2"><p className="text-sidebar-foreground/80"><span className="text-sidebar-foreground/55">Activity:</span> {clock.current_activity || "No activity reported"}</p><p className="text-sidebar-foreground/80"><span className="text-sidebar-foreground/55">Today:</span> {clock.punches_today} punch{clock.punches_today === 1 ? "" : "es"}</p><p className="flex items-center gap-1 text-sidebar-foreground/80"><MapPin className="h-3.5 w-3.5 text-sidebar-primary" />{clockLocationLabel(clock)}</p><p className="text-sidebar-foreground/70"><span className="text-sidebar-foreground/55">Last seen:</span> {timeAgo(clock.last_seen_at)}</p></div>
                  {clock.latitude != null && clock.longitude != null && <span className="mt-2 inline-flex items-center gap-1 text-xs text-sidebar-primary">View last reported location <ExternalLink className="h-3 w-3" /></span>}
                </button>
              );
            })}
            {data && !visible.length && <p className="rounded-2xl border border-dashed border-sidebar-border p-8 text-center text-sidebar-foreground/65">No clocks match this view. Personal clocks appear after an administrator enables an employee’s clock schedule.</p>}
          </div>

          <div className="overflow-hidden rounded-2xl border border-sidebar-border bg-sidebar-accent">
            <div className="border-b border-sidebar-border p-3"><h3 className="flex items-center gap-2 font-semibold"><MapPin className="h-5 w-5 text-sidebar-primary" />Clock locations</h3><p className="text-xs text-sidebar-foreground/60">Assigned site or latest punch location. Select a clock to focus the map.</p></div>
            {located.length ? <ClockMap clocks={located} selected={selected} onSelect={setSelectedId} /> : <div className="flex h-[300px] items-center justify-center p-8 text-center text-sm text-sidebar-foreground/60">No mapped clocks in this view. Add a work site or record a located punch to see positions here.</div>}
            {selected && <div className="border-t border-sidebar-border p-3 text-sm"><p className="font-semibold">{selected.name}</p><p className="text-sidebar-foreground/70">{CLOCK_STATUS_LABELS[selected.status]} · {clockLocationLabel(selected)}</p>{selected.latitude != null && selected.longitude != null && <a className="mt-1 inline-flex items-center gap-1 text-sidebar-primary underline" href={`https://www.openstreetmap.org/?mlat=${selected.latitude}&mlon=${selected.longitude}#map=17/${selected.latitude}/${selected.longitude}`} target="_blank" rel="noreferrer">Open map <ExternalLink className="h-3 w-3" /></a>}</div>}
          </div>
        </div>
      </div>
    </section>
  );
}
