import { useEffect, useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { MapPin, Navigation, CheckCircle, AlertCircle, Clock, Shield, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { toast } from "sonner";

interface AssignedSite {
  id: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  radius_meters: number;
}

interface PatrolLog {
  id: string;
  site_id: string;
  checkpoint_name: string;
  scanned_at: string;
  notes: string;
}

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Geofence ring SVG component
function GeofenceRing({ distance, radius, size = 160 }: { distance: number; radius: number; size?: number }) {
  const center = size / 2;
  const ringR = (size / 2) - 12;
  // Position dot based on distance ratio (clamped)
  const ratio = Math.min(distance / (radius * 2), 1);
  const dotAngle = -90; // top
  const dotR = ratio * ringR;
  const dotX = center + dotR * Math.cos((dotAngle * Math.PI) / 180);
  const dotY = center + dotR * Math.sin((dotAngle * Math.PI) / 180);
  const withinRadius = distance <= radius;
  const zoneR = (radius / (radius * 2)) * ringR; // half of ring = the zone

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mx-auto">
      {/* Background circle */}
      <circle cx={center} cy={center} r={ringR} fill="none" stroke="hsl(var(--border))" strokeWidth="1" strokeDasharray="4 4" />
      {/* Geofence zone */}
      <circle
        cx={center} cy={center} r={zoneR}
        fill={withinRadius ? "hsl(var(--primary) / 0.08)" : "hsl(var(--destructive) / 0.05)"}
        stroke={withinRadius ? "hsl(var(--primary) / 0.4)" : "hsl(var(--destructive) / 0.3)"}
        strokeWidth="2"
        strokeDasharray="6 3"
      />
      {/* Zone label */}
      <text x={center} y={center + zoneR + 14} textAnchor="middle" className="fill-muted-foreground" fontSize="9">{radius}m zone</text>
      {/* Site marker */}
      <circle cx={center} cy={center} r="5" fill="hsl(var(--primary))" />
      <text x={center} y={center - 10} textAnchor="middle" className="fill-foreground" fontSize="9" fontWeight="600">Site</text>
      {/* Guard dot */}
      <circle
        cx={dotX} cy={dotY} r="6"
        fill={withinRadius ? "hsl(142, 71%, 45%)" : "hsl(var(--destructive))"}
        stroke="white" strokeWidth="2"
      />
      {/* Distance line */}
      <line x1={center} y1={center} x2={dotX} y2={dotY} stroke="hsl(var(--muted-foreground) / 0.3)" strokeWidth="1" strokeDasharray="3 3" />
      {/* Distance label */}
      <text x={(center + dotX) / 2 + 8} y={(center + dotY) / 2} className="fill-foreground" fontSize="10" fontWeight="600">
        {Math.round(distance)}m
      </text>
    </svg>
  );
}

export default function GuardTourPage() {
  const { user } = useAuth();
  const { isAdminOrManager } = useRole();
  const [sites, setSites] = useState<AssignedSite[]>([]);
  const [allSites, setAllSites] = useState<AssignedSite[]>([]);
  const [patrolLogs, setPatrolLogs] = useState<PatrolLog[]>([]);
  const [allPatrolLogs, setAllPatrolLogs] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [posError, setPosError] = useState("");
  const [loading, setLoading] = useState(true);
  const [clockingIn, setClockingIn] = useState<string | null>(null);
  const [checkpointName, setCheckpointName] = useState("");
  const [checkpointNotes, setCheckpointNotes] = useState("");
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const watchRef = useRef<number | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      if (isAdminOrManager) {
        // Admin view: all sites, all logs
        const [siteRes, logRes, profRes] = await Promise.all([
          supabase.from("client_sites").select("id, name, address, latitude, longitude, radius_meters").eq("status", "active"),
          supabase.from("patrol_logs").select("*, profiles:user_id(first_name, last_name)").gte("scanned_at", new Date().toISOString().split("T")[0]).order("scanned_at", { ascending: false }),
          supabase.from("profiles").select("user_id, first_name, last_name"),
        ]);
        setAllSites(siteRes.data || []);
        setAllPatrolLogs(logRes.data || []);
        setProfiles(profRes.data || []);
      }
      // Guard view
      const { data: assignData } = await supabase
        .from("guard_assignments")
        .select("site_id")
        .eq("user_id", user.id)
        .eq("is_active", true);

      if (assignData && assignData.length > 0) {
        const siteIds = assignData.map((a) => a.site_id);
        const { data: siteData } = await supabase
          .from("client_sites")
          .select("id, name, address, latitude, longitude, radius_meters")
          .in("id", siteIds);
        setSites(siteData || []);
      }

      const today = new Date().toISOString().split("T")[0];
      const { data: logs } = await supabase
        .from("patrol_logs")
        .select("*")
        .eq("user_id", user.id)
        .gte("scanned_at", today)
        .order("scanned_at", { ascending: false });
      setPatrolLogs(logs || []);
      setLoading(false);
    };
    fetch();
  }, [user, isAdminOrManager]);

  // Continuous GPS watching for real-time updates
  const startWatching = useCallback(() => {
    if (!navigator.geolocation) {
      setPosError("Geolocation not supported");
      return;
    }
    if (watchRef.current !== null) {
      navigator.geolocation.clearWatch(watchRef.current);
    }
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsAccuracy(pos.coords.accuracy);
        setPosError("");
      },
      () => {
        setPosError("Location access denied. Enable GPS.");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );
  }, []);

  useEffect(() => {
    startWatching();
    return () => {
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    };
  }, [startWatching]);

  // Server-side verified clock-in
  const handleClockIn = async (site: AssignedSite) => {
    if (!user || !userPos) return;
    if (!site.latitude || !site.longitude) {
      toast.error("Site coordinates not configured");
      return;
    }

    // Quick client-side pre-check
    const clientDist = getDistance(userPos.lat, userPos.lng, site.latitude, site.longitude);
    if (clientDist > site.radius_meters) {
      toast.error(`You are ${Math.round(clientDist)}m from site. Must be within ${site.radius_meters}m.`);
      return;
    }

    setClockingIn(site.id);
    try {
      // Server-side verification via Edge Function
      const { data, error } = await supabase.functions.invoke("verify-clock-in", {
        body: {
          latitude: userPos.lat,
          longitude: userPos.lng,
          site_id: site.id,
          punch_type: "clock_in",
        },
      });

      if (error) {
        toast.error("Clock-in verification failed");
        return;
      }

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      toast.success(`✓ Clocked in at ${site.name} (${data.distance}m from site)`);
    } catch {
      toast.error("Network error during clock-in");
    } finally {
      setClockingIn(null);
    }
  };

  const handleClockOut = async (site: AssignedSite) => {
    if (!user || !userPos) return;
    setClockingIn(site.id);
    try {
      const { data, error } = await supabase.functions.invoke("verify-clock-in", {
        body: {
          latitude: userPos.lat,
          longitude: userPos.lng,
          site_id: site.id,
          punch_type: "clock_out",
        },
      });
      if (error || data?.error) {
        toast.error(data?.error || "Clock-out failed");
        return;
      }
      toast.success(`✓ Clocked out at ${site.name}`);
    } catch {
      toast.error("Network error");
    } finally {
      setClockingIn(null);
    }
  };

  const handleCheckpoint = async (siteId: string) => {
    if (!user || !userPos) return;
    const { error } = await supabase.from("patrol_logs").insert({
      user_id: user.id,
      site_id: siteId,
      checkpoint_name: checkpointName || "Patrol scan",
      latitude: userPos.lat,
      longitude: userPos.lng,
      notes: checkpointNotes,
    });
    if (error) {
      toast.error("Checkpoint log failed");
      return;
    }
    toast.success("✓ Checkpoint recorded");
    setCheckpointName("");
    setCheckpointNotes("");
    const today = new Date().toISOString().split("T")[0];
    const { data } = await supabase
      .from("patrol_logs")
      .select("*")
      .eq("user_id", user.id)
      .gte("scanned_at", today)
      .order("scanned_at", { ascending: false });
    setPatrolLogs(data || []);
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading...</div>;

  const displaySites = isAdminOrManager ? allSites : sites;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Guard Tour</h1>
        <p className="text-sm text-muted-foreground">
          {isAdminOrManager ? "Monitor guard activity across all sites" : "GPS-verified clock-in and patrol checkpoints"}
        </p>
      </div>

      {/* GPS Status */}
      <Card className="shadow-card border-border/60">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${userPos ? "bg-emerald-500/10" : "bg-destructive/10"}`}>
              <Navigation size={20} className={userPos ? "text-emerald-500" : "text-destructive"} />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium">{userPos ? "GPS Active" : "GPS Unavailable"}</h3>
              {userPos ? (
                <div className="flex items-center gap-2">
                  <p className="text-xs text-muted-foreground font-mono">
                    {userPos.lat.toFixed(6)}, {userPos.lng.toFixed(6)}
                  </p>
                  {gpsAccuracy !== null && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      ±{Math.round(gpsAccuracy)}m
                    </Badge>
                  )}
                </div>
              ) : (
                <p className="text-xs text-destructive">{posError || "Requesting location..."}</p>
              )}
            </div>
            <button
              onClick={startWatching}
              className="p-2 rounded-lg border border-border hover:bg-secondary transition-colors"
              title="Refresh GPS"
            >
              <RefreshCw size={14} className="text-muted-foreground" />
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Admin: today's patrol activity overview */}
      {isAdminOrManager && allPatrolLogs.length > 0 && (
        <Card className="shadow-card border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display">Today's Patrol Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {allPatrolLogs.slice(0, 20).map((log: any) => {
                const siteName = allSites.find((s) => s.id === log.site_id)?.name || "Unknown";
                const p = profiles.find((p) => p.user_id === log.user_id);
                const guardName = p ? `${p.first_name} ${p.last_name}` : "Unknown";
                return (
                  <div key={log.id} className="flex items-center justify-between p-2 rounded-lg bg-secondary/30 border border-border/50 text-xs">
                    <div>
                      <span className="font-medium text-foreground">{guardName}</span>
                      <span className="text-muted-foreground"> · {siteName}</span>
                      {log.checkpoint_name && <span className="text-muted-foreground"> · {log.checkpoint_name}</span>}
                    </div>
                    <span className="text-muted-foreground">{new Date(log.scanned_at).toLocaleTimeString()}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Site Cards */}
      {displaySites.length === 0 ? (
        <Card className="shadow-card border-border/60">
          <CardContent className="p-12 text-center">
            <Shield size={48} className="mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-display font-semibold mb-2">
              {isAdminOrManager ? "No Active Sites" : "No Sites Assigned"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {isAdminOrManager
                ? "Create client sites in the Site Management page."
                : "Contact your supervisor to be assigned to a client site."}
            </p>
          </CardContent>
        </Card>
      ) : (
        displaySites.map((site) => {
          const dist =
            userPos && site.latitude && site.longitude
              ? getDistance(userPos.lat, userPos.lng, site.latitude, site.longitude)
              : null;
          const withinRadius = dist !== null && dist <= site.radius_meters;
          const siteLogs = patrolLogs.filter((l) => l.site_id === site.id);

          return (
            <Card key={site.id} className="shadow-card border-border/60">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base font-display">{site.name}</CardTitle>
                    <p className="text-xs text-muted-foreground">{site.address}</p>
                  </div>
                  {dist !== null && (
                    <Badge variant={withinRadius ? "default" : "destructive"}>
                      {withinRadius ? "In Zone ✓" : `${Math.round(dist)}m away`}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Geofence visual */}
                {dist !== null && site.latitude && site.longitude && (
                  <GeofenceRing distance={dist} radius={site.radius_meters} />
                )}

                {/* Status message */}
                {dist !== null && !withinRadius && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/5 border border-destructive/20 text-sm">
                    <AlertCircle size={16} className="text-destructive shrink-0" />
                    <span className="text-destructive">
                      You are too far from the site to clock in. Move within {site.radius_meters}m.
                    </span>
                  </div>
                )}

                {dist !== null && withinRadius && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-sm">
                    <CheckCircle size={16} className="text-emerald-600 shrink-0" />
                    <span className="text-emerald-700">
                      You are within the geofence zone. Clock-in is available.
                    </span>
                  </div>
                )}

                {/* Clock In/Out Buttons */}
                {!isAdminOrManager && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleClockIn(site)}
                      disabled={!withinRadius || clockingIn === site.id}
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {clockingIn === site.id ? (
                        <Clock size={16} className="animate-spin" />
                      ) : (
                        <CheckCircle size={16} />
                      )}
                      Clock In
                    </button>
                    <button
                      onClick={() => handleClockOut(site)}
                      disabled={!userPos || clockingIn === site.id}
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-secondary text-foreground rounded-lg text-sm font-medium hover:bg-secondary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Clock Out
                    </button>
                  </div>
                )}

                {/* Checkpoint scan */}
                {!isAdminOrManager && (
                  <div className="border-t border-border pt-3">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                      Log Patrol Checkpoint
                    </h4>
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Input
                          placeholder="Checkpoint name (e.g. Front Gate)"
                          value={checkpointName}
                          onChange={(e) => setCheckpointName(e.target.value)}
                          className="text-sm"
                        />
                        <button
                          onClick={() => handleCheckpoint(site.id)}
                          disabled={!userPos}
                          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 whitespace-nowrap"
                        >
                          Log
                        </button>
                      </div>
                      <Input
                        placeholder="Notes (optional)"
                        value={checkpointNotes}
                        onChange={(e) => setCheckpointNotes(e.target.value)}
                        className="text-sm"
                      />
                    </div>
                  </div>
                )}

                {/* Today's patrol logs */}
                {siteLogs.length > 0 && (
                  <div className="border-t border-border pt-3">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                      Today's Patrol ({siteLogs.length} checkpoints)
                    </h4>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {siteLogs.map((log) => (
                        <div key={log.id} className="flex items-center justify-between text-xs p-2 rounded bg-secondary/30">
                          <div>
                            <span className="font-medium">{log.checkpoint_name}</span>
                            {log.notes && <span className="text-muted-foreground ml-2">— {log.notes}</span>}
                          </div>
                          <span className="text-muted-foreground">{new Date(log.scanned_at).toLocaleTimeString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })
      )}
    </motion.div>
  );
}
