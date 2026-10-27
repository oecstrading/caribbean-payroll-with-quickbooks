import { useEffect, useState } from "react";
import { UserPlus, Search, Upload, FileCheck, Eye, Trash2, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { privateFileUrl } from "@/lib/private-storage";

interface Applicant {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  status: string;
  applied_date: string;
  desired_position: string;
  experience_years: number;
  notes: string;
  jurisdiction: string;
}

interface ApplicantDoc {
  id: string;
  applicant_id: string;
  document_type: string;
  file_url: string;
  file_name: string;
  verified: boolean;
  expiry_date: string | null;
}

const statusColors: Record<string, string> = {
  applied: "bg-blue-500/10 text-blue-600 border-blue-200",
  screening: "bg-yellow-500/10 text-yellow-600 border-yellow-200",
  interview: "bg-purple-500/10 text-purple-600 border-purple-200",
  offer: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
  hired: "bg-green-500/10 text-green-700 border-green-200",
  rejected: "bg-red-500/10 text-red-600 border-red-200",
};

const statusFlow = ["applied", "screening", "interview", "offer", "hired"];

export default function ApplicantTrackingPage() {
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [selectedApplicant, setSelectedApplicant] = useState<Applicant | null>(null);
  const [docs, setDocs] = useState<ApplicantDoc[]>([]);
  const [form, setForm] = useState({
    first_name: "", last_name: "", email: "", phone: "",
    desired_position: "security_guard", experience_years: 0,
    notes: "", jurisdiction: "LC",
  });

  const fetchApplicants = async () => {
    const { data } = await supabase
      .from("applicants")
      .select("*")
      .order("applied_date", { ascending: false });
    setApplicants((data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchApplicants(); }, []);

  const fetchDocs = async (applicantId: string) => {
    const { data } = await supabase
      .from("applicant_documents")
      .select("*")
      .eq("applicant_id", applicantId);
    setDocs((data as any[]) || []);
  };

  const handleAdd = async () => {
    if (!form.first_name || !form.last_name || !form.email) {
      toast.error("Name and email are required");
      return;
    }
    const { error } = await supabase.from("applicants").insert(form as any);
    if (error) { toast.error("Failed to add applicant"); return; }
    toast.success("Applicant added");
    setShowAdd(false);
    setForm({ first_name: "", last_name: "", email: "", phone: "", desired_position: "security_guard", experience_years: 0, notes: "", jurisdiction: "LC" });
    fetchApplicants();
  };

  const updateStatus = async (id: string, newStatus: string) => {
    const { error } = await supabase.from("applicants").update({ status: newStatus } as any).eq("id", id);
    if (error) { toast.error("Failed to update status"); return; }
    toast.success(`Status updated to ${newStatus}`);
    fetchApplicants();
    if (selectedApplicant?.id === id) {
      setSelectedApplicant({ ...selectedApplicant, status: newStatus });
    }
  };

  const handleDocUpload = async (applicantId: string, file: File, docType: string) => {
    const filePath = `${applicantId}/${Date.now()}-${file.name}`;
    const { error: uploadErr } = await supabase.storage.from("applicant-docs").upload(filePath, file);
    if (uploadErr) { toast.error("Upload failed"); return; }
    await supabase.from("applicant_documents").insert({
      applicant_id: applicantId,
      document_type: docType,
      file_url: filePath,
      file_name: file.name,
    } as any);
    toast.success("Document uploaded");
    fetchDocs(applicantId);
  };

  const filtered = applicants.filter((a) => {
    if (filterStatus !== "all" && a.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      return `${a.first_name} ${a.last_name} ${a.email}`.toLowerCase().includes(q);
    }
    return true;
  });

  const stats = {
    total: applicants.length,
    applied: applicants.filter(a => a.status === "applied").length,
    screening: applicants.filter(a => a.status === "screening").length,
    interview: applicants.filter(a => a.status === "interview").length,
    hired: applicants.filter(a => a.status === "hired").length,
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Applicant Tracking</h1>
          <p className="text-sm text-muted-foreground">Manage recruitment pipeline and candidate credentials</p>
        </div>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild>
            <Button><UserPlus size={16} className="mr-2" />Add Applicant</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader><DialogTitle>New Applicant</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>First Name *</Label>
                <Input value={form.first_name} onChange={e => setForm({...form, first_name: e.target.value})} />
              </div>
              <div>
                <Label>Last Name *</Label>
                <Input value={form.last_name} onChange={e => setForm({...form, last_name: e.target.value})} />
              </div>
              <div>
                <Label>Email *</Label>
                <Input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
              </div>
              <div>
                <Label>Position</Label>
                <Select value={form.desired_position} onValueChange={v => setForm({...form, desired_position: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="security_guard">Security Guard</SelectItem>
                    <SelectItem value="supervisor">Supervisor</SelectItem>
                    <SelectItem value="patrol_officer">Patrol Officer</SelectItem>
                    <SelectItem value="armed_guard">Armed Guard</SelectItem>
                    <SelectItem value="control_room">Control Room Operator</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Experience (years)</Label>
                <Input type="number" value={form.experience_years} onChange={e => setForm({...form, experience_years: parseInt(e.target.value) || 0})} />
              </div>
              <div className="col-span-2">
                <Label>Jurisdiction</Label>
                <Select value={form.jurisdiction} onValueChange={v => setForm({...form, jurisdiction: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LC">St. Lucia</SelectItem>
                    <SelectItem value="AG">Antigua & Barbuda</SelectItem>
                    <SelectItem value="DM">Dominica</SelectItem>
                    <SelectItem value="GD">Grenada</SelectItem>
                    <SelectItem value="KN">St. Kitts & Nevis</SelectItem>
                    <SelectItem value="VC">St. Vincent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2} />
              </div>
            </div>
            <Button onClick={handleAdd} className="w-full mt-2">Add Applicant</Button>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total", value: stats.total, color: "text-foreground" },
          { label: "Applied", value: stats.applied, color: "text-blue-600" },
          { label: "Screening", value: stats.screening, color: "text-yellow-600" },
          { label: "Interview", value: stats.interview, color: "text-purple-600" },
          { label: "Hired", value: stats.hired, color: "text-green-600" },
        ].map(s => (
          <Card key={s.label} className="shadow-card border-border/60">
            <CardContent className="p-4 text-center">
              <p className={`text-2xl font-display font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search applicants..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="applied">Applied</SelectItem>
            <SelectItem value="screening">Screening</SelectItem>
            <SelectItem value="interview">Interview</SelectItem>
            <SelectItem value="offer">Offer</SelectItem>
            <SelectItem value="hired">Hired</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="shadow-card border-border/60">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Name</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden sm:table-cell">Position</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden md:table-cell">Jurisdiction</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden md:table-cell">Applied</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => (
                <tr key={a.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="py-3 px-4">
                    <p className="font-medium text-foreground">{a.first_name} {a.last_name}</p>
                    <p className="text-xs text-muted-foreground">{a.email}</p>
                  </td>
                  <td className="py-3 px-4 hidden sm:table-cell capitalize text-muted-foreground">
                    {a.desired_position.replace(/_/g, " ")}
                  </td>
                  <td className="py-3 px-4 hidden md:table-cell text-muted-foreground">{a.jurisdiction}</td>
                  <td className="py-3 px-4">
                    <Badge variant="outline" className={statusColors[a.status] || ""}>{a.status}</Badge>
                  </td>
                  <td className="py-3 px-4 hidden md:table-cell text-muted-foreground">{a.applied_date}</td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => { setSelectedApplicant(a); fetchDocs(a.id); }}>
                        <Eye size={14} />
                      </Button>
                      {a.status !== "hired" && a.status !== "rejected" && (
                        <Select onValueChange={v => updateStatus(a.id, v)}>
                          <SelectTrigger className="h-7 w-7 p-0 border-0"><ChevronDown size={14} /></SelectTrigger>
                          <SelectContent>
                            {statusFlow.filter(s => s !== a.status).map(s => (
                              <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                            ))}
                            <SelectItem value="rejected" className="text-destructive">Reject</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="py-12 text-center text-muted-foreground">No applicants found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Detail dialog */}
      <Dialog open={!!selectedApplicant} onOpenChange={open => !open && setSelectedApplicant(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          {selectedApplicant && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display">
                  {selectedApplicant.first_name} {selectedApplicant.last_name}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Email:</span> <span className="text-foreground">{selectedApplicant.email}</span></div>
                  <div><span className="text-muted-foreground">Phone:</span> <span className="text-foreground">{selectedApplicant.phone || "—"}</span></div>
                  <div><span className="text-muted-foreground">Position:</span> <span className="text-foreground capitalize">{selectedApplicant.desired_position.replace(/_/g, " ")}</span></div>
                  <div><span className="text-muted-foreground">Experience:</span> <span className="text-foreground">{selectedApplicant.experience_years} years</span></div>
                  <div><span className="text-muted-foreground">Status:</span> <Badge variant="outline" className={statusColors[selectedApplicant.status]}>{selectedApplicant.status}</Badge></div>
                  <div><span className="text-muted-foreground">Jurisdiction:</span> <span className="text-foreground">{selectedApplicant.jurisdiction}</span></div>
                </div>
                {selectedApplicant.notes && (
                  <div><p className="text-xs text-muted-foreground mb-1">Notes:</p><p className="text-sm text-foreground">{selectedApplicant.notes}</p></div>
                )}

                {/* Documents */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-foreground">Documents & Credentials</h3>
                    <label className="cursor-pointer">
                      <input type="file" className="hidden" onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) handleDocUpload(selectedApplicant.id, file, "certificate");
                      }} />
                      <Button size="sm" variant="outline" asChild><span><Upload size={14} className="mr-1" />Upload</span></Button>
                    </label>
                  </div>
                  {docs.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No documents uploaded yet</p>
                  ) : (
                    <div className="space-y-2">
                      {docs.map(d => (
                        <div key={d.id} className="flex items-center justify-between p-2 rounded-lg bg-secondary/50 text-sm">
                          <div className="flex items-center gap-2">
                            <FileCheck size={16} className={d.verified ? "text-green-600" : "text-muted-foreground"} />
                            <span className="text-foreground">{d.file_name}</span>
                            <Badge variant="outline" className="text-[10px]">{d.document_type}</Badge>
                          </div>
                          <Button variant="ghost" size="sm" onClick={async () => { try { const url = await privateFileUrl("applicant-docs", d.file_url); const a = document.createElement("a"); a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer"; a.click(); } catch { toast.error("Unable to open this document"); } }}>View</Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Status actions */}
                {selectedApplicant.status !== "hired" && selectedApplicant.status !== "rejected" && (
                  <div className="flex gap-2 pt-2 border-t border-border">
                    {statusFlow.filter(s => s !== selectedApplicant.status).map(s => (
                      <Button key={s} size="sm" variant="outline" className="capitalize" onClick={() => updateStatus(selectedApplicant.id, s)}>
                        Move to {s}
                      </Button>
                    ))}
                    <Button size="sm" variant="destructive" onClick={() => updateStatus(selectedApplicant.id, "rejected")}>
                      Reject
                    </Button>
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
