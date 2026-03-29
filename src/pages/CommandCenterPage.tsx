import { useEffect, useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { MapPin, Clock, Shield, Users, RefreshCw, Radio, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import { toast } from "sonner";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default marker icons in Leaflet + bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const greenIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const redIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const siteIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
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
}

function FlyTo({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], 16, { duration: 1 });
  }, [lat, lng, map]);
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
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [selectedGuard, setSelectedGuard] = useState<{ lat: number; lng: number } | null>(null);
  const [isLive, setIsLive] = useState(true);
  const channelRef = useRef<any>(null);

  const fetchData = useCallback(async () => {
    const today = new Date().toISOString().split("T")[0];
    const [punchesRes, sitesRes, profilesRes] = await Promise.all([
      supabase
        .from("clock_punches")
        .select("*")
        .gte("punched_at", today + "T00:00:00")
        .order("punched_at", { ascending: false }),
      supabase
        .from("client_sites")
        .select("id, name, latitude, longitude, radius_meters, address")
        .eq("status", "active"),
      supabase
        .from("profiles")
        .select("user_id, first_name, last_name"),
    ]);

    const profMap: Record<string, string> = {};
    (profilesRes.data || []).forEach((p: any) => {
      profMap[p.user_id] = `${p.first_name} ${p.last_name}`.trim() || "Unknown";
    });

    setProfiles(profMap);
    setSites(sitesRes.data || []);

    // Deduplicate: latest punch per user
    const latestByUser = new Map<string, ActivePunch>();
    (punchesRes.data || []).forEach((p: any) => {
      if (!latestByUser.has(p.user_id)) {
        latestByUser.set(p.user_id, { ...p, guard_name: profMap[p.user_id] || "Unknown" });
      }
    });
    setPunches(Array.from(latestByUser.values()));
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Realtime subscription
  useEffect(() => {
    if (!isLive) {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      return;
    }

    const channel = supabase
      .channel("live-clock-punches")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "clock_punches" },
        (payload) => {
          const newPunch = payload.new as any;
          const guardName = profiles[newPunch.user_id] || "Guard";
          toast.info(`${newPunch.punch_type === "clock_in" ? "🟢" : "🔴"} ${guardName} ${newPunch.punch_type.replace("_", " ")}`, {
            description: newPunch.address_label || "Unknown site",
          });
          setPunches((prev) => {
            const filtered = prev.filter((p) => p.user_id !== newPunch.user_id);
            return [{ ...newPunch, guard_name: guardName }, ...filtered];
          });
        }
      )
      .subscribe();

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
    };
  }, [isLive, profiles]);

  const clockedIn = punches.filter((p) => p.punch_type === "clock_in");
  const withinGeofence = clockedIn.filter((p) => p.within_geofence);
  const outsideGeofence = clockedIn.filter((p) => !p.within_geofence);

  // Default center: St. Lucia
  const defaultCenter: [number, number] = [13.9094, -60.9789];
  const mapCenter = selectedGuard
    ? [selectedGuard.lat, selectedGuard.lng] as [number, number]
    : clockedIn.length > 0 && clockedIn[0].latitude
      ? [clockedIn[0].latitude, clockedIn[0].longitude!] as [number, number]
      : defaultCenter;

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
      <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-border bg-card">
        <div>
          <h1 className="text-lg md:text-xl font-display font-bold text-foreground flex items-center gap-2">
            <Radio size={20} className={isLive ? "text-green-500 animate-pulse" : "text-muted-foreground"} />
            Command Center
          </h1>
          <p className="text-xs text-muted-foreground">Real-time guard operations across all sites</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsLive(!isLive)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              isLive
                ? "bg-green-500/10 text-green-600 border border-green-500/30"
                : "bg-secondary text-muted-foreground"
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${isLive ? "bg-green-500 animate-pulse" : "bg-muted-foreground"}`} />
            {isLive ? "LIVE" : "PAUSED"}
          </button>
          <button
            onClick={fetchData}
            className="p-2 rounded-lg bg-secondary text-muted-foreground hover:bg-muted transition-colors"
            title="Refresh"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 px-4 md:px-6 py-3 bg-card/50 border-b border-border">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/50">
          <Users size={14} className="text-primary" />
          <div>
            <p className="text-xs text-muted-foreground">Active Guards</p>
            <p className="text-base font-display font-bold text-foreground">{clockedIn.length}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/50">
          <MapPin size={14} className="text-green-500" />
          <div>
            <p className="text-xs text-muted-foreground">In Geofence</p>
            <p className="text-base font-display font-bold text-green-600">{withinGeofence.length}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/50">
          <MapPin size={14} className="text-destructive" />
          <div>
            <p className="text-xs text-muted-foreground">Outside Zone</p>
            <p className="text-base font-display font-bold text-destructive">{outsideGeofence.length}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/50">
          <Shield size={14} className="text-primary" />
          <div>
            <p className="text-xs text-muted-foreground">Total Sites</p>
            <p className="text-base font-display font-bold text-foreground">{sites.length}</p>
          </div>
        </div>
      </div>

      {/* Map + Sidebar */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Map */}
        <div className="flex-1 relative min-h-[300px]">
          {loading ? (
            <div className="flex items-center justify-center h-full bg-secondary/30">
              <p className="text-sm text-muted-foreground">Loading map...</p>
            </div>
          ) : (
            <MapContainer
              center={mapCenter}
              zoom={12}
              className="h-full w-full z-0"
              style={{ height: "100%", width: "100%" }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {selectedGuard && <FlyTo lat={selectedGuard.lat} lng={selectedGuard.lng} />}

              {/* Site markers with geofence radius */}
              {sites.map((site) =>
                site.latitude && site.longitude ? (
                  <div key={`site-${site.id}`}>
                    <Circle
                      center={[site.latitude, site.longitude]}
                      radius={site.radius_meters}
                      pathOptions={{
                        color: "hsl(217, 91%, 60%)",
                        fillColor: "hsl(217, 91%, 60%)",
                        fillOpacity: 0.08,
                        weight: 1.5,
                        dashArray: "6 4",
                      }}
                    />
                    <Marker position={[site.latitude, site.longitude]} icon={siteIcon}>
                      <Popup>
                        <div className="text-sm">
                          <p className="font-bold">{site.name}</p>
                          <p className="text-gray-500">{site.address}</p>
                          <p className="text-xs mt-1">Geofence: {site.radius_meters}m radius</p>
                        </div>
                      </Popup>
                    </Marker>
                  </div>
                ) : null
              )}

              {/* Guard markers */}
              {clockedIn.map((punch) =>
                punch.latitude && punch.longitude ? (
                  <Marker
                    key={punch.id}
                    position={[punch.latitude, punch.longitude]}
                    icon={punch.within_geofence ? greenIcon : redIcon}
                  >
                    <Popup>
                      <div className="text-sm">
                        <p className="font-bold">{punch.guard_name}</p>
                        <p className="text-gray-500">{punch.address_label || "Unknown site"}</p>
                        <p className="text-xs mt-1">
                          {punch.within_geofence ? "✅ Within geofence" : "❌ Outside geofence"}
                        </p>
                        <p className="text-xs text-gray-400">{timeSince(punch.punched_at)}</p>
                      </div>
                    </Popup>
                  </Marker>
                ) : null
              )}
            </MapContainer>
          )}
        </div>

        {/* Guard Sidebar */}
        <div className="w-full md:w-80 border-t md:border-t-0 md:border-l border-border bg-card overflow-y-auto max-h-[40vh] md:max-h-none">
          <div className="p-3 border-b border-border">
            <h3 className="text-sm font-display font-semibold text-foreground">Active Guards</h3>
            <p className="text-xs text-muted-foreground">{clockedIn.length} on duty today</p>
          </div>

          {clockedIn.length === 0 ? (
            <div className="p-6 text-center">
              <Clock size={32} className="mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">No guards clocked in</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {clockedIn.map((punch) => (
                <button
                  key={punch.id}
                  onClick={() => {
                    if (punch.latitude && punch.longitude) {
                      setSelectedGuard({ lat: punch.latitude, lng: punch.longitude });
                    }
                  }}
                  className="w-full flex items-center gap-3 p-3 hover:bg-secondary/50 transition-colors text-left"
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      punch.within_geofence
                        ? "bg-green-500/15 text-green-600"
                        : "bg-destructive/15 text-destructive"
                    }`}
                  >
                    {(punch.guard_name || "U")[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{punch.guard_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{punch.address_label || "—"}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <Badge
                      variant={punch.within_geofence ? "default" : "destructive"}
                      className="text-[10px] px-1.5 py-0"
                    >
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
          {punches.filter((p) => p.punch_type === "clock_out").length > 0 && (
            <>
              <div className="p-3 border-t border-border">
                <h3 className="text-sm font-display font-semibold text-muted-foreground">Recently Off-Duty</h3>
              </div>
              <div className="divide-y divide-border">
                {punches
                  .filter((p) => p.punch_type === "clock_out")
                  .slice(0, 5)
                  .map((punch) => (
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
