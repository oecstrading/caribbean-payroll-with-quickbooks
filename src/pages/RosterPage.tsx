import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Calendar, ChevronLeft, ChevronRight, Plus, Clock, Users, X, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import { toast } from "sonner";
import { format, startOfWeek, addDays, isSameDay } from "date-fns";
import { pairShifts, hoursOn } from "@/lib/roster-hours";

interface Site {
  id: string;
  name: string;
  client_name: string;
  status: string;
}

interface Assignment {
  id: string;
  user_id: string;
  site_id: string;
  shift_start: string | null;
  shift_end: string | null;
  is_active: boolean;
  days_of_week: string[] | null;
}

interface Profile {
  user_id: string;
  first_name: string;
  last_name: string;
}

interface PunchSummary {
  user_id: string;
  site_name: string;
  total_hours: number;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const FULL_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function RosterPage() {
  const { isAdminOrManager } = useRole();
  const [sites, setSites] = useState<Site[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [punches, setPunches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [showAssign, setShowAssign] = useState(false);
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [assignForm, setAssignForm] = useState({ userId: "", shiftStart: "18:00", shiftEnd: "06:00", days: [] as string[] });
  const [showHours, setShowHours] = useState(false);
  const [manualHours, setManualHours] = useState({ userId: "", siteId: "", hours: "", date: format(new Date(), "yyyy-MM-dd"), description: "" });

  const weekDates = useMemo(() => DAYS.map((_, i) => addDays(weekStart, i)), [weekStart]);

  const fetchAll = async () => {
    const weekEndStr = format(addDays(weekStart, 6), "yyyy-MM-dd");
    const weekStartStr = format(weekStart, "yyyy-MM-dd");

    const [sitesRes, assignRes, profilesRes, punchesRes] = await Promise.all([
      supabase.from("client_sites").select("id, name, client_name, status").eq("status", "active"),
      supabase.from("guard_assignments").select("*").eq("is_active", true),
      supabase.from("profiles").select("user_id, first_name, last_name").eq("status", "Active"),
      supabase.from("clock_punches").select("user_id, punched_at, punch_type, geofence_zone_id, address_label, site_id")
        .gte("punched_at", addDays(weekStart, -1).toISOString())
        .lte("punched_at", addDays(weekStart, 8).toISOString()),
    ]);

    setSites(sitesRes.data || []);
    setAssignments(assignRes.data || []);
    setProfiles(profilesRes.data || []);
    setPunches(punchesRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, [weekStart]);

  const getName = (userId: string) => {
    const p = profiles.find(p => p.user_id === userId);
    return p ? `${p.first_name} ${p.last_name}` : "Unknown";
  };

  const getAssignmentsForSiteAndDay = (siteId: string, dayIndex: number) => {
    const dayName = FULL_DAYS[dayIndex];
    return assignments.filter(a => {
      if (a.site_id !== siteId) return false;
      if (!a.days_of_week || a.days_of_week.length === 0) return true; // assigned every day
      return a.days_of_week.includes(dayName);
    });
  };

  // Calculate hours from punches for a user on a given date
  // Shifts pair across midnight (an 18:00–06:00 shift counts on its start day) and keep their site.
  const shifts = useMemo(() => pairShifts(punches), [punches]);
  const getHoursForUserOnDate = (userId: string, date: Date, siteId?: string) => hoursOn(shifts, userId, date, siteId);

  // Total weekly hours per guard per site
  const getWeeklyHours = (userId: string, siteId?: string) => {
    return weekDates.reduce((sum, date) => sum + getHoursForUserOnDate(userId, date, siteId), 0);
  };

  const handleAssign = async () => {
    if (!assignForm.userId || !selectedSiteId) { toast.error("Select a guard and site"); return; }
    const { error } = await supabase.from("guard_assignments").insert({
      user_id: assignForm.userId,
      site_id: selectedSiteId,
      shift_start: assignForm.shiftStart,
      shift_end: assignForm.shiftEnd,
      days_of_week: assignForm.days.length > 0 ? assignForm.days : FULL_DAYS,
    });
    if (error) { toast.error("Failed to assign"); return; }
    toast.success("Guard assigned to roster");
    setShowAssign(false);
    setAssignForm({ userId: "", shiftStart: "18:00", shiftEnd: "06:00", days: [] });
    fetchAll();
  };

  const handleRemoveAssignment = async (id: string) => {
    const { error } = await supabase.from("guard_assignments").update({ is_active: false }).eq("id", id);
    if (error) { toast.error("Failed to remove"); return; }
    toast.success("Assignment removed");
    fetchAll();
  };

  const handleManualHours = async () => {
    if (!manualHours.userId || !manualHours.siteId || !manualHours.hours) {
      toast.error("Fill in all fields"); return;
    }
    // Insert as clock_in + clock_out pair
    const hours = parseFloat(manualHours.hours);
    const clockIn = new Date(manualHours.date + "T08:00:00");
    const clockOut = new Date(clockIn.getTime() + hours * 60 * 60 * 1000);

    const { error } = await supabase.from("clock_punches").insert([
      { user_id: manualHours.userId, punch_type: "clock_in", punched_at: clockIn.toISOString(), address_label: `Manual entry${manualHours.description ? ` — ${manualHours.description}` : ""}`, site_id: manualHours.siteId },
      { user_id: manualHours.userId, punch_type: "clock_out", punched_at: clockOut.toISOString(), address_label: `Manual entry${manualHours.description ? ` — ${manualHours.description}` : ""}`, site_id: manualHours.siteId },
    ]);
    if (error) { toast.error("Failed to log hours"); return; }
    toast.success(`${hours}h logged manually`);
    setShowHours(false);
    setManualHours({ userId: "", siteId: "", hours: "", date: format(new Date(), "yyyy-MM-dd"), description: "" });
    fetchAll();
  };

  // Get unique guards across all assignments
  const allAssignedGuards = useMemo(() => {
    const ids = new Set(assignments.map(a => a.user_id));
    return Array.from(ids);
  }, [assignments]);

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading roster...</div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Weekly Roster</h1>
          <p className="text-sm text-muted-foreground">Guard assignments by client site — week of {format(weekStart, "MMM d, yyyy")}</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdminOrManager && (
            <>
              <button onClick={() => setShowHours(true)} className="flex items-center gap-1.5 px-3 py-2 border border-input rounded-lg text-sm hover:bg-muted transition-colors">
                <Clock size={14} /> Log Hours
              </button>
              <button onClick={() => { setShowAssign(true); setSelectedSiteId(sites[0]?.id || ""); }} className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
                <Plus size={14} /> Assign Guard
              </button>
            </>
          )}
        </div>
      </div>

      {/* Week navigator */}
      <div className="flex items-center justify-between bg-card border border-border rounded-lg p-3">
        <button onClick={() => setWeekStart(addDays(weekStart, -7))} className="p-2 rounded-lg hover:bg-muted transition-colors">
          <ChevronLeft size={18} />
        </button>
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-primary" />
          <span className="text-sm font-medium">{format(weekStart, "MMM d")} — {format(addDays(weekStart, 6), "MMM d, yyyy")}</span>
        </div>
        <button onClick={() => setWeekStart(addDays(weekStart, 7))} className="p-2 rounded-lg hover:bg-muted transition-colors">
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Roster Calendar per Site */}
      {sites.length === 0 ? (
        <Card className="shadow-card border-border/60">
          <CardContent className="p-12 text-center">
            <Users size={48} className="mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-display font-semibold mb-2">No Active Sites</h3>
            <p className="text-sm text-muted-foreground">Add client sites first to create a roster.</p>
          </CardContent>
        </Card>
      ) : (
        sites.map(site => {
          const siteAssignments = assignments.filter(a => a.site_id === site.id);
          const guardIds = Array.from(new Set(siteAssignments.map(a => a.user_id)));

          return (
            <Card key={site.id} className="shadow-card border-border/60 overflow-hidden">
              <CardHeader className="pb-2 bg-muted/30">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-display flex items-center gap-2">
                    {site.name}
                    {site.client_name && <Badge variant="secondary" className="text-[10px]">{site.client_name}</Badge>}
                  </CardTitle>
                  <Badge variant="outline" className="text-[10px]">{guardIds.length} guards</Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left p-3 font-medium text-muted-foreground min-w-[140px]">Guard</th>
                        {weekDates.map((date, i) => (
                          <th key={i} className="text-center p-2 font-medium text-muted-foreground min-w-[90px]">
                            <div className="text-xs">{DAYS[i]}</div>
                            <div className={`text-[10px] ${isSameDay(date, new Date()) ? "text-primary font-bold" : ""}`}>
                              {format(date, "d MMM")}
                            </div>
                          </th>
                        ))}
                        <th className="text-center p-2 font-medium text-muted-foreground min-w-[70px]">Weekly Hrs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {guardIds.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="p-4 text-center text-muted-foreground text-xs">
                            No guards assigned to this site
                          </td>
                        </tr>
                      ) : (
                        guardIds.map(userId => {
                          const guardAssignments = siteAssignments.filter(a => a.user_id === userId);
                          const weeklyHrs = getWeeklyHours(userId, site.id);
                          return (
                            <tr key={userId} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                              <td className="p-3">
                                <div className="flex items-center justify-between">
                                  <span className="font-medium text-foreground text-xs">{getName(userId)}</span>
                                  {isAdminOrManager && guardAssignments[0] && (
                                    <button
                                      onClick={() => handleRemoveAssignment(guardAssignments[0].id)}
                                      className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                      title="Remove assignment"
                                    >
                                      <X size={12} />
                                    </button>
                                  )}
                                </div>
                                {guardAssignments[0]?.shift_start && (
                                  <span className="text-[10px] text-muted-foreground">
                                    {guardAssignments[0].shift_start} — {guardAssignments[0].shift_end}
                                  </span>
                                )}
                              </td>
                              {weekDates.map((date, dayIdx) => {
                                const assigned = getAssignmentsForSiteAndDay(site.id, dayIdx)
                                  .some(a => a.user_id === userId);
                                const hours = getHoursForUserOnDate(userId, date, site.id);
                                const isToday = isSameDay(date, new Date());
                                return (
                                  <td key={dayIdx} className={`text-center p-2 ${isToday ? "bg-primary/5" : ""}`}>
                                    {assigned ? (
                                      <div className="flex flex-col items-center gap-0.5">
                                        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                                          <Check size={12} className="text-primary" />
                                        </div>
                                        {hours > 0 && (
                                          <span className="text-[10px] font-medium text-success">{hours.toFixed(1)}h</span>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-muted-foreground/30">—</span>
                                    )}
                                  </td>
                                );
                              })}
                              <td className="text-center p-2">
                                <span className={`text-xs font-bold ${weeklyHrs > 40 ? "text-warning" : weeklyHrs > 0 ? "text-success" : "text-muted-foreground"}`}>
                                  {weeklyHrs > 0 ? `${weeklyHrs.toFixed(1)}h` : "—"}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}

      {/* Hours Summary Card */}
      {allAssignedGuards.length > 0 && (
        <Card className="shadow-card border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <Clock size={16} className="text-primary" />
              Weekly Hours Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {allAssignedGuards.map(userId => {
                const hrs = getWeeklyHours(userId);
                const guardSites = assignments.filter(a => a.user_id === userId);
                const siteNames = guardSites.map(a => sites.find(s => s.id === a.site_id)?.name).filter(Boolean);
                return (
                  <div key={userId} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
                    <div>
                      <p className="text-sm font-medium text-foreground">{getName(userId)}</p>
                      <p className="text-[10px] text-muted-foreground">{siteNames.join(", ") || "No site"}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${hrs > 40 ? "text-warning" : hrs > 0 ? "text-success" : "text-muted-foreground"}`}>
                        {hrs > 0 ? `${hrs.toFixed(1)}h` : "0h"}
                      </p>
                      {hrs > 40 && <p className="text-[10px] text-warning">Overtime</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Assign Guard Dialog */}
      <Dialog open={showAssign} onOpenChange={setShowAssign}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Assign Guard to Site</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Client Site</label>
              <select value={selectedSiteId} onChange={e => setSelectedSiteId(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                {sites.map(s => <option key={s.id} value={s.id}>{s.name} {s.client_name ? `(${s.client_name})` : ""}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Guard</label>
              <select value={assignForm.userId} onChange={e => setAssignForm(f => ({ ...f, userId: e.target.value }))} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">Select guard...</option>
                {profiles.map(p => <option key={p.user_id} value={p.user_id}>{p.first_name} {p.last_name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Shift Start</label>
                <Input type="time" value={assignForm.shiftStart} onChange={e => setAssignForm(f => ({ ...f, shiftStart: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Shift End</label>
                <Input type="time" value={assignForm.shiftEnd} onChange={e => setAssignForm(f => ({ ...f, shiftEnd: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">Days of Week</label>
              <div className="flex flex-wrap gap-2">
                {FULL_DAYS.map((day, i) => (
                  <label key={day} className="flex items-center gap-1.5 cursor-pointer">
                    <Checkbox
                      checked={assignForm.days.includes(day)}
                      onCheckedChange={(checked) => {
                        setAssignForm(f => ({
                          ...f,
                          days: checked ? [...f.days, day] : f.days.filter(d => d !== day)
                        }));
                      }}
                    />
                    <span className="text-xs">{DAYS[i]}</span>
                  </label>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Leave unchecked for all days</p>
            </div>
            <button onClick={handleAssign} className="w-full px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
              Assign to Roster
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manual Hours Dialog */}
      <Dialog open={showHours} onOpenChange={setShowHours}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Log Manual Hours</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Guard</label>
              <select value={manualHours.userId} onChange={e => setManualHours(f => ({ ...f, userId: e.target.value }))} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">Select guard...</option>
                {profiles.map(p => <option key={p.user_id} value={p.user_id}>{p.first_name} {p.last_name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Client Site</label>
              <select value={manualHours.siteId} onChange={e => setManualHours(f => ({ ...f, siteId: e.target.value }))} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">Select site...</option>
                {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Date</label>
                <Input type="date" value={manualHours.date} onChange={e => setManualHours(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Hours</label>
                <Input type="number" step="0.5" min="0.5" max="24" placeholder="8" value={manualHours.hours} onChange={e => setManualHours(f => ({ ...f, hours: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Note (optional)</label>
              <Input placeholder="e.g. Covered for absent guard" value={manualHours.description} onChange={e => setManualHours(f => ({ ...f, description: e.target.value }))} />
            </div>
            <button onClick={handleManualHours} className="w-full px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
              Log Hours
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
