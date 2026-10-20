import { useCallback, useEffect, useState } from "react";
import { Upload, Download, Save, Trash2, Pencil, FileText, X, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { documentSchema, documentExpiry, validateDocumentFile } from "@/lib/employee-documents";
import { toast } from "sonner";

type Document = Database["public"]["Tables"]["employee_documents"]["Row"];
const initial = { title: "", category: "Contract" as "Contract" | "Certification" | "Other HR", expiry_date: "", employee_visible: false };
export default function EmployeeDocuments({ employeeKey, canManage, accountLinked }: { employeeKey: string; canManage: boolean; accountLinked: boolean }) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [values, setValues] = useState(initial);
  const [file, setFile] = useState<File | null>(null);
  const [editing, setEditing] = useState<Document | null>(null);
  const [removing, setRemoving] = useState<Document | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    const result = await supabase.from("employee_documents").select("*").eq("employee_key", employeeKey).order("created_at", { ascending: false });
    if (result.error) setError("Documents could not be loaded. Please retry."); else setDocuments(result.data || []);
    setLoading(false);
  }, [employeeKey]);
  useEffect(() => { setDocuments([]); setFormOpen(false); setEditing(null); setRemoving(null); load(); }, [load]);
  const reset = () => { setFormOpen(false); setEditing(null); setFile(null); setValues(initial); };
  const save = async () => {
    if (!canManage) return;
    const parsed = documentSchema.safeParse(values);
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message); return; }
    const data = { title: parsed.data.title, category: parsed.data.category, expiry_date: parsed.data.expiry_date || null, employee_visible: accountLinked && parsed.data.employee_visible };
    setBusy(true);
    try {
      if (editing) {
        const result = await supabase.from("employee_documents").update(data).eq("id", editing.id).select("id").single();
        if (result.error) throw result.error;
      } else {
        if (!file) throw new Error("Choose a document file");
        validateDocumentFile(file);
        const id = crypto.randomUUID(); const path = `${employeeKey}/${id}`;
        const metadata = await supabase.from("employee_documents").insert({ id, employee_key: employeeKey, ...data, file_name: file.name, file_size: file.size, storage_path: path }).select("id").single();
        if (metadata.error) throw metadata.error;
        const uploaded = await supabase.storage.from("employee-hr-docs").upload(path, file, { contentType: file.type || "application/octet-stream" });
        if (uploaded.error) { await supabase.from("employee_documents").delete().eq("id", id); throw uploaded.error; }
      }
      reset(); await load(); toast.success("Document saved");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Document could not be saved"); }
    finally { setBusy(false); }
  };
  const download = async (document: Document) => {
    setBusy(true);
    try {
      const result = await supabase.storage.from("employee-hr-docs").createSignedUrl(document.storage_path, 60, { download: document.file_name });
      if (result.error || !result.data) throw result.error || new Error("Download unavailable");
      const a = window.document.createElement("a"); a.href = result.data.signedUrl; a.click();
    } catch { toast.error("Document could not be downloaded"); } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!removing || !canManage) return;
    setBusy(true);
    try {
      const deleted = await supabase.storage.from("employee-hr-docs").remove([removing.storage_path]);
      if (deleted.error) throw deleted.error;
      const result = await supabase.from("employee_documents").delete().eq("id", removing.id).select("id").single();
      if (result.error) throw result.error;
      setRemoving(null); await load(); toast.success("Document deleted");
    } catch { toast.error("Document could not be deleted"); } finally { setBusy(false); }
  };
  return <section className="space-y-4">
    <div className="flex items-center justify-between gap-3"><h3 className="font-semibold flex items-center gap-2"><Lock size={16} />Employee documents</h3>{canManage && !formOpen && <Button className="h-11" onClick={() => { setValues(initial); setEditing(null); setFile(null); setFormOpen(true); }}><Upload size={16} />Add document</Button>}</div>
    {formOpen && canManage && <div className="space-y-4 border-y border-border py-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1"><Label htmlFor="doc-title">Document title *</Label><Input id="doc-title" value={values.title} maxLength={150} onChange={e => setValues({ ...values, title: e.target.value })} /></div>
        <div className="space-y-1"><Label htmlFor="doc-category">Category</Label><select id="doc-category" value={values.category} onChange={e => { const parsed = documentSchema.shape.category.safeParse(e.target.value); if (parsed.success) setValues({ ...values, category: parsed.data }); }} className="h-10 w-full border border-input bg-background text-foreground rounded-md px-3">{["Contract", "Certification", "Other HR"].map(c => <option key={c}>{c}</option>)}</select></div>
        <div className="space-y-1"><Label htmlFor="doc-expiry">Expiry date (optional)</Label><Input id="doc-expiry" type="date" value={values.expiry_date} onChange={e => setValues({ ...values, expiry_date: e.target.value })} /></div>
        <div className="space-y-1"><Label htmlFor="doc-access">Access</Label><select id="doc-access" className="h-10 w-full border border-input bg-background text-foreground rounded-md px-3" value={values.employee_visible ? "shared" : "hr"} onChange={e => setValues({ ...values, employee_visible: e.target.value === "shared" })}><option value="hr">HR only</option>{accountLinked && <option value="shared">HR + this employee</option>}</select></div>
        {!editing && <div className="sm:col-span-2 space-y-1"><Label htmlFor="doc-file">File *</Label><Input id="doc-file" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.png,.jpg,.jpeg" onChange={e => { const next = e.target.files?.[0]; if (!next) return; try { validateDocumentFile(next); setFile(next); if (!values.title) setValues({ ...values, title: next.name.replace(/\.[^.]+$/, "") }); } catch (error) { setFile(null); toast.error(error instanceof Error ? error.message : "Invalid file"); e.target.value = ""; } }} /><p className="text-xs text-muted-foreground">PDF, Word, Excel, text or images · Up to 20 MB</p></div>}
      </div>
      <div className="flex gap-2 justify-end"><Button variant="outline" disabled={busy} onClick={reset}><X size={16} />Cancel</Button><Button disabled={busy} onClick={save}><Save size={16} />{busy ? "Saving…" : "Save document"}</Button></div>
    </div>}
    {removing && <div role="alert" className="border border-destructive rounded-md p-3 space-y-3"><p className="text-sm">Permanently delete {removing.title}?</p><div className="flex gap-2"><Button variant="outline" disabled={busy} onClick={() => setRemoving(null)}>Cancel</Button><Button variant="destructive" disabled={busy} onClick={remove}><Trash2 size={16} />Delete document</Button></div></div>}
    {error ? <div role="alert" className="text-sm text-destructive">{error}<Button variant="link" onClick={load}>Retry</Button></div> : loading ? <p className="text-sm text-muted-foreground">Loading documents…</p> : !documents.length ? <div className="py-8 text-center text-muted-foreground"><FileText className="mx-auto mb-2" /><p className="text-sm">No documents available</p></div> : <ul className="divide-y divide-border">{documents.map(d => {
      const expiry = documentExpiry(d.expiry_date);
      return <li key={d.id} className="py-4 flex flex-wrap gap-3 items-center justify-between"><div className="min-w-0 flex-1 space-y-1"><p className="font-medium break-words">{d.title}</p><p className="text-xs text-muted-foreground break-all">{d.category} · {d.file_name} · {(d.file_size / 1024).toFixed(0)} KB</p><div className="flex flex-wrap items-center gap-2"><Badge variant={expiry === "Expired" ? "destructive" : expiry === "Expiring soon" ? "secondary" : "outline"}>{expiry}</Badge>{d.expiry_date && <span className="text-xs text-muted-foreground">{d.expiry_date}</span>}<span className="text-xs text-muted-foreground">{d.employee_visible ? "HR + this employee" : "HR only"}</span></div></div><div className="flex gap-1"><Button variant="outline" size="icon" className="h-11 w-11" disabled={busy} title="Download document" aria-label={`Download ${d.title}`} onClick={() => download(d)}><Download size={16} /></Button>{canManage && <><Button variant="ghost" size="icon" className="h-11 w-11" disabled={busy} title="Edit expiry and access" aria-label={`Edit ${d.title}`} onClick={() => { setEditing(d); setValues({ title: d.title, category: documentSchema.shape.category.parse(d.category), expiry_date: d.expiry_date || "", employee_visible: d.employee_visible }); setFormOpen(true); }}><Pencil size={16} /></Button><Button variant="ghost" size="icon" className="h-11 w-11 text-destructive" disabled={busy} title="Delete document" aria-label={`Delete ${d.title}`} onClick={() => setRemoving(d)}><Trash2 size={16} /></Button></>}</div></li>;
    })}</ul>}
  </section>;
}