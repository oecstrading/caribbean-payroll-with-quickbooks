import { useEffect, useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { MapPin, Clock, Shield, Users, RefreshCw, Radio, ChevronRight, Filter, Route, AlertTriangle, Siren } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import { toast } from "sonner";
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const greenIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});
const redIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});
const siteIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});
const orangeIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [20, 33], iconAnchor: [10, 33], popupAnchor: [1, -28], shadowSize: [33, 33],
});

interface ActivePunch {
  id: string;
  user_id: string;
  punch_type: string;
  latitude: number | null;
  longitude: number | null;
  within_geofence: boolean | null;
  punched_at: string;
  address_label: string | null;
  guard_name?: string;
}

interface SiteWithCoords {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  radius_meters: number;
  address: string | null;
  jurisdiction_id: string | null;
}

interface TrailPoint {
  id: string;
  latitude: number | null;
  longitude: number | null;
  punched_at: string;
  punch_type: string;
  address_label: string | null;
}

function FlyTo({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => { map.flyTo([lat, lng], 16, { duration: 1 }); }, [lat, lng, map]);
  return null;
}

function timeSince(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function CommandCenterPage() {
  const { isAdminOrManager } = useRole();
  const [punches, setPunches] = useState<ActivePunch[]>([]);
  const [sites, setSites] = useState<SiteWithCoords[]>([]);
  const [jurisdictions, setJurisdictions] = useState<{ id: string; code: string; name: string }[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [selectedGuard, setSelectedGuard] = useState<{ lat: number; lng: number } | null>(null);
  const [isLive, setIsLive] = useState(true);
  const [filterJurisdiction, setFilterJurisdiction] = useState<string>("all");
  const [recentViolations, setRecentViolations] = useState<ActivePunch[]>([]);
  // Emergency alerts
  const [emergencyAlerts, setEmergencyAlerts] = useState<any[]>([]);
  const [resolveAlertId, setResolveAlertId] = useState<string | null>(null);
  const [resolveNotes, setResolveNotes] = useState("");
  // Trail/breadcrumb state
  const [trailGuardId, setTrailGuardId] = useState<string>("");
  const [trailDate, setTrailDate] = useState(new Date().toISOString().split("T")[0]);
  const [trailPoints, setTrailPoints] = useState<TrailPoint[]>([]);
  const [showTrail, setShowTrail] = useState(false);
  const channelRef = useRef<any>(null);
  const emergencyChannelRef = useRef<any>(null);

  const fetchData = useCallback(async () => {
    const today = new Date().toISOString().split("T")[0];
    const [punchesRes, sitesRes, profilesRes, jurRes] = await Promise.all([
      supabase
        .from("clock_punches")
        .select("id, user_id, punch_type, latitude, longitude, within_geofence, punched_at, address_label")
        .gte("punched_at", today + "T00:00:00")
        .order("punched_at", { ascending: false }),
      supabase
        .from("client_sites")
        .select("id, name, latitude, longitude, radius_meters, address, jurisdiction_id")
        .eq("status", "active"),
      supabase.from("profiles").select("user_id, first_name, last_name"),
      supabase.from("jurisdictions").select("id, code, name"),
    ]);

    const profMap: Record<string, string> = {};
    (profilesRes.data || []).forEach((p: any) => {
      profMap[p.user_id] = `${p.first_name} ${p.last_name}`.trim() || "Unknown";
    });

    setProfiles(profMap);
    setSites(sitesRes.data || []);
    setJurisdictions((jurRes.data as any[]) || []);

    const latestByUser = new Map<string, ActivePunch>();
    (punchesRes.data || []).forEach((p: any) => {
      if (!latestByUser.has(p.user_id)) {
        latestByUser.set(p.user_id, { ...p, guard_name: profMap[p.user_id] || "Unknown" });
      }
    });
    setPunches(Array.from(latestByUser.values()));
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Fetch active emergency alerts
  useEffect(() => {
    const fetchEmergencies = async () => {
      const { data } = await supabase
        .from("emergency_alerts")
        .select("*")
        .eq("status", "active")
        .order("created_at", { ascending: false });
      setEmergencyAlerts(data || []);
    };
    fetchEmergencies();
  }, []);

  // Emergency alerts realtime
  useEffect(() => {
    const channel = supabase
      .channel("live-emergencies")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "emergency_alerts" }, (payload) => {
        const alert = payload.new as any;
        const guardName = profiles[alert.user_id] || "Guard";

        // Play alarm sound
        try {
          const audioCtx = new AudioContext();
          for (let i = 0; i < 5; i++) {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.frequency.value = i % 2 === 0 ? 1200 : 800;
            osc.type = "square";
            gain.gain.value = 0.4;
            osc.start(audioCtx.currentTime + i * 0.3);
            osc.stop(audioCtx.currentTime + i * 0.3 + 0.2);
          }
        } catch {}

        toast.error(`🚨 EMERGENCY: ${guardName} triggered PANIC ALERT!`, {
          duration: 30000,
          description: "Tap to view on map",
        });

        setEmergencyAlerts((prev) => [{ ...alert, guard_name: guardName }, ...prev]);

        // Auto-center map on the emergency
        if (alert.latitude && alert.longitude) {
          setSelectedGuard({ lat: alert.latitude, lng: alert.longitude });
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "emergency_alerts" }, (payload) => {
        const updated = payload.new as any;
        if (updated.status !== "active") {
          setEmergencyAlerts((prev) => prev.filter((a) => a.id !== updated.id));
        }
      })
      .subscribe();
    emergencyChannelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [profiles]);

  const resolveEmergency = async (alertId: string) => {
    const { error } = await supabase
      .from("emergency_alerts")
      .update({
        status: "resolved",
        resolved_by: (await supabase.auth.getUser()).data.user?.id,
        resolved_at: new Date().toISOString(),
        resolution_notes: resolveNotes,
      })
      .eq("id", alertId);
    if (error) { toast.error("Failed to resolve alert"); return; }
    setEmergencyAlerts((prev) => prev.filter((a) => a.id !== alertId));
    setResolveAlertId(null);
    setResolveNotes("");
    toast.success("Emergency alert resolved");
  };

  // Realtime
  useEffect(() => {
    if (!isLive) {
      if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null; }
      return;
    }
    const channel = supabase
      .channel("live-clock-punches")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "clock_punches" }, (payload) => {
        const newPunch = payload.new as any;
        const guardName = profiles[newPunch.user_id] || "Guard";
        
        // Check for geofence violation
        if (newPunch.within_geofence === false) {
          toast.error(`⚠️ GEOFENCE VIOLATION: ${guardName}`, {
            description: `Attempted clock-in outside zone at ${newPunch.address_label || "Unknown site"}`,
            duration: 15000,
          });
          setRecentViolations((prev) => [{ ...newPunch, guard_name: guardName }, ...prev].slice(0, 10));
        } else {
          toast.info(`${newPunch.punch_type === "clock_in" ? "🟢" : "🔴"} ${guardName} ${newPunch.punch_type.replace("_", " ")}`, {
            description: newPunch.address_label || "Unknown site",
          });
        }
        
        setPunches((prev) => {
          const filtered = prev.filter((p) => p.user_id !== newPunch.user_id);
          return [{ ...newPunch, guard_name: guardName }, ...filtered];
        });
      })
      .subscribe();
    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [isLive, profiles]);

  // Fetch trail for a specific guard + date
  const fetchTrail = async () => {
    if (!trailGuardId) { toast.error("Select a guard"); return; }
    const { data } = await supabase
      .from("clock_punches")
      .select("id, latitude, longitude, punched_at, punch_type, address_label")
      .eq("user_id", trailGuardId)
      .gte("punched_at", trailDate + "T00:00:00")
      .lte("punched_at", trailDate + "T23:59:59")
      .order("punched_at", { ascending: true });
    setTrailPoints(data || []);
    setShowTrail(true);
    if (data && data.length > 0 && data[0].latitude && data[0].longitude) {
      setSelectedGuard({ lat: data[0].latitude, lng: data[0].longitude });
    }
    toast.success(`${data?.length || 0} checkpoints found`);
  };

  // Filter sites and punches by jurisdiction
  const filteredSites = filterJurisdiction === "all"
    ? sites
    : sites.filter((s) => s.jurisdiction_id === filterJurisdiction);

  // Build a set of site IDs for the filtered jurisdiction
  const filteredSiteNames = new Set(filteredSites.map((s) => s.name));
  const filteredPunches = filterJurisdiction === "all"
    ? punches
    : punches.filter((p) => !p.address_label || filteredSiteNames.has(p.address_label));

  const clockedIn = filteredPunches.filter((p) => p.punch_type === "clock_in");
  const withinGeofence = clockedIn.filter((p) => p.within_geofence);
  const outsideGeofence = clockedIn.filter((p) => !p.within_geofence);

  // Trail line coords
  const trailCoords: [number, number][] = trailPoints
    .filter((p) => p.latitude && p.longitude)
    .map((p) => [p.latitude!, p.longitude!]);

  const defaultCenter: [number, number] = [13.9094, -60.9789];
  const mapCenter = selectedGuard
    ? [selectedGuard.lat, selectedGuard.lng] as [number, number]
    : clockedIn.length > 0 && clockedIn[0].latitude
      ? [clockedIn[0].latitude, clockedIn[0].longitude!] as [number, number]
      : defaultCenter;

  // Guard list for trail dropdown
  const guardList = Object.entries(profiles).map(([id, name]) => ({ id, name }));

  if (!isAdminOrManager) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <Shield size={48} className="mx-auto mb-4 text-muted-foreground/30" />
        <h2 className="text-lg font-display font-semibold">Access Restricted</h2>
        <p className="text-sm">The Command Center is only available to administrators and managers.</p>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex flex-col">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 md:px-6 py-3 border-b border-border bg-card">
        <div>
          <h1 className="text-lg md:text-xl font-display font-bold text-foreground flex items-center gap-2">
            <Radio size={20} className={isLive ? "text-primary animate-pulse" : "text-muted-foreground"} />
            Command Center
          </h1>
          <p className="text-xs text-muted-foreground">Real-time guard operations across all sites</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Island filter */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-secondary text-xs">
            <Filter size={12} className="text-muted-foreground" />
            <select
              value={filterJurisdiction}
              onChange={(e) => setFilterJurisdiction(e.target.value)}
              className="bg-transparent text-foreground text-xs border-none outline-none cursor-pointer"
            >
              <option value="all">All Islands</option>
              {jurisdictions.map((j) => (
                <option key={j.id} value={j.id}>{j.name}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => setIsLive(!isLive)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              isLive ? "bg-primary/10 text-primary border border-primary/30" : "bg-secondary text-muted-foreground"
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${isLive ? "bg-primary animate-pulse" : "bg-muted-foreground"}`} />
            {isLive ? "LIVE" : "PAUSED"}
          </button>
          <button onClick={fetchData} className="p-2 rounded-lg bg-secondary text-muted-foreground hover:bg-muted transition-colors" title="Refresh">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 px-4 md:px-6 py-3 bg-card/50 border-b border-border">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/50">
          <Users size={14} className="text-primary" />
          <div><p className="text-xs text-muted-foreground">Active Guards</p><p className="text-base font-display font-bold text-foreground">{clockedIn.length}</p></div>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/50">
          <MapPin size={14} className="text-primary" />
          <div><p className="text-xs text-muted-foreground">In Geofence</p><p className="text-base font-display font-bold text-primary">{withinGeofence.length}</p></div>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/50">
          <MapPin size={14} className="text-destructive" />
          <div><p className="text-xs text-muted-foreground">Outside Zone</p><p className="text-base font-display font-bold text-destructive">{outsideGeofence.length}</p></div>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/50">
          <Shield size={14} className="text-primary" />
          <div><p className="text-xs text-muted-foreground">Total Sites</p><p className="text-base font-display font-bold text-foreground">{filteredSites.length}</p></div>
        </div>
      </div>

      {/* Emergency Alert Banner */}
      {emergencyAlerts.length > 0 && (
        <div className="px-4 md:px-6 py-3 bg-destructive/20 border-b-2 border-destructive animate-pulse">
          <div className="flex items-center gap-2 mb-2">
            <Siren size={20} className="text-destructive" />
            <p className="text-sm font-bold text-destructive uppercase tracking-wide">
              🚨 {emergencyAlerts.length} Active Emergency{emergencyAlerts.length > 1 ? " Alerts" : " Alert"}
            </p>
          </div>
          <div className="space-y-2">
            {emergencyAlerts.map((alert) => (
              <div key={alert.id} className="flex items-center justify-between bg-destructive/10 rounded-lg px-3 py-2">
                <div>
                  <p className="text-sm font-semibold text-destructive">
                    {profiles[alert.user_id] || "Guard"} — PANIC
                  </p>
                  <p className="text-xs text-destructive/80">
                    {timeSince(alert.created_at)} • GPS: {alert.latitude?.toFixed(4)}, {alert.longitude?.toFixed(4)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (alert.latitude && alert.longitude) {
                        setSelectedGuard({ lat: alert.latitude, lng: alert.longitude });
                      }
                    }}
                    className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-medium"
                  >
                    Locate
                  </button>
                  {resolveAlertId === alert.id ? (
                    <div className="flex gap-1.5 items-center">
                      <input
                        value={resolveNotes}
                        onChange={(e) => setResolveNotes(e.target.value)}
                        placeholder="Resolution notes..."
                        className="px-2 py-1.5 text-xs rounded-md border border-border bg-background w-40"
                      />
                      <button
                        onClick={() => resolveEmergency(alert.id)}
                        className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-medium"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => { setResolveAlertId(null); setResolveNotes(""); }}
                        className="px-2 py-1.5 text-xs text-muted-foreground"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setResolveAlertId(alert.id)}
                      className="px-3 py-1.5 bg-secondary text-foreground rounded-md text-xs font-medium"
                    >
                      Resolve
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Violation Alert Banner */}
      {recentViolations.length > 0 && (
        <div className="px-4 md:px-6 py-2 bg-destructive/10 border-b border-destructive/30">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-destructive animate-pulse" />
            <p className="text-sm font-semibold text-destructive">
              {recentViolations.length} Geofence Violation{recentViolations.length > 1 ? "s" : ""} Detected
            </p>
            <button onClick={() => setRecentViolations([])} className="ml-auto text-xs text-destructive/70 hover:text-destructive underline">
              Dismiss
            </button>
          </div>
          <div className="mt-1 space-y-1">
            {recentViolations.slice(0, 3).map((v) => (
              <p key={v.id} className="text-xs text-destructive/80">
                ⚠️ {v.guard_name} — {v.address_label || "Unknown"} — {timeSince(v.punched_at)}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Map + Sidebar */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Map */}
        <div className="flex-1 relative min-h-[300px]">
          {loading ? (
            <div className="flex items-center justify-center h-full bg-secondary/30"><p className="text-sm text-muted-foreground">Loading map...</p></div>
          ) : (
            <MapContainer center={mapCenter} zoom={12} className="h-full w-full z-0" style={{ height: "100%", width: "100%" }}>
              <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {selectedGuard && <FlyTo lat={selectedGuard.lat} lng={selectedGuard.lng} />}

              {/* Site markers */}
              {filteredSites.map((site) =>
                site.latitude && site.longitude ? (
                  <div key={`site-${site.id}`}>
                    <Circle center={[site.latitude, site.longitude]} radius={site.radius_meters}
                      pathOptions={{ color: "hsl(217, 91%, 60%)", fillColor: "hsl(217, 91%, 60%)", fillOpacity: 0.08, weight: 1.5, dashArray: "6 4" }}
                    />
                    <Marker position={[site.latitude, site.longitude]} icon={siteIcon}>
                      <Popup><div className="text-sm"><p className="font-bold">{site.name}</p><p className="text-gray-500">{site.address}</p><p className="text-xs mt-1">Geofence: {site.radius_meters}m</p></div></Popup>
                    </Marker>
                  </div>
                ) : null
              )}

              {/* Guard markers */}
              {clockedIn.map((punch) =>
                punch.latitude && punch.longitude ? (
                  <Marker key={punch.id} position={[punch.latitude, punch.longitude]} icon={punch.within_geofence ? greenIcon : redIcon}>
                    <Popup><div className="text-sm"><p className="font-bold">{punch.guard_name}</p><p className="text-gray-500">{punch.address_label || "Unknown"}</p><p className="text-xs mt-1">{punch.within_geofence ? "✅ Within geofence" : "❌ Outside geofence"}</p><p className="text-xs text-gray-400">{timeSince(punch.punched_at)}</p></div></Popup>
                  </Marker>
                ) : null
              )}

              {/* Emergency alert markers - blinking red circles */}
              {emergencyAlerts.map((alert) =>
                alert.latitude && alert.longitude ? (
                  <div key={`emergency-${alert.id}`}>
                    <Circle
                      center={[alert.latitude, alert.longitude]}
                      radius={50}
                      pathOptions={{
                        color: "hsl(0, 84%, 60%)",
                        fillColor: "hsl(0, 84%, 60%)",
                        fillOpacity: 0.4,
                        weight: 3,
                        className: "animate-pulse",
                      }}
                    />
                    <Marker position={[alert.latitude, alert.longitude]} icon={redIcon}>
                      <Popup>
                        <div className="text-sm">
                          <p className="font-bold text-red-600">🚨 EMERGENCY ALERT</p>
                          <p className="font-semibold">{profiles[alert.user_id] || "Guard"}</p>
                          <p className="text-xs mt-1">{timeSince(alert.created_at)}</p>
                          <p className="text-xs text-gray-500">
                            GPS: {alert.latitude?.toFixed(5)}, {alert.longitude?.toFixed(5)}
                          </p>
                        </div>
                      </Popup>
                    </Marker>
                  </div>
                ) : null
              )}

              {/* Trail breadcrumb line */}
              {showTrail && trailCoords.length > 1 && (
                <Polyline positions={trailCoords} pathOptions={{ color: "hsl(25, 95%, 53%)", weight: 3, dashArray: "8 6", opacity: 0.8 }} />
              )}

              {/* Trail checkpoint markers */}
              {showTrail && trailPoints.map((tp, i) =>
                tp.latitude && tp.longitude ? (
                  <Marker key={tp.id} position={[tp.latitude, tp.longitude]} icon={orangeIcon}>
                    <Popup>
                      <div className="text-sm">
                        <p className="font-bold">Checkpoint #{i + 1}</p>
                        <p className="text-gray-500">{tp.address_label || "—"}</p>
                        <p className="text-xs">{tp.punch_type.replace("_", " ")}</p>
                        <p className="text-xs text-gray-400">{new Date(tp.punched_at).toLocaleTimeString()}</p>
                      </div>
                    </Popup>
                  </Marker>
                ) : null
              )}
            </MapContainer>
          )}
        </div>

        {/* Sidebar */}
        <div className="w-full md:w-80 border-t md:border-t-0 md:border-l border-border bg-card overflow-y-auto max-h-[40vh] md:max-h-none">
          {/* Trail playback panel */}
          <div className="p-3 border-b border-border space-y-2">
            <h3 className="text-sm font-display font-semibold text-foreground flex items-center gap-1.5">
              <Route size={14} className="text-primary" /> Guard Trail
            </h3>
            <select value={trailGuardId} onChange={(e) => setTrailGuardId(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs">
              <option value="">Select guard...</option>
              {guardList.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <div className="flex gap-2">
              <input type="date" value={trailDate} onChange={(e) => setTrailDate(e.target.value)}
                className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-xs" />
              <button onClick={fetchTrail} className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-medium hover:bg-primary/90 transition-colors">
                Load
              </button>
            </div>
            {showTrail && (
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{trailPoints.length} checkpoints</p>
                <button onClick={() => { setShowTrail(false); setTrailPoints([]); }} className="text-xs text-destructive hover:underline">Clear</button>
              </div>
            )}
          </div>

          {/* Active Guards */}
          <div className="p-3 border-b border-border">
            <h3 className="text-sm font-display font-semibold text-foreground">Active Guards</h3>
            <p className="text-xs text-muted-foreground">{clockedIn.length} on duty</p>
          </div>

          {clockedIn.length === 0 ? (
            <div className="p-6 text-center">
              <Clock size={32} className="mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">No guards clocked in</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {clockedIn.map((punch) => (
                <button key={punch.id}
                  onClick={() => { if (punch.latitude && punch.longitude) setSelectedGuard({ lat: punch.latitude, lng: punch.longitude }); }}
                  className="w-full flex items-center gap-3 p-3 hover:bg-secondary/50 transition-colors text-left"
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                    punch.within_geofence ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive"
                  }`}>
                    {(punch.guard_name || "U")[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{punch.guard_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{punch.address_label || "—"}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <Badge variant={punch.within_geofence ? "default" : "destructive"} className="text-[10px] px-1.5 py-0">
                      {punch.within_geofence ? "OK" : "OUT"}
                    </Badge>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{timeSince(punch.punched_at)}</p>
                  </div>
                  <ChevronRight size={14} className="text-muted-foreground flex-shrink-0" />
                </button>
              ))}
            </div>
          )}

          {/* Recent clock-outs */}
          {filteredPunches.filter((p) => p.punch_type === "clock_out").length > 0 && (
            <>
              <div className="p-3 border-t border-border">
                <h3 className="text-sm font-display font-semibold text-muted-foreground">Recently Off-Duty</h3>
              </div>
              <div className="divide-y divide-border">
                {filteredPunches.filter((p) => p.punch_type === "clock_out").slice(0, 5).map((punch) => (
                  <div key={punch.id} className="flex items-center gap-3 p-3 opacity-60">
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-muted-foreground">
                      {(punch.guard_name || "U")[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{punch.guard_name}</p>
                      <p className="text-xs text-muted-foreground">Clocked out {timeSince(punch.punched_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}
