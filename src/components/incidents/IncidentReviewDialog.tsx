import { useState } from "react";
import { FileText, Mic, Edit3, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { downloadPDF } from "@/lib/export-utils";
import PrivateMedia from "@/components/PrivateMedia";

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

interface Props {
  incident: Incident | null;
  onClose: () => void;
  onUpdated: () => void;
  getSiteName: (id: string) => string;
  getName: (id: string) => string;
  severityColor: (s: string) => string;
  isAdminOrManager: boolean;
}

export default function IncidentReviewDialog({ incident, onClose, onUpdated, getSiteName, getName, severityColor, isAdminOrManager }: Props) {
  const { user } = useAuth();
  const [editedReport, setEditedReport] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!incident) return null;

  const startEdit = () => {
    setEditedReport(incident.description || incident.ai_draft || "");
    setEditing(true);
  };

  const saveEdit = async () => {
    setSaving(true);
    const { error } = await supabase.from("incident_reports").update({
      description: editedReport,
      reviewed_by: user?.id,
      reviewed_at: new Date().toISOString(),
      status: "reviewed",
    }).eq("id", incident.id);
    setSaving(false);
    if (error) { toast.error("Failed to save"); return; }
    toast.success("Report reviewed and saved");
    setEditing(false);
    onUpdated();
  };

  const exportPDF = () => {
    downloadPDF(
      `incident-${incident.id.slice(0, 8)}`,
      incident.title,
      ["Field", "Details"],
      [
        ["Site", getSiteName(incident.site_id)],
        ["Reported By", getName(incident.user_id)],
        ["Severity", incident.severity],
        ["Status", incident.status],
        ["Date", new Date(incident.reported_at).toLocaleString()],
        ["Report", incident.description || "N/A"],
      ],
      { orientation: "portrait", subtitle: `Incident Report — ${new Date(incident.reported_at).toLocaleDateString()}` }
    );
    toast.success("PDF exported");
  };

  const hasAI = incident.is_ai_generated && incident.raw_transcript;

  return (
    <Dialog open={!!incident} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle className="font-display">{incident.title}</DialogTitle>
            {incident.is_ai_generated && (
              <Badge variant="secondary" className="text-[10px]">
                <Mic size={10} className="mr-1" /> AI Voice Report
              </Badge>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-4 mt-2 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div><span className="text-muted-foreground">Site:</span> <span className="font-medium">{getSiteName(incident.site_id)}</span></div>
            <div><span className="text-muted-foreground">Reported by:</span> <span className="font-medium">{getName(incident.user_id)}</span></div>
            <div><span className="text-muted-foreground">Severity:</span> <Badge variant={severityColor(incident.severity) as any}>{incident.severity}</Badge></div>
            <div><span className="text-muted-foreground">Status:</span> <Badge variant={incident.status === "open" ? "destructive" : incident.status === "reviewed" ? "default" : "secondary"}>{incident.status}</Badge></div>
          </div>

          {incident.audio_url && (
            <div>
              <label className="text-xs text-muted-foreground font-medium block mb-1">Audio Recording</label>
              <PrivateMedia bucket="incident-audio" stored={incident.audio_url} audio className="w-full h-8" />
            </div>
          )}

          {hasAI ? (
            <Tabs defaultValue="report" className="w-full">
              <TabsList className="w-full">
                <TabsTrigger value="report" className="flex-1"><FileText size={12} className="mr-1" /> AI Report</TabsTrigger>
                <TabsTrigger value="transcript" className="flex-1"><Mic size={12} className="mr-1" /> Raw Transcript</TabsTrigger>
              </TabsList>
              <TabsContent value="report" className="mt-3">
                {editing ? (
                  <div className="space-y-2">
                    <Textarea value={editedReport} onChange={e => setEditedReport(e.target.value)} rows={10} className="text-sm" />
                    <div className="flex gap-2">
                      <button onClick={saveEdit} disabled={saving} className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-medium hover:bg-primary/90">
                        <Check size={12} /> {saving ? "Saving..." : "Save & Mark Reviewed"}
                      </button>
                      <button onClick={() => setEditing(false)} className="px-3 py-1.5 border border-input rounded-md text-xs hover:bg-muted">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-muted/40 rounded-lg p-4 whitespace-pre-wrap text-foreground">{incident.description || incident.ai_draft}</div>
                )}
              </TabsContent>
              <TabsContent value="transcript" className="mt-3">
                <div className="bg-muted/40 rounded-lg p-4 whitespace-pre-wrap text-muted-foreground italic">"{incident.raw_transcript}"</div>
              </TabsContent>
            </Tabs>
          ) : (
            <>
              {editing ? (
                <div className="space-y-2">
                  <Textarea value={editedReport} onChange={e => setEditedReport(e.target.value)} rows={6} className="text-sm" />
                  <div className="flex gap-2">
                    <button onClick={saveEdit} disabled={saving} className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-medium hover:bg-primary/90">
                      <Check size={12} /> {saving ? "Saving..." : "Save"}
                    </button>
                    <button onClick={() => setEditing(false)} className="px-3 py-1.5 border border-input rounded-md text-xs hover:bg-muted">Cancel</button>
                  </div>
                </div>
              ) : (
                incident.description && <p className="text-foreground whitespace-pre-wrap">{incident.description}</p>
              )}
            </>
          )}

          {incident.photo_urls?.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {incident.photo_urls.map((url, i) => (
                <PrivateMedia key={i} bucket="field-photos" stored={url} alt="evidence" className="w-full h-32 object-cover rounded-lg border" />
              ))}
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground">{new Date(incident.reported_at).toLocaleString()}</p>
            {isAdminOrManager && (
              <div className="flex gap-2">
                {!editing && (
                  <button onClick={startEdit} className="flex items-center gap-1 px-3 py-1.5 border border-input rounded-md text-xs hover:bg-muted">
                    <Edit3 size={12} /> Edit
                  </button>
                )}
                <button onClick={exportPDF} className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-medium hover:bg-primary/90">
                  <FileText size={12} /> Export PDF
                </button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
