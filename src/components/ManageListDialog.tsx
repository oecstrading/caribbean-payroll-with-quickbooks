import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cleanListItems } from "@/hooks/useCompanyLists";

export function ManageListDialog({ open, label, items, onClose, onSave }: {
  open: boolean; label: string; items: string[]; onClose: () => void; onSave: (items: string[]) => Promise<void>;
}) {
  const [draft, setDraft] = useState<string[]>([]);
  const [adding, setAdding] = useState("");
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setDraft(cleanListItems(items)); setAdding(""); setEditIdx(null); } }, [open, items]);
  const add = () => {
    const v = adding.trim();
    if (!v) return;
    if (draft.some(d => d.toLowerCase() === v.toLowerCase())) { toast.error("Already in the list"); return; }
    setDraft([...draft, v.slice(0, 100)]); setAdding("");
  };
  const commitEdit = () => {
    if (editIdx === null) return;
    const v = editText.trim();
    if (!v) { toast.error("Name cannot be blank"); return; }
    setDraft(draft.map((d, i) => (i === editIdx ? v.slice(0, 100) : d))); setEditIdx(null);
  };
  const save = async () => {
    setBusy(true);
    try { await onSave(draft); toast.success(`${label} list saved`); onClose(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Unable to save list"); }
    finally { setBusy(false); }
  };
  return <Dialog open={open} onOpenChange={o => { if (!o && !busy) onClose(); }}>
    <DialogContent className="sm:max-w-md max-h-[85dvh] flex flex-col">
      <DialogHeader>
        <DialogTitle className="font-display">Manage {label.toLowerCase()} choices</DialogTitle>
        <DialogDescription>Add, rename or delete choices for your company. Employees already using a deleted or renamed choice keep their current value.</DialogDescription>
      </DialogHeader>
      <div className="flex gap-2">
        <Input value={adding} maxLength={100} placeholder={`New ${label.toLowerCase()}`} aria-label={`New ${label}`} className="h-11" onChange={e => setAdding(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <Button type="button" className="h-11" onClick={add}><Plus />Add</Button>
      </div>
      <ul className="flex-1 overflow-y-auto divide-y divide-border rounded-md border border-border min-h-[8rem]">
        {draft.length === 0 && <li className="p-4 text-sm text-muted-foreground">No choices yet. Add one above.</li>}
        {draft.map((item, i) => <li key={`${item}-${i}`} className="flex items-center gap-2 px-3 py-1.5 min-h-11">
          {editIdx === i
            ? <><Input autoFocus value={editText} maxLength={100} aria-label="Rename choice" className="h-9" onChange={e => setEditText(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); commitEdit(); } if (e.key === "Escape") setEditIdx(null); }} />
              <Button type="button" size="icon" variant="ghost" aria-label="Keep new name" onClick={commitEdit}><Check /></Button>
              <Button type="button" size="icon" variant="ghost" aria-label="Cancel rename" onClick={() => setEditIdx(null)}><X /></Button></>
            : <><span className="flex-1 break-words text-sm">{item}</span>
              <Button type="button" size="icon" variant="ghost" aria-label={`Rename ${item}`} onClick={() => { setEditIdx(i); setEditText(item); }}><Pencil /></Button>
              <Button type="button" size="icon" variant="ghost" className="text-destructive" aria-label={`Delete ${item}`} onClick={() => setDraft(draft.filter((_, j) => j !== i))}><Trash2 /></Button></>}
        </li>)}
      </ul>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button type="button" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save list"}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
