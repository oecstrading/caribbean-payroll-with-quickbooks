import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Plus, Camera, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { toast } from "sonner";

interface Incident {
  id: string;
  user_id: string;
  site_id: string;
  title: string;
  description: string;
  severity: string;
  photo_urls: string[];
  status: string;
  reported_at: string;
}

export default function IncidentReportsPage() {
  const { user } = useAuth();
  const { isAdminOrManager } = useRole();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState<Incident | null>(null);
  const [form, setForm] = useState({ title: "", description: "", severity: "low", site_id: "" });
  const [uploading, setUploading] = useState(false);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);

  const fetchAll = async () => {
    const [incRes, siteRes, profRes] = await Promise.all([
      supabase.from("incident_reports").select("*").order("reported_at", { ascending: false }),
      supabase.from("client_sites").select("id, name"),
      supabase.from("profiles").select("user_id, first_name, last_name"),
    ]);
    setIncidents(incRes.data || []);
    setSites(siteRes.data || []);
    setProfiles(profRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    const urls: string[] = [];
    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop();
      const path = `incidents/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("field-photos").upload(path, file);
      if (!error) {
        const { data } = supabase.storage.from("field-photos").getPublicUrl(path);
        urls.push(data.publicUrl);
      }
    }
    setPhotoUrls(prev => [...prev, ...urls]);
    setUploading(false);
  };

  const handleSubmit = async () => {
    if (!user || !form.title || !form.site_id) { toast.error("Title and site are required"); return; }
    const { error } = await supabase.from("incident_reports").insert({
      user_id: user.id,
      site_id: form.site_id,
      title: form.title,
      description: form.description,
      severity: form.severity,
      photo_urls: photoUrls,
    });
    if (error) { toast.error("Failed to submit"); return; }
    toast.success("Incident reported");
    setShowAdd(false);
    setForm({ title: "", description: "", severity: "low", site_id: "" });
    setPhotoUrls([]);
    fetchAll();
  };

  const getName = (uid: string) => {
    const p = profiles.find(p => p.user_id === uid);
    return p ? `${p.first_name} ${p.last_name}` : "Unknown";
  };
  const getSiteName = (sid: string) => sites.find(s => s.id === sid)?.name || "Unknown";

  const severityColor = (s: string) => s === "critical" ? "destructive" : s === "high" ? "destructive" : s === "medium" ? "secondary" : "outline";

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading...</div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Incident Reports</h1>
          <p className="text-sm text-muted-foreground">Report and track security incidents at client sites</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus size={16} /> Report Incident
        </button>
      </div>

      {incidents.length === 0 ? (
        <Card className="shadow-card border-border/60">
          <CardContent className="p-12 text-center">
            <AlertTriangle size={48} className="mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-display font-semibold mb-2">No Incidents</h3>
            <p className="text-sm text-muted-foreground">No incidents have been reported.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {incidents.map(inc => (
            <Card key={inc.id} className="shadow-card border-border/60 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelected(inc)}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium text-foreground">{inc.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{getSiteName(inc.site_id)} · {getName(inc.user_id)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={severityColor(inc.severity) as any}>{inc.severity}</Badge>
                    <Badge variant={inc.status === "open" ? "destructive" : "default"}>{inc.status}</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span>{new Date(inc.reported_at).toLocaleString()}</span>
                  {inc.photo_urls?.length > 0 && <span className="flex items-center gap-1"><Camera size={10} /> {inc.photo_urls.length} photos</span>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Incident Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Report Incident</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <select value={form.site_id} onChange={e => setForm(f => ({ ...f, site_id: e.target.value }))} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="">Select site *</option>
              {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <Input placeholder="Incident Title *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            <Textarea placeholder="Description..." rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            <select value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Attach Photos</label>
              <input type="file" accept="image/*" multiple onChange={handlePhotoUpload} className="text-sm" />
              {uploading && <p className="text-xs text-muted-foreground mt-1">Uploading...</p>}
              {photoUrls.length > 0 && (
                <div className="flex gap-2 mt-2 flex-wrap">
                  {photoUrls.map((url, i) => (
                    <img key={i} src={url} alt="incident" className="w-16 h-16 object-cover rounded-lg border" />
                  ))}
                </div>
              )}
            </div>
            <button onClick={handleSubmit} className="w-full px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
              Submit Report
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Incident Detail */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="sm:max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display">{selected.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 mt-2 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div><span className="text-muted-foreground">Site:</span> <span className="font-medium">{getSiteName(selected.site_id)}</span></div>
                  <div><span className="text-muted-foreground">Reported by:</span> <span className="font-medium">{getName(selected.user_id)}</span></div>
                  <div><span className="text-muted-foreground">Severity:</span> <Badge variant={severityColor(selected.severity) as any}>{selected.severity}</Badge></div>
                  <div><span className="text-muted-foreground">Status:</span> <Badge variant={selected.status === "open" ? "destructive" : "default"}>{selected.status}</Badge></div>
                </div>
                {selected.description && <p className="text-foreground whitespace-pre-wrap">{selected.description}</p>}
                {selected.photo_urls?.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {selected.photo_urls.map((url, i) => (
                      <img key={i} src={url} alt="evidence" className="w-full h-32 object-cover rounded-lg border" />
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">{new Date(selected.reported_at).toLocaleString()}</p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
