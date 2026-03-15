import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { FolderKanban, Plus, Users, MapPin, Calendar, DollarSign, Search, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import { toast } from "sonner";

interface Project {
  id: string;
  name: string;
  client_name: string;
  address: string;
  status: string;
  start_date: string;
  end_date: string | null;
  budget: number;
  description: string;
}

interface Assignment {
  id: string;
  project_id: string;
  user_id: string;
  role: string;
  hourly_rate: number;
  profile?: { first_name: string; last_name: string };
}

export default function ProjectsPage() {
  const { isAdminOrManager } = useRole();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [profiles, setProfiles] = useState<{ id: string; user_id: string; first_name: string; last_name: string }[]>([]);

  // Form state
  const [form, setForm] = useState({ name: "", client_name: "", address: "", description: "", budget: "", start_date: "", end_date: "" });

  const fetchProjects = async () => {
    const { data } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
    setProjects((data as any[]) || []);
    setLoading(false);
  };

  const fetchProfiles = async () => {
    const { data } = await supabase.from("profiles").select("id, user_id, first_name, last_name");
    setProfiles(data || []);
  };

  useEffect(() => { fetchProjects(); fetchProfiles(); }, []);

  const fetchAssignments = async (projectId: string) => {
    const { data } = await supabase.from("project_assignments").select("*").eq("project_id", projectId);
    const mapped = ((data as any[]) || []).map((a: any) => {
      const profile = profiles.find(p => p.user_id === a.user_id);
      return { ...a, profile };
    });
    setAssignments(mapped);
  };

  useEffect(() => {
    if (selectedProject) fetchAssignments(selectedProject.id);
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

  const handleAssign = async (projectId: string, userId: string) => {
    const { error } = await supabase.from("project_assignments").insert({ project_id: projectId, user_id: userId } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("Employee assigned");
    fetchAssignments(projectId);
  };

  const handleUnassign = async (assignmentId: string) => {
    await supabase.from("project_assignments").delete().eq("id", assignmentId);
    if (selectedProject) fetchAssignments(selectedProject.id);
    toast.success("Employee removed");
  };

  const handleStatusChange = async (projectId: string, status: string) => {
    await supabase.from("projects").update({ status } as any).eq("id", projectId);
    fetchProjects();
    toast.success("Status updated");
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

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4 md:space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-display font-bold text-foreground">Projects & Job Sites</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage jobs, assign crews, and track labor costs</p>
        </div>
        {isAdminOrManager && (
          <Button onClick={() => setShowAdd(true)} className="gap-2"><Plus size={16} /> New Project</Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Projects", value: stats.total, icon: FolderKanban, color: "text-primary", bg: "bg-primary/10" },
          { label: "Active", value: stats.active, icon: Calendar, color: "text-success", bg: "bg-success/10" },
          { label: "Completed", value: stats.completed, icon: MapPin, color: "text-muted-foreground", bg: "bg-secondary" },
          { label: "Total Budget", value: `$${stats.totalBudget.toLocaleString()}`, icon: DollarSign, color: "text-warning", bg: "bg-warning/10" },
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

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search projects..." className="pl-9" />
        </div>
        {["active", "completed", "on-hold"].map(s => (
          <Button key={s} variant={statusFilter === s ? "default" : "outline"} size="sm"
            onClick={() => setStatusFilter(statusFilter === s ? null : s)} className="capitalize">{s}</Button>
        ))}
      </div>

      {/* Project Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading ? <p className="col-span-full text-center text-muted-foreground py-12">Loading...</p> :
          filtered.length === 0 ? <p className="col-span-full text-center text-muted-foreground py-12">No projects found</p> :
          filtered.map((project, i) => (
            <motion.div key={project.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="shadow-card border-border/60 cursor-pointer hover:border-primary/30 transition-colors"
                onClick={() => setSelectedProject(project)}>
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between">
                    <h3 className="font-display font-semibold text-foreground">{project.name}</h3>
                    <Badge variant="secondary" className={
                      project.status === "active" ? "bg-success/10 text-success" :
                      project.status === "completed" ? "bg-muted text-muted-foreground" :
                      "bg-warning/10 text-warning"
                    }>{project.status}</Badge>
                  </div>
                  {project.client_name && <p className="text-sm text-muted-foreground">Client: {project.client_name}</p>}
                  {project.address && <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin size={12} />{project.address}</p>}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Budget: ${(project.budget || 0).toLocaleString()}</span>
                    {project.start_date && <span>{new Date(project.start_date).toLocaleDateString()}</span>}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
      </div>

      {/* Add Project Dialog */}
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

      {/* Project Detail Dialog */}
      <Dialog open={!!selectedProject} onOpenChange={open => !open && setSelectedProject(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          {selectedProject && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display">{selectedProject.name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
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

                {/* Assigned Workers */}
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2"><Users size={14} /> Assigned Workers ({assignments.length})</h3>
                  <div className="space-y-2">
                    {assignments.map(a => (
                      <div key={a.id} className="flex items-center justify-between p-2 rounded-lg bg-secondary/50">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-xs font-bold text-primary">{(a.profile?.first_name?.[0] || "") + (a.profile?.last_name?.[0] || "")}</span>
                          </div>
                          <span className="text-sm text-foreground">{a.profile ? `${a.profile.first_name} ${a.profile.last_name}` : "Unknown"}</span>
                          <Badge variant="secondary" className="text-[10px]">{a.role}</Badge>
                        </div>
                        {isAdminOrManager && (
                          <Button variant="ghost" size="sm" onClick={() => handleUnassign(a.id)}><X size={14} /></Button>
                        )}
                      </div>
                    ))}
                    {isAdminOrManager && (
                      <Select onValueChange={v => handleAssign(selectedProject.id, v)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="+ Assign employee..." /></SelectTrigger>
                        <SelectContent>
                          {profiles.filter(p => !assignments.find(a => a.user_id === p.user_id)).map(p => (
                            <SelectItem key={p.user_id} value={p.user_id}>{p.first_name} {p.last_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
