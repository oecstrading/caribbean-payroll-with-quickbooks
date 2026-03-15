import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { UsersRound, Plus, UserPlus, X, FolderKanban } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import { toast } from "sonner";

interface Crew {
  id: string; name: string; lead_user_id: string | null; project_id: string | null; status: string;
}
interface CrewMember {
  id: string; crew_id: string; user_id: string;
}

export default function CrewsPage() {
  const { isAdminOrManager } = useRole();
  const [crews, setCrews] = useState<Crew[]>([]);
  const [members, setMembers] = useState<CrewMember[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedCrew, setSelectedCrew] = useState<Crew | null>(null);

  const [form, setForm] = useState({ name: "", lead_user_id: "", project_id: "" });

  const fetchAll = async () => {
    const [{ data: cr }, { data: cm }, { data: pf }, { data: pr }] = await Promise.all([
      supabase.from("crews").select("*").order("created_at", { ascending: false }),
      supabase.from("crew_members").select("*"),
      supabase.from("profiles").select("user_id, first_name, last_name"),
      supabase.from("projects").select("id, name"),
    ]);
    setCrews((cr as any[]) || []);
    setMembers((cm as any[]) || []);
    setProfiles(pf || []);
    setProjects((pr as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const handleCreate = async () => {
    if (!form.name.trim()) { toast.error("Crew name required"); return; }
    const { error } = await supabase.from("crews").insert({
      name: form.name, lead_user_id: form.lead_user_id || null, project_id: form.project_id || null,
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("Crew created");
    setShowAdd(false);
    setForm({ name: "", lead_user_id: "", project_id: "" });
    fetchAll();
  };

  const handleAddMember = async (crewId: string, userId: string) => {
    const { error } = await supabase.from("crew_members").insert({ crew_id: crewId, user_id: userId } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("Member added");
    fetchAll();
  };

  const handleRemoveMember = async (memberId: string) => {
    await supabase.from("crew_members").delete().eq("id", memberId);
    toast.success("Member removed");
    fetchAll();
  };

  const getProfile = (uid: string) => profiles.find(p => p.user_id === uid);
  const getCrewMembers = (crewId: string) => members.filter(m => m.crew_id === crewId);
  const getProjectName = (id: string | null) => id ? (projects.find(p => p.id === id)?.name || "—") : "Unassigned";

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4 md:space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-display font-bold text-foreground">Crew Management</h1>
          <p className="text-sm text-muted-foreground mt-1">Organize workers into crews and assign to projects</p>
        </div>
        {isAdminOrManager && <Button onClick={() => setShowAdd(true)} className="gap-2"><Plus size={16} /> New Crew</Button>}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[
          { label: "Total Crews", value: crews.length, icon: UsersRound, color: "text-primary", bg: "bg-primary/10" },
          { label: "Active", value: crews.filter(c => c.status === "active").length, icon: UsersRound, color: "text-success", bg: "bg-success/10" },
          { label: "Total Members", value: members.length, icon: UserPlus, color: "text-warning", bg: "bg-warning/10" },
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

      {/* Crew Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading ? <p className="col-span-full text-center text-muted-foreground py-12">Loading...</p> :
          crews.length === 0 ? <p className="col-span-full text-center text-muted-foreground py-12">No crews yet</p> :
          crews.map((crew, i) => {
            const crewMembers = getCrewMembers(crew.id);
            const lead = crew.lead_user_id ? getProfile(crew.lead_user_id) : null;
            return (
              <motion.div key={crew.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Card className="shadow-card border-border/60 cursor-pointer hover:border-primary/30 transition-colors"
                  onClick={() => setSelectedCrew(crew)}>
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-start justify-between">
                      <h3 className="font-display font-semibold text-foreground">{crew.name}</h3>
                      <Badge variant="secondary" className={crew.status === "active" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}>{crew.status}</Badge>
                    </div>
                    {lead && <p className="text-xs text-muted-foreground">Lead: <span className="text-foreground font-medium">{lead.first_name} {lead.last_name}</span></p>}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><UsersRound size={12} /> {crewMembers.length} members</span>
                      <span className="flex items-center gap-1"><FolderKanban size={12} /> {getProjectName(crew.project_id)}</span>
                    </div>
                    {/* Member avatars */}
                    <div className="flex -space-x-2">
                      {crewMembers.slice(0, 6).map(m => {
                        const p = getProfile(m.user_id);
                        return (
                          <div key={m.id} className="w-7 h-7 rounded-full bg-primary/10 border-2 border-background flex items-center justify-center" title={p ? `${p.first_name} ${p.last_name}` : ""}>
                            <span className="text-[9px] font-bold text-primary">{p ? (p.first_name?.[0] || "") + (p.last_name?.[0] || "") : "?"}</span>
                          </div>
                        );
                      })}
                      {crewMembers.length > 6 && <div className="w-7 h-7 rounded-full bg-muted border-2 border-background flex items-center justify-center"><span className="text-[9px] text-muted-foreground">+{crewMembers.length - 6}</span></div>}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
      </div>

      {/* Add Crew Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">New Crew</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Crew Name *" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
            <Select value={form.lead_user_id} onValueChange={v => setForm({...form, lead_user_id: v})}>
              <SelectTrigger><SelectValue placeholder="Crew Lead (optional)" /></SelectTrigger>
              <SelectContent>{profiles.map(p => <SelectItem key={p.user_id} value={p.user_id}>{p.first_name} {p.last_name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={form.project_id} onValueChange={v => setForm({...form, project_id: v})}>
              <SelectTrigger><SelectValue placeholder="Assign to project (optional)" /></SelectTrigger>
              <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
            <Button onClick={handleCreate} className="w-full">Create Crew</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Crew Detail Dialog */}
      <Dialog open={!!selectedCrew} onOpenChange={open => !open && setSelectedCrew(null)}>
        <DialogContent className="sm:max-w-lg">
          {selectedCrew && (() => {
            const crewMembers = getCrewMembers(selectedCrew.id);
            const lead = selectedCrew.lead_user_id ? getProfile(selectedCrew.lead_user_id) : null;
            return (
              <>
                <DialogHeader><DialogTitle className="font-display">{selectedCrew.name}</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-muted-foreground">Lead:</span> <span className="text-foreground">{lead ? `${lead.first_name} ${lead.last_name}` : "—"}</span></div>
                    <div><span className="text-muted-foreground">Project:</span> <span className="text-foreground">{getProjectName(selectedCrew.project_id)}</span></div>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-2">Members ({crewMembers.length})</h3>
                    <div className="space-y-2">
                      {crewMembers.map(m => {
                        const p = getProfile(m.user_id);
                        return (
                          <div key={m.id} className="flex items-center justify-between p-2 rounded-lg bg-secondary/50">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                                <span className="text-xs font-bold text-primary">{p ? (p.first_name?.[0] || "") + (p.last_name?.[0] || "") : "?"}</span>
                              </div>
                              <span className="text-sm text-foreground">{p ? `${p.first_name} ${p.last_name}` : "Unknown"}</span>
                            </div>
                            {isAdminOrManager && <Button variant="ghost" size="sm" onClick={() => handleRemoveMember(m.id)}><X size={14} /></Button>}
                          </div>
                        );
                      })}
                      {isAdminOrManager && (
                        <Select onValueChange={v => handleAddMember(selectedCrew.id, v)}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="+ Add member..." /></SelectTrigger>
                          <SelectContent>
                            {profiles.filter(p => !crewMembers.find(m => m.user_id === p.user_id)).map(p => (
                              <SelectItem key={p.user_id} value={p.user_id}>{p.first_name} {p.last_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
