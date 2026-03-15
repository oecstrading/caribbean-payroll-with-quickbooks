import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Wrench, Plus, Search, PackageCheck, AlertTriangle, ArrowLeftRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Equipment {
  id: string; name: string; type: string; serial_number: string; status: string; condition: string;
  purchase_date: string | null; purchase_cost: number; notes: string;
}
interface Checkout {
  id: string; equipment_id: string; user_id: string; project_id: string | null;
  checked_out_at: string; returned_at: string | null; condition_on_return: string; notes: string;
}

type EquipFilter = "all" | "available" | "checked-out" | "maintenance";

export default function EquipmentPage() {
  const { isAdminOrManager } = useRole();
  const { user } = useAuth();
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<EquipFilter>("all");
  const [showAdd, setShowAdd] = useState(false);
  const [showCheckout, setShowCheckout] = useState<Equipment | null>(null);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [checkouts, setCheckouts] = useState<Checkout[]>([]);

  const [form, setForm] = useState({ name: "", type: "tool", serial_number: "", purchase_cost: "", notes: "" });
  const [checkoutForm, setCheckoutForm] = useState({ user_id: "", project_id: "" });

  const fetchAll = async () => {
    const [{ data: eq }, { data: pr }, { data: pf }, { data: co }] = await Promise.all([
      supabase.from("equipment").select("*").order("created_at", { ascending: false }),
      supabase.from("projects").select("id, name").eq("status", "active"),
      supabase.from("profiles").select("user_id, first_name, last_name"),
      supabase.from("equipment_checkouts").select("*").is("returned_at", null),
    ]);
    setEquipment((eq as any[]) || []);
    setProjects((pr as any[]) || []);
    setProfiles(pf || []);
    setCheckouts((co as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const handleCreate = async () => {
    if (!form.name.trim()) { toast.error("Name required"); return; }
    const { error } = await supabase.from("equipment").insert({
      name: form.name, type: form.type, serial_number: form.serial_number,
      purchase_cost: parseFloat(form.purchase_cost) || 0, notes: form.notes,
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("Equipment added"); setShowAdd(false);
    setForm({ name: "", type: "tool", serial_number: "", purchase_cost: "", notes: "" }); fetchAll();
  };

  const handleCheckout = async () => {
    if (!showCheckout || !checkoutForm.user_id) { toast.error("Select an employee"); return; }
    const { error } = await supabase.from("equipment_checkouts").insert({
      equipment_id: showCheckout.id, user_id: checkoutForm.user_id, project_id: checkoutForm.project_id || null,
    } as any);
    if (!error) await supabase.from("equipment").update({ status: "checked-out" } as any).eq("id", showCheckout.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Checked out"); setShowCheckout(null);
    setCheckoutForm({ user_id: "", project_id: "" }); fetchAll();
  };

  const handleReturn = async (equipId: string) => {
    const checkout = checkouts.find(c => c.equipment_id === equipId);
    if (!checkout) return;
    await supabase.from("equipment_checkouts").update({ returned_at: new Date().toISOString() } as any).eq("id", checkout.id);
    await supabase.from("equipment").update({ status: "available" } as any).eq("id", equipId);
    toast.success("Returned"); fetchAll();
  };

  const filtered = equipment.filter(e => {
    if (search && !e.name.toLowerCase().includes(search.toLowerCase()) && !e.type.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== "all" && e.status !== statusFilter) return false;
    return true;
  });

  const stats = {
    total: equipment.length,
    available: equipment.filter(e => e.status === "available").length,
    checkedOut: equipment.filter(e => e.status === "checked-out").length,
    maintenance: equipment.filter(e => e.status === "maintenance").length,
  };

  const getCheckoutUser = (equipId: string) => {
    const co = checkouts.find(c => c.equipment_id === equipId);
    if (!co) return null;
    const profile = profiles.find(p => p.user_id === co.user_id);
    return profile ? `${profile.first_name} ${profile.last_name}` : "Unknown";
  };

  const statCards: { key: EquipFilter; label: string; value: number; icon: any; color: string; bg: string }[] = [
    { key: "all", label: "Total Items", value: stats.total, icon: Wrench, color: "text-primary", bg: "bg-primary/10" },
    { key: "available", label: "Available", value: stats.available, icon: PackageCheck, color: "text-success", bg: "bg-success/10" },
    { key: "checked-out", label: "Checked Out", value: stats.checkedOut, icon: ArrowLeftRight, color: "text-warning", bg: "bg-warning/10" },
    { key: "maintenance", label: "Maintenance", value: stats.maintenance, icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10" },
  ];

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4 md:space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-display font-bold text-foreground">Equipment & Tools</h1>
          <p className="text-sm text-muted-foreground mt-1">Track tools, equipment, and checkout history</p>
        </div>
        {isAdminOrManager && <Button onClick={() => setShowAdd(true)} className="gap-2"><Plus size={16} /> Add Equipment</Button>}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {statCards.map(s => (
          <Card key={s.key} onClick={() => setStatusFilter(statusFilter === s.key ? "all" : s.key)}
            className={cn("shadow-card border-border/60 cursor-pointer transition-all hover:shadow-md",
              statusFilter === s.key && s.key !== "all" && "ring-2 ring-primary border-primary/40")}>
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

      {statusFilter !== "all" && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs capitalize">Filtered: {statusFilter}</Badge>
          <Button variant="ghost" size="sm" onClick={() => setStatusFilter("all")} className="text-xs h-6">Clear</Button>
        </div>
      )}

      <div className="relative max-w-xs">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search equipment..." className="pl-9" />
      </div>

      <Card className="shadow-card border-border/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Name</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Type</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Serial #</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Assigned To</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">No equipment found</td></tr>
              ) : filtered.map((item, i) => (
                <motion.tr key={item.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                  className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="py-3 px-4 font-medium text-foreground">{item.name}</td>
                  <td className="py-3 px-4 text-muted-foreground capitalize">{item.type}</td>
                  <td className="py-3 px-4 font-mono text-muted-foreground text-xs">{item.serial_number || "—"}</td>
                  <td className="py-3 px-4">
                    <Badge variant="secondary" className={
                      item.status === "available" ? "bg-success/10 text-success" :
                      item.status === "checked-out" ? "bg-warning/10 text-warning" : "bg-destructive/10 text-destructive"
                    }>{item.status}</Badge>
                  </td>
                  <td className="py-3 px-4 text-foreground text-xs">{getCheckoutUser(item.id) || "—"}</td>
                  <td className="py-3 px-4 text-right space-x-1">
                    {isAdminOrManager && item.status === "available" && (
                      <Button size="sm" variant="outline" onClick={() => setShowCheckout(item)}>Check Out</Button>
                    )}
                    {isAdminOrManager && item.status === "checked-out" && (
                      <Button size="sm" variant="outline" onClick={() => handleReturn(item.id)}>Return</Button>
                    )}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Add Equipment</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Name *" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
            <Select value={form.type} onValueChange={v => setForm({...form, type: v})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["tool", "vehicle", "heavy-equipment", "safety-gear", "other"].map(t => (
                  <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input placeholder="Serial Number" value={form.serial_number} onChange={e => setForm({...form, serial_number: e.target.value})} />
            <Input placeholder="Purchase Cost ($)" type="number" value={form.purchase_cost} onChange={e => setForm({...form, purchase_cost: e.target.value})} />
            <textarea placeholder="Notes" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" rows={2} />
            <Button onClick={handleCreate} className="w-full">Add Equipment</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!showCheckout} onOpenChange={open => !open && setShowCheckout(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Check Out: {showCheckout?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Select value={checkoutForm.user_id} onValueChange={v => setCheckoutForm({...checkoutForm, user_id: v})}>
              <SelectTrigger><SelectValue placeholder="Select employee *" /></SelectTrigger>
              <SelectContent>{profiles.map(p => <SelectItem key={p.user_id} value={p.user_id}>{p.first_name} {p.last_name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={checkoutForm.project_id} onValueChange={v => setCheckoutForm({...checkoutForm, project_id: v})}>
              <SelectTrigger><SelectValue placeholder="Assign to project (optional)" /></SelectTrigger>
              <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
            <Button onClick={handleCheckout} className="w-full">Confirm Checkout</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
