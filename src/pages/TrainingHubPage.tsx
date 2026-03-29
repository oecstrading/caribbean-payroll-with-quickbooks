import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { BookOpen, Upload, Download, Trash2, FileText, Search, Filter, Sparkles } from "lucide-react";
import { format } from "date-fns";

const CATEGORIES = [
  { value: "training", label: "Training Material" },
  { value: "policy", label: "Company Policy" },
  { value: "sop", label: "Standard Operating Procedure" },
  { value: "manual", label: "User Manual" },
  { value: "marketing", label: "Marketing" },
  { value: "general", label: "General" },
];

export default function TrainingHubPage() {
  const { isAdminOrManager } = useRole();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [uploadForm, setUploadForm] = useState({ title: "", description: "", category: "general" });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["training-documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_documents")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (doc: { id: string; file_name: string }) => {
      await supabase.storage.from("training-docs").remove([doc.file_name]);
      const { error } = await supabase.from("training_documents").delete().eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training-documents"] });
      toast.success("Document deleted");
    },
    onError: () => toast.error("Failed to delete document"),
  });

  const handleUpload = async () => {
    if (!selectedFile || !uploadForm.title) {
      toast.error("Please provide a title and select a file");
      return;
    }
    setUploading(true);
    try {
      const fileName = `${Date.now()}_${selectedFile.name}`;
      const { error: storageError } = await supabase.storage
        .from("training-docs")
        .upload(fileName, selectedFile);
      if (storageError) throw storageError;

      const { data: urlData } = supabase.storage
        .from("training-docs")
        .getPublicUrl(fileName);

      const { error } = await supabase.from("training_documents").insert({
        title: uploadForm.title,
        description: uploadForm.description,
        category: uploadForm.category,
        file_name: fileName,
        file_url: urlData.publicUrl,
        file_size: selectedFile.size,
        uploaded_by: user?.id,
      });
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["training-documents"] });
      toast.success("Document uploaded successfully");
      setUploadOpen(false);
      setUploadForm({ title: "", description: "", category: "general" });
      setSelectedFile(null);
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const SEED_DOCS = [
    {
      title: "OECS Security Platform – Marketing Flyer",
      description: "18-module marketing flyer showcasing all platform capabilities for client presentations",
      category: "marketing",
      content: `OECS HR & PAYROLL — SECURITY MANAGEMENT PLATFORM\n\nThe Caribbean's Most Complete Security Workforce Solution\n\n18 CORE MODULES:\n1. Smart Scheduling & Roster Management\n2. GPS Clock-In with Geofencing\n3. Real-Time Guard Tracking\n4. Panic Button & Emergency Alerts\n5. Voice-Powered Incident Reporting (AI)\n6. Guard Tour & Patrol Verification\n7. Late Clock-In Detection & Alerts\n8. Client Portal with Live Updates\n9. Automated Client Invoicing\n10. Multi-Island Payroll Engine\n11. Leave Management\n12. Applicant Tracking & Onboarding\n13. Compliance & License Tracking\n14. Equipment Management\n15. Daily Activity Reports\n16. Training Hub & Document Center\n17. Voice Commands & Navigation\n18. Management Analytics & KPIs\n\nBuilt for the OECS region — supporting XCD payroll, NIC calculations, and multi-jurisdiction compliance across St. Lucia, Antigua, Grenada, Dominica, St. Kitts & Nevis, and St. Vincent.\n\nContact us today for a demo!`,
    },
    {
      title: "OECS Security Platform – User Manual",
      description: "Comprehensive 12-section user manual covering all platform features and workflows",
      category: "manual",
      content: `OECS HR & PAYROLL — USER MANUAL\nVersion 2.0\n\nTABLE OF CONTENTS\n\n1. GETTING STARTED\n   - Account setup and first login\n   - Dashboard overview and navigation\n   - Role-based access (Admin, Manager, Guard)\n\n2. EMPLOYEE MANAGEMENT\n   - Adding employees and profiles\n   - CSV bulk import\n   - Salary and jurisdiction setup\n\n3. SCHEDULING & ROSTER\n   - Creating weekly rosters\n   - Assigning guards to client sites\n   - Shift templates and recurring schedules\n\n4. TIME & ATTENDANCE\n   - GPS clock-in/clock-out\n   - Geofence verification\n   - Late clock-in detection and alerts\n\n5. GUARD OPERATIONS\n   - Guard tour and patrol logging\n   - Checkpoint scanning\n   - Voice-activated reporting\n\n6. INCIDENT MANAGEMENT\n   - Filing incident reports (text & voice)\n   - AI-powered report generation\n   - Photo and audio attachments\n\n7. EMERGENCY RESPONSE\n   - Panic button activation\n   - Real-time manager notifications\n   - Resolution tracking\n\n8. PAYROLL\n   - Running payroll calculations\n   - NIC and PAYE deductions\n   - Payslip generation and email delivery\n\n9. CLIENT MANAGEMENT\n   - Site setup with GPS coordinates\n   - Client portal access codes\n   - Automated invoicing\n\n10. COMPLIANCE\n    - Guard license tracking\n    - Expiry alerts and renewals\n    - Applicant document verification\n\n11. REPORTS & ANALYTICS\n    - Late clock-in trend reports\n    - Guard performance metrics\n    - Exportable PDF reports\n\n12. TRAINING HUB\n    - Uploading company documents\n    - Category management\n    - Document search and filtering\n\nFor support, contact your system administrator.`,
    },
  ];

  const handleSeedDocuments = async () => {
    setSeeding(true);
    try {
      let seededCount = 0;
      for (const doc of SEED_DOCS) {
        // Check if already seeded
        const { data: existing } = await supabase
          .from("training_documents")
          .select("id")
          .eq("title", doc.title)
          .maybeSingle();
        if (existing) continue;

        const blob = new Blob([doc.content], { type: "text/plain" });
        const fileName = `${Date.now()}_${doc.title.replace(/[^a-zA-Z0-9]/g, "_")}.txt`;

        const { error: storageError } = await supabase.storage
          .from("training-docs")
          .upload(fileName, blob);
        if (storageError) throw storageError;

        const { data: urlData } = supabase.storage
          .from("training-docs")
          .getPublicUrl(fileName);

        const { error } = await supabase.from("training_documents").insert({
          title: doc.title,
          description: doc.description,
          category: doc.category,
          file_name: fileName,
          file_url: urlData.publicUrl,
          file_size: blob.size,
          uploaded_by: user?.id,
        });
        if (error) throw error;
        seededCount++;
      }

      queryClient.invalidateQueries({ queryKey: ["training-documents"] });
      if (seededCount > 0) {
        toast.success(`${seededCount} default document(s) seeded successfully`);
      } else {
        toast.info("Default documents already exist");
      }
    } catch (err: any) {
      toast.error(err.message || "Seeding failed");
    } finally {
      setSeeding(false);
    }
  };

  const filtered = documents.filter((doc: any) => {
    const matchesSearch = doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === "all" || doc.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const categoryLabel = (val: string) => CATEGORIES.find(c => c.value === val)?.label || val;
  const categoryColor = (val: string) => {
    const colors: Record<string, string> = {
      training: "bg-blue-100 text-blue-800",
      policy: "bg-purple-100 text-purple-800",
      sop: "bg-green-100 text-green-800",
      manual: "bg-orange-100 text-orange-800",
      marketing: "bg-pink-100 text-pink-800",
      general: "bg-gray-100 text-gray-800",
    };
    return colors[val] || colors.general;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" /> Training Hub
          </h1>
          <p className="text-muted-foreground text-sm">Company documents, SOPs, training materials & policies</p>
        </div>
        {isAdminOrManager && (
          <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
            <DialogTrigger asChild>
              <Button><Upload className="h-4 w-4 mr-2" /> Upload Document</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload Document</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Title *</Label>
                  <Input value={uploadForm.title} onChange={e => setUploadForm(f => ({ ...f, title: e.target.value }))} placeholder="Document title" />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea value={uploadForm.description} onChange={e => setUploadForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief description" rows={2} />
                </div>
                <div>
                  <Label>Category</Label>
                  <Select value={uploadForm.category} onValueChange={v => setUploadForm(f => ({ ...f, category: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>File *</Label>
                  <Input type="file" onChange={e => setSelectedFile(e.target.files?.[0] || null)} accept=".pdf,.docx,.doc,.xlsx,.xls,.pptx,.ppt,.txt,.csv,.jpg,.png" />
                </div>
                <Button onClick={handleUpload} disabled={uploading} className="w-full">
                  {uploading ? "Uploading..." : "Upload"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Search and filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search documents..." className="pl-9" />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-full sm:w-48">
            <Filter className="h-4 w-4 mr-2" /><SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Documents", value: documents.length },
          { label: "Training", value: documents.filter((d: any) => d.category === "training").length },
          { label: "Policies", value: documents.filter((d: any) => d.category === "policy").length },
          { label: "SOPs", value: documents.filter((d: any) => d.category === "sop").length },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-3 text-center">
              <div className="text-2xl font-bold text-primary">{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Documents list */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading documents...</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No documents found</p>
            <p className="text-sm">{isAdminOrManager ? "Upload your first document to get started." : "No documents have been uploaded yet."}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((doc: any) => (
            <Card key={doc.id} className="hover:shadow-md transition-shadow">
              <CardContent className="flex items-center justify-between py-4 gap-4">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-foreground truncate">{doc.title}</div>
                    {doc.description && <p className="text-xs text-muted-foreground truncate">{doc.description}</p>}
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variant="secondary" className={categoryColor(doc.category)}>{categoryLabel(doc.category)}</Badge>
                      <span className="text-xs text-muted-foreground">{formatSize(doc.file_size || 0)}</span>
                      <span className="text-xs text-muted-foreground">{format(new Date(doc.created_at), "MMM d, yyyy")}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="outline" size="sm" asChild>
                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                      <Download className="h-4 w-4" />
                    </a>
                  </Button>
                  {isAdminOrManager && (
                    <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate({ id: doc.id, file_name: doc.file_name })}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
