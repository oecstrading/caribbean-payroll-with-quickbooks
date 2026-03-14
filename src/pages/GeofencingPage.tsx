import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { MapPin, Plus, Trash2, Save, Navigation, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface GeofenceZone {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  is_active: boolean;
}

interface ClockPunch {
  id: string;
  punch_type: string;
  latitude: number | null;
  longitude: number | null;
  within_geofence: boolean | null;
  punched_at: string;
  address_label: string | null;
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function GeofencingPage() {
  const { isAdmin, isAdminOrManager } = useRole();
  const { user } = useAuth();
  const [zones, setZones] = useState<GeofenceZone[]>([]);
  const [punches, setPunches] = useState<ClockPunch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [punching, setPunching] = useState(false);
  const [geoError, setGeoError] = useState("");
  const [currentPos, setCurrentPos] = useState<{ lat: number; lng: number } | null>(null);
  const [form, setForm] = useState({ name: "", latitude: "", longitude: "", radius_meters: "100" });

  const fetchData = async () => {
    const [zRes, pRes] = await Promise.all([
      supabase.from("geofence_zones").select("*").eq("is_active", true),
      user
        ? supabase.from("clock_punches").select("*").eq("user_id", user.id).order("punched_at", { ascending: false }).limit(20)
        : Promise.resolve({ data: [] }),
    ]);
    setZones(zRes.data || []);
    setPunches(pRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const getCurrentLocation = (): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation not supported"));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      });
    });
  };

  const handleDetectLocation = async () => {
    try {
      const pos = await getCurrentLocation();
      setCurrentPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      setForm({
        ...form,
        latitude: pos.coords.latitude.toFixed(6),
        longitude: pos.coords.longitude.toFixed(6),
      });
      toast.success("Location detected");
    } catch {
      toast.error("Could not detect location. Please enter coordinates manually.");
    }
  };

  const handleAddZone = async () => {
    const lat = parseFloat(form.latitude);
    const lng = parseFloat(form.longitude);
    const radius = parseInt(form.radius_meters);
    if (!form.name.trim() || isNaN(lat) || isNaN(lng) || isNaN(radius)) {
      toast.error("Please fill all fields");
      return;
    }
    try {
      const { error } = await supabase.from("geofence_zones").insert({
        name: form.name.trim(),
        latitude: lat,
        longitude: lng,
        radius_meters: radius,
      });
      if (error) throw error;
      toast.success("Geofence zone added");
      setShowAdd(false);
      setForm({ name: "", latitude: "", longitude: "", radius_meters: "100" });
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to add zone");
    }
  };

  const handleDeleteZone = async (id: string) => {
    try {
      const { error } = await supabase.from("geofence_zones").delete().eq("id", id);
      if (error) throw error;
      toast.success("Zone deleted");
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    }
  };

  const handleClockPunch = async (punchType: "in" | "out") => {
    if (!user) return;
    setPunching(true);
    setGeoError("");

    try {
      const pos = await getCurrentLocation();
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      // Check against all active zones
      let withinAny = false;
      let matchedZone: GeofenceZone | null = null;

      for (const zone of zones) {
        const dist = haversineDistance(lat, lng, zone.latitude, zone.longitude);
        if (dist <= zone.radius_meters) {
          withinAny = true;
          matchedZone = zone;
          break;
        }
      }

      if (!withinAny && zones.length > 0) {
        const nearest = zones.reduce((best, z) => {
          const d = haversineDistance(lat, lng, z.latitude, z.longitude);
          return d < best.dist ? { zone: z, dist: d } : best;
        }, { zone: zones[0], dist: Infinity });

        setGeoError(
          `You are ${Math.round(nearest.dist)}m from "${nearest.zone.name}" (max ${nearest.zone.radius_meters}m). Clock ${punchType} blocked.`
        );
        setPunching(false);
        return;
      }

      const { error } = await supabase.from("clock_punches").insert({
        user_id: user.id,
        punch_type: punchType,
        latitude: lat,
        longitude: lng,
        geofence_zone_id: matchedZone?.id || null,
        within_geofence: withinAny,
        address_label: matchedZone?.name || "",
      });

      if (error) throw error;
      toast.success(`Clocked ${punchType} successfully at ${matchedZone?.name || "your location"}`);
      fetchData();
    } catch (err: any) {
      if (err.code === 1) {
        setGeoError("Location permission denied. Please enable GPS.");
      } else if (err.code === 2) {
        setGeoError("Location unavailable. Try again.");
      } else if (err.code === 3) {
        setGeoError("Location request timed out.");
      } else {
        toast.error(err.message || "Failed to clock punch");
      }
    } finally {
      setPunching(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4 md:space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-display font-bold text-foreground">Geofencing</h1>
          <p className="text-sm text-muted-foreground mt-1">GPS-verified clock-in/out with location tracking</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus size={16} />
            Add Zone
          </button>
        )}
      </div>

      {/* Clock In/Out */}
      <Card className="shadow-card border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-display flex items-center gap-2">
            <Navigation size={16} className="text-primary" />
            GPS Clock Punch
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {zones.length > 0
              ? `${zones.length} active zone(s). You must be within range to clock in/out.`
              : "No geofence zones configured. You can clock in from any location."}
          </p>

          {geoError && (
            <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20 text-sm text-destructive">
              {geoError}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => handleClockPunch("in")}
              disabled={punching}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-success text-success-foreground rounded-lg text-sm font-bold hover:bg-success/90 transition-colors disabled:opacity-50"
            >
              <MapPin size={18} />
              {punching ? "Locating..." : "Clock In"}
            </button>
            <button
              onClick={() => handleClockPunch("out")}
              disabled={punching}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-destructive text-destructive-foreground rounded-lg text-sm font-bold hover:bg-destructive/90 transition-colors disabled:opacity-50"
            >
              <MapPin size={18} />
              {punching ? "Locating..." : "Clock Out"}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Active Zones */}
      <Card className="shadow-card border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-display flex items-center gap-2">
            <MapPin size={16} className="text-primary" />
            Geofence Zones
          </CardTitle>
        </CardHeader>
        <CardContent>
          {zones.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No geofence zones configured.</p>
          ) : (
            <div className="space-y-3">
              {zones.map((zone) => (
                <div
                  key={zone.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <MapPin size={16} className="text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{zone.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {zone.latitude.toFixed(4)}, {zone.longitude.toFixed(4)} • {zone.radius_meters}m radius
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="bg-success/10 text-success text-[10px]">Active</Badge>
                    {isAdmin && (
                      <button
                        onClick={() => handleDeleteZone(zone.id)}
                        className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors"
                      >
                        <Trash2 size={14} className="text-destructive" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Punches */}
      <Card className="shadow-card border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-display">My Recent Punches</CardTitle>
        </CardHeader>
        <CardContent>
          {punches.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No clock punches yet.</p>
          ) : (
            <div className="space-y-2">
              {punches.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                  <div className="flex items-center gap-3">
                    <Badge
                      variant="secondary"
                      className={p.punch_type === "in" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}
                    >
                      {p.punch_type === "in" ? "IN" : "OUT"}
                    </Badge>
                    <div>
                      <p className="text-sm text-foreground">
                        {new Date(p.punched_at).toLocaleString("en-US", {
                          weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                        })}
                      </p>
                      {p.address_label && (
                        <p className="text-xs text-muted-foreground">{p.address_label}</p>
                      )}
                    </div>
                  </div>
                  <Badge
                    variant="secondary"
                    className={p.within_geofence ? "bg-success/10 text-success text-[10px]" : "bg-warning/10 text-warning text-[10px]"}
                  >
                    {p.within_geofence ? "✓ In Zone" : "⚠ Outside"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Zone Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <MapPin size={18} className="text-primary" />
              Add Geofence Zone
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Zone Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., Head Office, Castries"
                className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <button
              onClick={handleDetectLocation}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-secondary text-foreground rounded-lg text-sm font-medium hover:bg-muted transition-colors"
            >
              <Navigation size={16} className="text-primary" />
              Detect My Current Location
            </button>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Latitude</label>
                <input
                  type="text"
                  value={form.latitude}
                  onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                  placeholder="14.0101"
                  className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Longitude</label>
                <input
                  type="text"
                  value={form.longitude}
                  onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                  placeholder="-60.9875"
                  className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Radius (meters)</label>
              <input
                type="number"
                value={form.radius_meters}
                onChange={(e) => setForm({ ...form, radius_meters: e.target.value })}
                placeholder="100"
                min="10"
                max="5000"
                className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <p className="text-[10px] text-muted-foreground">Recommended: 50-200m for office, 500-1000m for campus</p>
            </div>

            <button
              onClick={handleAddZone}
              className="w-full px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Create Geofence Zone
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
