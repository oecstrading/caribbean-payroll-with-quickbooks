import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { ClipboardList, Plus, Cloud, Sun, CloudRain, Snowflake, Wind, Eye, Camera, Image, X, Mic } from "lucide-react";
import VoiceInput from "@/components/VoiceInput";
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
import { cn } from "@/lib/utils";

interface DailyReport {
  id: string; project_id: string; submitted_by: string; report_date: string; weather: string;
  crew_size: number; work_completed: string; safety_notes: string; issues: string;
  materials_used: string; status: string; created_at: string; photo_urls?: string[];
}

const weatherIcons: Record<string, any> = { clear: Sun, cloudy: Cloud, rain: CloudRain, storm: Wind, cold: Snowflake };

type ReportFilter = "all" | "today" | "issues";

export default function DailyReportsPage() {
  const { user } = useAuth();
  const { isAdminOrManager } = useRole();
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState<DailyReport | null>(null);
  const [filter, setFilter] = useState<ReportFilter>("all");
  const [photos, setPhotos] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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

  const uploadPhotos = async (): Promise<string[]> => {
    const urls: string[] = [];
    for (const file of photos) {
      const ext = file.name.split(".").pop();
      const path = `reports/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("field-photos").upload(path, file);
      if (!error) {
        const { data } = supabase.storage.from("field-photos").getPublicUrl(path);
        urls.push(data.publicUrl);
      }
    }
    return urls;
  };

  const handleCreate = async () => {
    if (!form.project_id) { toast.error("Select a project"); return; }
    if (!form.work_completed.trim()) { toast.error("Describe work completed"); return; }
    setUploading(true);
    const photoUrls = await uploadPhotos();
    const { error } = await supabase.from("daily_reports").insert({
      project_id: form.project_id, submitted_by: user?.id, report_date: form.report_date,
      weather: form.weather, crew_size: parseInt(form.crew_size) || 0, work_completed: form.work_completed,
      safety_notes: form.safety_notes, issues: form.issues, materials_used: form.materials_used,
      status: "submitted", photo_urls: photoUrls,
    } as any);
    setUploading(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Report submitted${photoUrls.length ? ` with ${photoUrls.length} photo(s)` : ""}`);
    setShowAdd(false);
    setPhotos([]);
    setForm({ project_id: "", report_date: new Date().toISOString().split("T")[0], weather: "clear", crew_size: "", work_completed: "", safety_notes: "", issues: "", materials_used: "" });
    fetchAll();
  };

  const getProjectName = (id: string) => projects.find(p => p.id === id)?.name || "Unknown";
  const getProfileName = (id: string) => { const p = profiles.find(pr => pr.user_id === id); return p ? `${p.first_name} ${p.last_name}` : "Unknown"; };

  const todayStr = new Date().toISOString().split("T")[0];
  const stats = {
    total: reports.length,
    today: reports.filter(r => r.report_date === todayStr).length,
    withIssues: reports.filter(r => r.issues?.trim()).length,
  };

  const filteredReports = reports.filter(r => {
    if (filter === "today") return r.report_date === todayStr;
    if (filter === "issues") return r.issues?.trim();
    return true;
  });

  const statCards: { key: ReportFilter; label: string; value: number; icon: any; color: string; bg: string }[] = [
    { key: "all", label: "Total Reports", value: stats.total, icon: ClipboardList, color: "text-primary", bg: "bg-primary/10" },
    { key: "today", label: "Today", value: stats.today, icon: Sun, color: "text-success", bg: "bg-success/10" },
    { key: "issues", label: "With Issues", value: stats.withIssues, icon: Wind, color: "text-destructive", bg: "bg-destructive/10" },
  ];

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
        {statCards.map(s => (
          <Card key={s.key} onClick={() => setFilter(filter === s.key ? "all" : s.key)}
            className={cn("shadow-card border-border/60 cursor-pointer transition-all hover:shadow-md",
              filter === s.key && "ring-2 ring-primary border-primary/40")}>
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

      {filter !== "all" && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">Filtered: {filter === "today" ? "Today's reports" : "Reports with issues"}</Badge>
          <Button variant="ghost" size="sm" onClick={() => setFilter("all")} className="text-xs h-6">Clear</Button>
        </div>
      )}

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
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Photos</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Issues</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">View</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={8} className="py-8 text-center text-muted-foreground">Loading...</td></tr> :
                filteredReports.length === 0 ? <tr><td colSpan={8} className="py-8 text-center text-muted-foreground">No reports found</td></tr> :
                filteredReports.map((r, i) => {
                  const WeatherIcon = weatherIcons[r.weather] || Sun;
                  const photoCount = r.photo_urls?.length || 0;
                  return (
                    <motion.tr key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                      className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                      <td className="py-3 px-4 font-medium text-foreground">{new Date(r.report_date).toLocaleDateString()}</td>
                      <td className="py-3 px-4 text-foreground">{getProjectName(r.project_id)}</td>
                      <td className="py-3 px-4 text-muted-foreground">{getProfileName(r.submitted_by)}</td>
                      <td className="py-3 px-4"><WeatherIcon size={16} className="text-muted-foreground inline" /> <span className="capitalize text-xs">{r.weather}</span></td>
                      <td className="py-3 px-4 text-foreground">{r.crew_size}</td>
                      <td className="py-3 px-4">
                        {photoCount > 0 ? <Badge variant="secondary" className="bg-primary/10 text-primary text-[10px]"><Image size={10} className="mr-1" />{photoCount}</Badge> :
                          <span className="text-xs text-muted-foreground">—</span>}
                      </td>
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
      <Dialog open={showAdd} onOpenChange={o => { if (!o) { setShowAdd(false); setPhotos([]); } else setShowAdd(true); }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
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
            <div>
              <div className="flex items-center gap-2"><label className="text-xs text-muted-foreground">Work Completed *</label><VoiceInput onTranscript={(t) => setForm(f => ({...f, work_completed: f.work_completed ? f.work_completed + " " + t : t}))} /></div>
              <textarea value={form.work_completed} onChange={e => setForm({...form, work_completed: e.target.value})} rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" /></div>
            <div>
              <div className="flex items-center gap-2"><label className="text-xs text-muted-foreground">Safety Notes</label><VoiceInput onTranscript={(t) => setForm(f => ({...f, safety_notes: f.safety_notes ? f.safety_notes + " " + t : t}))} /></div>
              <textarea value={form.safety_notes} onChange={e => setForm({...form, safety_notes: e.target.value})} rows={2}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" /></div>
            <div>
              <div className="flex items-center gap-2"><label className="text-xs text-muted-foreground">Issues / Delays</label><VoiceInput onTranscript={(t) => setForm(f => ({...f, issues: f.issues ? f.issues + " " + t : t}))} /></div>
              <textarea value={form.issues} onChange={e => setForm({...form, issues: e.target.value})} rows={2}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" /></div>
            <div>
              <div className="flex items-center gap-2"><label className="text-xs text-muted-foreground">Materials Used</label><VoiceInput onTranscript={(t) => setForm(f => ({...f, materials_used: f.materials_used ? f.materials_used + " " + t : t}))} /></div>
              <Input value={form.materials_used} onChange={e => setForm({...form, materials_used: e.target.value})} /></div>

            {/* Photo Upload */}
            <div>
              <label className="text-xs text-muted-foreground">Site Photos</label>
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
                onChange={e => { if (e.target.files) setPhotos(prev => [...prev, ...Array.from(e.target.files!)]); }} />
              <div className="flex flex-wrap gap-2 mt-1">
                {photos.map((f, i) => (
                  <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-border">
                    <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
                    <button onClick={() => setPhotos(photos.filter((_, j) => j !== i))}
                      className="absolute top-0 right-0 p-0.5 bg-destructive rounded-bl-lg"><X size={10} className="text-destructive-foreground" /></button>
                  </div>
                ))}
                <button onClick={() => fileRef.current?.click()}
                  className="w-16 h-16 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 hover:border-primary/50 transition-colors">
                  <Camera size={16} className="text-muted-foreground" />
                  <span className="text-[9px] text-muted-foreground">Add</span>
                </button>
              </div>
            </div>

            <Button onClick={handleCreate} className="w-full" disabled={uploading}>
              {uploading ? "Uploading..." : "Submit Report"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Report */}
      <Dialog open={!!selected} onOpenChange={open => !open && setSelected(null)}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
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
                {/* Photos */}
                {selected.photo_urls && selected.photo_urls.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Site Photos ({selected.photo_urls.length})</h4>
                    <div className="grid grid-cols-3 gap-2">
                      {selected.photo_urls.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="aspect-square rounded-lg overflow-hidden border border-border hover:border-primary/50 transition-colors">
                          <img src={url} alt={`Site photo ${i + 1}`} className="w-full h-full object-cover" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
