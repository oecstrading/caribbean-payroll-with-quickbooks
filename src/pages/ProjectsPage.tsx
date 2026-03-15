import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { FolderKanban, Plus, Users, MapPin, Calendar, DollarSign, Search, X, Clock, Timer } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Project {
  id: string; name: string; client_name: string; address: string; status: string;
  start_date: string; end_date: string | null; budget: number; description: string;
}
interface Assignment {
  id: string; project_id: string; user_id: string; role: string; hourly_rate: number;
  profile?: { first_name: string; last_name: string };
}
interface TimeLog {
  id: string; project_id: string; user_id: string; log_date: string; hours: number; description: string;
}

type ProjectFilter = null | "active" | "completed" | "on-hold";

export default function ProjectsPage() {
  const { isAdminOrManager } = useRole();
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProjectFilter>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([]);
  const [allTimeLogs, setAllTimeLogs] = useState<TimeLog[]>([]);
  const [profiles, setProfiles] = useState<{ id: string; user_id: string; first_name: string; last_name: string }[]>([]);
  const [detailTab, setDetailTab] = useState("info");

  const [form, setForm] = useState({ name: "", client_name: "", address: "", description: "", budget: "", start_date: "", end_date: "" });
  const [timeForm, setTimeForm] = useState({ hours: "", description: "", log_date: new Date().toISOString().split("T")[0] });

  const fetchProjects = async () => {
    const [{ data }, { data: tl }] = await Promise.all([
      supabase.from("projects").select("*").order("created_at", { ascending: false }),
      supabase.from("project_time_logs").select("*"),
    ]);
    setProjects((data as any[]) || []);
    setAllTimeLogs((tl as any[]) || []);
    setLoading(false);
  };
  const fetchProfiles = async () => {
    const { data } = await supabase.from("profiles").select("id, user_id, first_name, last_name");
    setProfiles(data || []);
  };

  useEffect(() => { fetchProjects(); fetchProfiles(); }, []);

  const fetchAssignments = async (projectId: string) => {
    const { data } = await supabase.from("project_assignments").select("*").eq("project_id", projectId);
    setAssignments(((data as any[]) || []).map((a: any) => ({ ...a, profile: profiles.find(p => p.user_id === a.user_id) })));
  };
  const fetchTimeLogs = async (projectId: string) => {
    const { data } = await supabase.from("project_time_logs").select("*").eq("project_id", projectId).order("log_date", { ascending: false });
    setTimeLogs((data as any[]) || []);
  };

  useEffect(() => {
    if (selectedProject) { fetchAssignments(selectedProject.id); fetchTimeLogs(selectedProject.id); }
  }, [selectedProject, profiles]);

  const handleCreate = async () => {
    if (!form.name.trim()) { toast.error("Project name is required"); return; }
    const { error } = await supabase.from("projects").insert({
      name: form.name, client_name: form.client_name, address: form.address,
      description: form.description, budget: parseFloat(form.budget) || 0,
      start_date: form.start_date || undefined, end_date: form.end_date || undefined,
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("Project created");
    setShowAdd(false);
    setForm({ name: "", client_name: "", address: "", description: "", budget: "", start_date: "", end_date: "" });
    fetchProjects();
  };

  const [assignRate, setAssignRate] = useState("");
  const handleAssign = async (projectId: string, userId: string) => {
    const rate = parseFloat(assignRate) || 0;
    const { error } = await supabase.from("project_assignments").insert({ project_id: projectId, user_id: userId, hourly_rate: rate } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("Employee assigned"); setAssignRate(""); fetchAssignments(projectId);
  };
  const handleUpdateRate = async (assignmentId: string, newRate: number) => {
    const { error } = await supabase.from("project_assignments").update({ hourly_rate: newRate } as any).eq("id", assignmentId);
    if (error) { toast.error(error.message); return; }
    toast.success("Rate updated");
    if (selectedProject) fetchAssignments(selectedProject.id);
  };
  const handleUnassign = async (assignmentId: string) => {
    await supabase.from("project_assignments").delete().eq("id", assignmentId);
    if (selectedProject) fetchAssignments(selectedProject.id);
    toast.success("Employee removed");
  };
  const handleStatusChange = async (projectId: string, status: string) => {
    await supabase.from("projects").update({ status } as any).eq("id", projectId);
    fetchProjects(); toast.success("Status updated");
  };
  const handleLogTime = async () => {
    if (!selectedProject || !timeForm.hours) { toast.error("Enter hours"); return; }
    const { error } = await supabase.from("project_time_logs").insert({
      project_id: selectedProject.id, user_id: user?.id,
      hours: parseFloat(timeForm.hours), description: timeForm.description, log_date: timeForm.log_date,
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("Time logged"); setTimeForm({ hours: "", description: "", log_date: new Date().toISOString().split("T")[0] });
    fetchTimeLogs(selectedProject.id); fetchProjects();
  };

  const filtered = projects.filter(p => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.client_name.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter && p.status !== statusFilter) return false;
    return true;
  });

  const stats = {
    total: projects.length,
    active: projects.filter(p => p.status === "active").length,
    completed: projects.filter(p => p.status === "completed").length,
    totalBudget: projects.reduce((s, p) => s + (p.budget || 0), 0),
  };

  const getProjectHours = (projectId: string) => allTimeLogs.filter(t => t.project_id === projectId).reduce((s, t) => s + t.hours, 0);
  const getProfileName = (uid: string) => { const p = profiles.find(pr => pr.user_id === uid); return p ? `${p.first_name} ${p.last_name}` : "Unknown"; };

  const statCards: { key: ProjectFilter; label: string; value: string | number; icon: any; color: string; bg: string }[] = [
    { key: null, label: "Total Projects", value: stats.total, icon: FolderKanban, color: "text-primary", bg: "bg-primary/10" },
    { key: "active", label: "Active", value: stats.active, icon: Calendar, color: "text-success", bg: "bg-success/10" },
    { key: "completed", label: "Completed", value: stats.completed, icon: MapPin, color: "text-muted-foreground", bg: "bg-secondary" },
    { key: null, label: "Total Budget", value: `$${stats.totalBudget.toLocaleString()}`, icon: DollarSign, color: "text-warning", bg: "bg-warning/10" },
  ];

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4 md:space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-display font-bold text-foreground">Projects & Job Sites</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage jobs, assign crews, and track labor costs</p>
        </div>
        {isAdminOrManager && <Button onClick={() => setShowAdd(true)} className="gap-2"><Plus size={16} /> New Project</Button>}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {statCards.map((s, i) => (
          <Card key={s.label} onClick={() => { if (s.key !== undefined) setStatusFilter(statusFilter === s.key ? null : s.key); }}
            className={cn("shadow-card border-border/60 transition-all",
              s.key !== undefined && "cursor-pointer hover:shadow-md",
              statusFilter === s.key && s.key !== null && "ring-2 ring-primary border-primary/40")}>
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

      {statusFilter && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs capitalize">Filtered: {statusFilter}</Badge>
          <Button variant="ghost" size="sm" onClick={() => setStatusFilter(null)} className="text-xs h-6">Clear</Button>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search projects..." className="pl-9" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading ? <p className="col-span-full text-center text-muted-foreground py-12">Loading...</p> :
          filtered.length === 0 ? <p className="col-span-full text-center text-muted-foreground py-12">No projects found</p> :
          filtered.map((project, i) => {
            const hrs = getProjectHours(project.id);
            return (
              <motion.div key={project.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Card className="shadow-card border-border/60 cursor-pointer hover:border-primary/30 transition-colors"
                  onClick={() => { setSelectedProject(project); setDetailTab("info"); }}>
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-start justify-between">
                      <h3 className="font-display font-semibold text-foreground">{project.name}</h3>
                      <Badge variant="secondary" className={
                        project.status === "active" ? "bg-success/10 text-success" :
                        project.status === "completed" ? "bg-muted text-muted-foreground" : "bg-warning/10 text-warning"
                      }>{project.status}</Badge>
                    </div>
                    {project.client_name && <p className="text-sm text-muted-foreground">Client: {project.client_name}</p>}
                    {project.address && <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin size={12} />{project.address}</p>}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Budget: ${(project.budget || 0).toLocaleString()}</span>
                      {hrs > 0 && <span className="flex items-center gap-1"><Timer size={12} />{hrs.toFixed(1)} hrs</span>}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
      </div>

      {/* Add Project */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">New Project</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Project Name *" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
            <Input placeholder="Client Name" value={form.client_name} onChange={e => setForm({...form, client_name: e.target.value})} />
            <Input placeholder="Address / Location" value={form.address} onChange={e => setForm({...form, address: e.target.value})} />
            <Input placeholder="Budget ($)" type="number" value={form.budget} onChange={e => setForm({...form, budget: e.target.value})} />
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-xs text-muted-foreground">Start</label><Input type="date" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} /></div>
              <div><label className="text-xs text-muted-foreground">End</label><Input type="date" value={form.end_date} onChange={e => setForm({...form, end_date: e.target.value})} /></div>
            </div>
            <textarea placeholder="Description" value={form.description} onChange={e => setForm({...form, description: e.target.value})}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" rows={3} />
            <Button onClick={handleCreate} className="w-full">Create Project</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Project Detail with Tabs */}
      <Dialog open={!!selectedProject} onOpenChange={open => !open && setSelectedProject(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          {selectedProject && (
            <>
              <DialogHeader><DialogTitle className="font-display">{selectedProject.name}</DialogTitle></DialogHeader>
              <Tabs value={detailTab} onValueChange={setDetailTab}>
                <TabsList><TabsTrigger value="info">Details</TabsTrigger><TabsTrigger value="team">Team ({assignments.length})</TabsTrigger><TabsTrigger value="hours">Hours ({timeLogs.length})</TabsTrigger></TabsList>

                <TabsContent value="info" className="space-y-4 mt-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-muted-foreground">Client:</span> <span className="text-foreground">{selectedProject.client_name || "—"}</span></div>
                    <div><span className="text-muted-foreground">Location:</span> <span className="text-foreground">{selectedProject.address || "—"}</span></div>
                    <div><span className="text-muted-foreground">Budget:</span> <span className="font-mono text-foreground">${(selectedProject.budget || 0).toLocaleString()}</span></div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Status:</span>
                      {isAdminOrManager ? (
                        <Select value={selectedProject.status} onValueChange={v => { handleStatusChange(selectedProject.id, v); setSelectedProject({...selectedProject, status: v}); }}>
                          <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="on-hold">On Hold</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : <Badge variant="secondary">{selectedProject.status}</Badge>}
                    </div>
                  </div>
                  {selectedProject.description && <p className="text-sm text-muted-foreground">{selectedProject.description}</p>}
                  <div className="p-3 rounded-lg bg-secondary/50 flex items-center gap-3">
                    <Timer size={16} className="text-primary" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">{timeLogs.reduce((s, t) => s + t.hours, 0).toFixed(1)} total hours logged</p>
                      <p className="text-xs text-muted-foreground">{timeLogs.length} entries</p>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="team" className="space-y-3 mt-3">
                  {assignments.map(a => (
                    <div key={a.id} className="flex items-center justify-between p-2 rounded-lg bg-secondary/50">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-xs font-bold text-primary">{(a.profile?.first_name?.[0] || "") + (a.profile?.last_name?.[0] || "")}</span>
                        </div>
                        <span className="text-sm text-foreground">{a.profile ? `${a.profile.first_name} ${a.profile.last_name}` : "Unknown"}</span>
                        <Badge variant="secondary" className="text-[10px]">{a.role}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        {isAdminOrManager ? (
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground">$/hr</span>
                            <Input
                              type="number"
                              className="w-20 h-7 text-xs font-mono"
                              defaultValue={a.hourly_rate || ""}
                              placeholder="0"
                              onBlur={e => {
                                const val = parseFloat(e.target.value) || 0;
                                if (val !== (a.hourly_rate || 0)) handleUpdateRate(a.id, val);
                              }}
                            />
                          </div>
                        ) : (
                          a.hourly_rate > 0 && <Badge variant="outline" className="text-[10px] font-mono">${a.hourly_rate}/hr</Badge>
                        )}
                        {isAdminOrManager && <Button variant="ghost" size="sm" onClick={() => handleUnassign(a.id)}><X size={14} /></Button>}
                      </div>
                    </div>
                  ))}
                  {isAdminOrManager && (
                    <div className="flex gap-2 items-end">
                      <div className="flex-1">
                        <Select onValueChange={v => handleAssign(selectedProject.id, v)}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="+ Assign employee..." /></SelectTrigger>
                          <SelectContent>
                            {profiles.filter(p => !assignments.find(a => a.user_id === p.user_id)).map(p => (
                              <SelectItem key={p.user_id} value={p.user_id}>{p.first_name} {p.last_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Input type="number" placeholder="$/hr" className="w-20 h-8 text-xs" value={assignRate} onChange={e => setAssignRate(e.target.value)} />
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="hours" className="space-y-3 mt-3">
                  {/* Log new hours */}
                  <div className="p-3 rounded-lg border border-border space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase">Log Hours</p>
                    <div className="grid grid-cols-3 gap-2">
                      <Input type="number" placeholder="Hours *" value={timeForm.hours} onChange={e => setTimeForm({...timeForm, hours: e.target.value})} />
                      <Input type="date" value={timeForm.log_date} onChange={e => setTimeForm({...timeForm, log_date: e.target.value})} />
                      <Button onClick={handleLogTime} size="sm" className="gap-1"><Clock size={14} /> Log</Button>
                    </div>
                    <Input placeholder="Description (optional)" value={timeForm.description} onChange={e => setTimeForm({...timeForm, description: e.target.value})} />
                  </div>
                  {/* Time log list */}
                  {timeLogs.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">No hours logged yet</p> :
                    timeLogs.map(t => (
                      <div key={t.id} className="flex items-center justify-between p-2 rounded-lg bg-secondary/50 text-sm">
                        <div>
                          <span className="text-foreground font-medium">{getProfileName(t.user_id)}</span>
                          <span className="text-muted-foreground ml-2">— {new Date(t.log_date).toLocaleDateString()}</span>
                          {t.description && <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>}
                        </div>
                        <Badge variant="secondary" className="font-mono">{t.hours}h</Badge>
                      </div>
                    ))}
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
