import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Plus, Camera, Mic } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { toast } from "sonner";
import VoiceRecorder from "@/components/incidents/VoiceRecorder";
import IncidentReviewDialog from "@/components/incidents/IncidentReviewDialog";

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
  audio_url?: string;
  raw_transcript?: string;
  ai_draft?: string;
  is_ai_generated?: boolean;
  reviewed_by?: string;
  reviewed_at?: string;
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
  const [reportMode, setReportMode] = useState<"text" | "voice">("text");
  const [voiceData, setVoiceData] = useState<{ audioUrl: string; rawTranscript: string; aiDraft: string } | null>(null);

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
      const path = `incidents/${(await supabase.auth.getUser()).data.user?.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("field-photos").upload(path, file);
      if (!error) {
        urls.push(path);
      }
    }
    setPhotoUrls(prev => [...prev, ...urls]);
    setUploading(false);
  };

  const handleSubmit = async () => {
    if (!user || !form.site_id) { toast.error("Site is required"); return; }
    if (reportMode === "text" && !form.title) { toast.error("Title is required"); return; }

    const insertData: any = {
      user_id: user.id,
      site_id: form.site_id,
      title: reportMode === "voice" && voiceData ? form.title || "Voice Incident Report" : form.title,
      description: reportMode === "voice" && voiceData ? voiceData.aiDraft : form.description,
      severity: form.severity,
      photo_urls: photoUrls,
    };

    if (reportMode === "voice" && voiceData) {
      insertData.audio_url = voiceData.audioUrl;
      insertData.raw_transcript = voiceData.rawTranscript;
      insertData.ai_draft = voiceData.aiDraft;
      insertData.is_ai_generated = true;
    }

    const { error } = await supabase.from("incident_reports").insert(insertData);
    if (error) { toast.error("Failed to submit"); return; }
    toast.success("Incident reported");
    setShowAdd(false);
    setForm({ title: "", description: "", severity: "low", site_id: "" });
    setPhotoUrls([]);
    setVoiceData(null);
    setReportMode("text");
    fetchAll();
  };

  const handleVoiceGenerated = (data: { title: string; description: string; audioUrl: string; rawTranscript: string; aiDraft: string }) => {
    setForm(f => ({ ...f, title: data.title, description: data.description }));
    setVoiceData({ audioUrl: data.audioUrl, rawTranscript: data.rawTranscript, aiDraft: data.aiDraft });
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
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-foreground">{inc.title}</h3>
                      {(inc as any).is_ai_generated && (
                        <Badge variant="secondary" className="text-[10px] py-0">
                          <Mic size={8} className="mr-0.5" /> AI
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{getSiteName(inc.site_id)} · {getName(inc.user_id)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={severityColor(inc.severity) as any}>{inc.severity}</Badge>
                    <Badge variant={inc.status === "open" ? "destructive" : inc.status === "reviewed" ? "default" : "secondary"}>{inc.status}</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span>{new Date(inc.reported_at).toLocaleString()}</span>
                  {inc.photo_urls?.length > 0 && <span className="flex items-center gap-1"><Camera size={10} /> {inc.photo_urls.length} photos</span>}
                  {(inc as any).audio_url && <span className="flex items-center gap-1"><Mic size={10} /> Audio</span>}
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

            {/* Report mode tabs */}
            <Tabs value={reportMode} onValueChange={(v) => setReportMode(v as "text" | "voice")} className="w-full">
              <TabsList className="w-full">
                <TabsTrigger value="text" className="flex-1">✍️ Type Report</TabsTrigger>
                <TabsTrigger value="voice" className="flex-1"><Mic size={14} className="mr-1" /> Voice Report (AI)</TabsTrigger>
              </TabsList>
              <TabsContent value="text" className="space-y-3 mt-3">
                <Input placeholder="Incident Title *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                <Textarea placeholder="Description..." rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </TabsContent>
              <TabsContent value="voice" className="mt-3">
                {form.site_id ? (
                  <VoiceRecorder siteId={form.site_id} onReportGenerated={handleVoiceGenerated} />
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">Select a site first to enable voice recording</p>
                )}
                {voiceData && (
                  <div className="mt-3 space-y-2">
                    <Input placeholder="Report Title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                    <div className="bg-muted/40 rounded-lg p-3 text-xs text-foreground whitespace-pre-wrap max-h-40 overflow-y-auto">
                      {voiceData.aiDraft}
                    </div>
                    <p className="text-[10px] text-muted-foreground">✅ AI report generated — you can edit the title before submitting</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>

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
            <button
              onClick={handleSubmit}
              disabled={reportMode === "voice" && !voiceData}
              className="w-full px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Submit Report
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Incident Review Dialog */}
      <IncidentReviewDialog
        incident={selected}
        onClose={() => setSelected(null)}
        onUpdated={() => { fetchAll(); setSelected(null); }}
        getSiteName={getSiteName}
        getName={getName}
        severityColor={severityColor}
        isAdminOrManager={isAdminOrManager}
      />
    </motion.div>
  );
}
