import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { MapPin, Navigation, CheckCircle, AlertCircle, Clock, Shield } from "lucide-react";
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
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function GuardTourPage() {
  const { user } = useAuth();
  const { isAdminOrManager } = useRole();
  const [sites, setSites] = useState<AssignedSite[]>([]);
  const [patrolLogs, setPatrolLogs] = useState<PatrolLog[]>([]);
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [posError, setPosError] = useState("");
  const [loading, setLoading] = useState(true);
  const [clockingIn, setClockingIn] = useState<string | null>(null);
  const [checkpointName, setCheckpointName] = useState("");
  const [checkpointNotes, setCheckpointNotes] = useState("");

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      // Get assigned sites
      const { data: assignData } = await supabase
        .from("guard_assignments")
        .select("site_id")
        .eq("user_id", user.id)
        .eq("is_active", true);

      if (assignData && assignData.length > 0) {
        const siteIds = assignData.map(a => a.site_id);
        const { data: siteData } = await supabase
          .from("client_sites")
          .select("id, name, address, latitude, longitude, radius_meters")
          .in("id", siteIds);
        setSites(siteData || []);
      }

      // Get today's patrol logs
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
  }, [user]);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setPosError("Geolocation not supported");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => { setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setPosError(""); },
      (err) => { setPosError("Location access denied. Enable GPS."); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  useEffect(() => { requestLocation(); }, [requestLocation]);

  const handleClockIn = async (site: AssignedSite) => {
    if (!user || !userPos) return;
    if (!site.latitude || !site.longitude) {
      toast.error("Site coordinates not set");
      return;
    }
    const dist = getDistance(userPos.lat, userPos.lng, site.latitude, site.longitude);
    if (dist > site.radius_meters) {
      toast.error(`You are ${Math.round(dist)}m from site. Must be within ${site.radius_meters}m.`);
      return;
    }
    setClockingIn(site.id);
    const { error } = await supabase.from("clock_punches").insert({
      user_id: user.id,
      punch_type: "clock_in",
      latitude: userPos.lat,
      longitude: userPos.lng,
      within_geofence: true,
      address_label: site.name,
    });
    if (error) { toast.error("Clock-in failed"); } else { toast.success(`Clocked in at ${site.name}`); }
    setClockingIn(null);
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
    if (error) { toast.error("Checkpoint log failed"); return; }
    toast.success("Checkpoint recorded");
    setCheckpointName("");
    setCheckpointNotes("");
    // Refresh logs
    const today = new Date().toISOString().split("T")[0];
    const { data } = await supabase.from("patrol_logs").select("*").eq("user_id", user.id).gte("scanned_at", today).order("scanned_at", { ascending: false });
    setPatrolLogs(data || []);
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading...</div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Guard Tour</h1>
        <p className="text-sm text-muted-foreground">GPS-verified clock-in and patrol checkpoints</p>
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
                <p className="text-xs text-muted-foreground">{userPos.lat.toFixed(6)}, {userPos.lng.toFixed(6)}</p>
              ) : (
                <p className="text-xs text-destructive">{posError || "Requesting location..."}</p>
              )}
            </div>
            <button onClick={requestLocation} className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-secondary transition-colors">
              Refresh
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Assigned Sites */}
      {sites.length === 0 ? (
        <Card className="shadow-card border-border/60">
          <CardContent className="p-12 text-center">
            <Shield size={48} className="mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-display font-semibold mb-2">No Sites Assigned</h3>
            <p className="text-sm text-muted-foreground">Contact your supervisor to be assigned to a client site.</p>
          </CardContent>
        </Card>
      ) : (
        sites.map(site => {
          const dist = userPos && site.latitude && site.longitude
            ? getDistance(userPos.lat, userPos.lng, site.latitude, site.longitude)
            : null;
          const withinRadius = dist !== null && dist <= site.radius_meters;
          const siteLogs = patrolLogs.filter(l => l.site_id === site.id);

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
                      {Math.round(dist)}m {withinRadius ? "✓" : "away"}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Map placeholder showing distance */}
                {dist !== null && (
                  <div className="h-32 rounded-lg bg-secondary/50 border border-border/50 flex items-center justify-center relative overflow-hidden">
                    <div className="text-center">
                      <MapPin size={24} className={withinRadius ? "text-emerald-500 mx-auto" : "text-destructive mx-auto"} />
                      <p className="text-xs text-muted-foreground mt-1">
                        {withinRadius ? `Within ${site.radius_meters}m geofence` : `${Math.round(dist)}m from site (need ≤${site.radius_meters}m)`}
                      </p>
                    </div>
                    {/* Visual radius indicator */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className={`w-20 h-20 rounded-full border-2 border-dashed ${withinRadius ? "border-emerald-500/30" : "border-destructive/30"}`} />
                      <div className={`absolute w-2 h-2 rounded-full ${withinRadius ? "bg-emerald-500" : "bg-destructive"}`} style={{
                        transform: dist !== null && site.radius_meters
                          ? `translate(${Math.min(40, (dist / site.radius_meters) * 40)}px, 0)`
                          : undefined,
                      }} />
                    </div>
                  </div>
                )}

                {/* Clock In */}
                <button
                  onClick={() => handleClockIn(site)}
                  disabled={!withinRadius || clockingIn === site.id}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {clockingIn === site.id ? (
                    <Clock size={16} className="animate-spin" />
                  ) : (
                    <CheckCircle size={16} />
                  )}
                  {withinRadius ? "Clock In at Site" : "Move closer to clock in"}
                </button>

                {/* Checkpoint scan */}
                <div className="border-t border-border pt-3">
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Log Patrol Checkpoint</h4>
                  <div className="flex gap-2">
                    <Input placeholder="Checkpoint name" value={checkpointName} onChange={e => setCheckpointName(e.target.value)} className="text-sm" />
                    <button
                      onClick={() => handleCheckpoint(site.id)}
                      disabled={!userPos}
                      className="px-4 py-2 bg-secondary text-foreground rounded-lg text-sm font-medium hover:bg-secondary/80 transition-colors disabled:opacity-50"
                    >
                      Log
                    </button>
                  </div>
                </div>

                {/* Today's patrol logs */}
                {siteLogs.length > 0 && (
                  <div className="border-t border-border pt-3">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Today's Patrol ({siteLogs.length})</h4>
                    <div className="space-y-1">
                      {siteLogs.map(log => (
                        <div key={log.id} className="flex items-center justify-between text-xs p-2 rounded bg-secondary/30">
                          <span className="font-medium">{log.checkpoint_name}</span>
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
