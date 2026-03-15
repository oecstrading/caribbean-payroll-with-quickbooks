import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ClipboardList, Plus, Cloud, Sun, CloudRain, Snowflake, Wind, Eye } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { toast } from "sonner";

interface DailyReport {
  id: string; project_id: string; submitted_by: string; report_date: string; weather: string;
  crew_size: number; work_completed: string; safety_notes: string; issues: string;
  materials_used: string; status: string; created_at: string;
}

const weatherIcons: Record<string, any> = { clear: Sun, cloudy: Cloud, rain: CloudRain, storm: Wind, cold: Snowflake };

export default function DailyReportsPage() {
  const { user } = useAuth();
  const { isAdminOrManager } = useRole();
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState<DailyReport | null>(null);

  const [form, setForm] = useState({
    project_id: "", report_date: new Date().toISOString().split("T")[0],
    weather: "clear", crew_size: "", work_completed: "", safety_notes: "", issues: "", materials_used: "",
  });

  const fetchAll = async () => {
    const [{ data: rp }, { data: pr }, { data: pf }] = await Promise.all([
      supabase.from("daily_reports").select("*").order("report_date", { ascending: false }),
      supabase.from("projects").select("id, name"),
      supabase.from("profiles").select("user_id, first_name, last_name"),
    ]);
    setReports((rp as any[]) || []);
    setProjects((pr as any[]) || []);
    setProfiles(pf || []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const handleCreate = async () => {
    if (!form.project_id) { toast.error("Select a project"); return; }
    if (!form.work_completed.trim()) { toast.error("Describe work completed"); return; }
    const { error } = await supabase.from("daily_reports").insert({
      project_id: form.project_id, submitted_by: user?.id, report_date: form.report_date,
      weather: form.weather, crew_size: parseInt(form.crew_size) || 0, work_completed: form.work_completed,
      safety_notes: form.safety_notes, issues: form.issues, materials_used: form.materials_used, status: "submitted",
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("Report submitted");
    setShowAdd(false);
    setForm({ project_id: "", report_date: new Date().toISOString().split("T")[0], weather: "clear", crew_size: "", work_completed: "", safety_notes: "", issues: "", materials_used: "" });
    fetchAll();
  };

  const getProjectName = (id: string) => projects.find(p => p.id === id)?.name || "Unknown";
  const getProfileName = (id: string) => { const p = profiles.find(pr => pr.user_id === id); return p ? `${p.first_name} ${p.last_name}` : "Unknown"; };

  const stats = {
    total: reports.length,
    today: reports.filter(r => r.report_date === new Date().toISOString().split("T")[0]).length,
    withIssues: reports.filter(r => r.issues?.trim()).length,
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4 md:space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-display font-bold text-foreground">Daily Field Reports</h1>
          <p className="text-sm text-muted-foreground mt-1">Submit and review daily site reports</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="gap-2"><Plus size={16} /> New Report</Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Reports", value: stats.total, icon: ClipboardList, color: "text-primary", bg: "bg-primary/10" },
          { label: "Today", value: stats.today, icon: Sun, color: "text-success", bg: "bg-success/10" },
          { label: "With Issues", value: stats.withIssues, icon: Wind, color: "text-destructive", bg: "bg-destructive/10" },
        ].map(s => (
          <Card key={s.label} className="shadow-card border-border/60">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`p-2 rounded-lg ${s.bg}`}><s.icon size={18} className={s.color} /></div>
              <div>
                <p className="text-lg font-display font-bold text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-card border-border/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Date</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Project</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Submitted By</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Weather</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Crew</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Issues</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">View</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">Loading...</td></tr> :
                reports.length === 0 ? <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">No reports yet</td></tr> :
                reports.map((r, i) => {
                  const WeatherIcon = weatherIcons[r.weather] || Sun;
                  return (
                    <motion.tr key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                      className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                      <td className="py-3 px-4 font-medium text-foreground">{new Date(r.report_date).toLocaleDateString()}</td>
                      <td className="py-3 px-4 text-foreground">{getProjectName(r.project_id)}</td>
                      <td className="py-3 px-4 text-muted-foreground">{getProfileName(r.submitted_by)}</td>
                      <td className="py-3 px-4"><WeatherIcon size={16} className="text-muted-foreground inline" /> <span className="capitalize text-xs">{r.weather}</span></td>
                      <td className="py-3 px-4 text-foreground">{r.crew_size}</td>
                      <td className="py-3 px-4">
                        {r.issues?.trim() ? <Badge variant="secondary" className="bg-destructive/10 text-destructive text-[10px]">Has Issues</Badge> :
                          <span className="text-xs text-muted-foreground">None</span>}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button variant="ghost" size="sm" onClick={() => setSelected(r)}><Eye size={14} /></Button>
                      </td>
                    </motion.tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add Report */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle className="font-display">New Daily Report</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Select value={form.project_id} onValueChange={v => setForm({...form, project_id: v})}>
              <SelectTrigger><SelectValue placeholder="Select project *" /></SelectTrigger>
              <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
            <div className="grid grid-cols-3 gap-2">
              <div><label className="text-xs text-muted-foreground">Date</label><Input type="date" value={form.report_date} onChange={e => setForm({...form, report_date: e.target.value})} /></div>
              <div>
                <label className="text-xs text-muted-foreground">Weather</label>
                <Select value={form.weather} onValueChange={v => setForm({...form, weather: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["clear", "cloudy", "rain", "storm", "cold"].map(w => <SelectItem key={w} value={w} className="capitalize">{w}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><label className="text-xs text-muted-foreground">Crew Size</label><Input type="number" value={form.crew_size} onChange={e => setForm({...form, crew_size: e.target.value})} /></div>
            </div>
            <div><label className="text-xs text-muted-foreground">Work Completed *</label>
              <textarea value={form.work_completed} onChange={e => setForm({...form, work_completed: e.target.value})} rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" /></div>
            <div><label className="text-xs text-muted-foreground">Safety Notes</label>
              <textarea value={form.safety_notes} onChange={e => setForm({...form, safety_notes: e.target.value})} rows={2}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" /></div>
            <div><label className="text-xs text-muted-foreground">Issues / Delays</label>
              <textarea value={form.issues} onChange={e => setForm({...form, issues: e.target.value})} rows={2}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" /></div>
            <div><label className="text-xs text-muted-foreground">Materials Used</label>
              <Input value={form.materials_used} onChange={e => setForm({...form, materials_used: e.target.value})} /></div>
            <Button onClick={handleCreate} className="w-full">Submit Report</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Report */}
      <Dialog open={!!selected} onOpenChange={open => !open && setSelected(null)}>
        <DialogContent className="sm:max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display">Report — {new Date(selected.report_date).toLocaleDateString()}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div><span className="text-muted-foreground">Project:</span> <span className="text-foreground font-medium">{getProjectName(selected.project_id)}</span></div>
                  <div><span className="text-muted-foreground">Submitted by:</span> <span className="text-foreground">{getProfileName(selected.submitted_by)}</span></div>
                  <div><span className="text-muted-foreground">Weather:</span> <span className="capitalize text-foreground">{selected.weather}</span></div>
                  <div><span className="text-muted-foreground">Crew Size:</span> <span className="text-foreground">{selected.crew_size}</span></div>
                </div>
                <div><h4 className="text-xs font-semibold text-muted-foreground uppercase mb-1">Work Completed</h4><p className="text-foreground bg-secondary/50 p-3 rounded-lg">{selected.work_completed || "—"}</p></div>
                {selected.safety_notes?.trim() && <div><h4 className="text-xs font-semibold text-muted-foreground uppercase mb-1">Safety Notes</h4><p className="text-foreground bg-secondary/50 p-3 rounded-lg">{selected.safety_notes}</p></div>}
                {selected.issues?.trim() && <div><h4 className="text-xs font-semibold text-destructive uppercase mb-1">Issues / Delays</h4><p className="text-foreground bg-destructive/5 border border-destructive/20 p-3 rounded-lg">{selected.issues}</p></div>}
                {selected.materials_used?.trim() && <div><h4 className="text-xs font-semibold text-muted-foreground uppercase mb-1">Materials Used</h4><p className="text-foreground bg-secondary/50 p-3 rounded-lg">{selected.materials_used}</p></div>}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
