import { useState, useEffect } from "react";
import { Shield, AlertTriangle, CheckCircle, Clock, FileText, Users, Search, Plus, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, differenceInDays, addDays } from "date-fns";

interface License {
  id: string;
  user_id: string;
  license_type: string;
  license_number: string;
  issued_date: string;
  expiry_date: string;
  status: string;
  notes: string;
}

interface Profile {
  user_id: string;
  first_name: string;
  last_name: string;
  department: string;
}

export default function ComplianceTrackingPage() {
  const [licenses, setLicenses] = useState<License[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ user_id: "", license_type: "security_guard", license_number: "", issued_date: "", expiry_date: "", notes: "" });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [licRes, profRes] = await Promise.all([
      supabase.from("guard_licenses" as any).select("*").order("expiry_date", { ascending: true }),
      supabase.from("profiles").select("user_id, first_name, last_name, department"),
    ]);
    setLicenses((licRes.data as unknown as License[]) || []);
    setProfiles((profRes.data as Profile[]) || []);
    setLoading(false);
  };

  const getName = (uid: string) => {
    const p = profiles.find((pr) => pr.user_id === uid);
    return p ? `${p.first_name} ${p.last_name}` : "Unknown";
  };

  const getStatus = (expiry: string) => {
    const daysLeft = differenceInDays(new Date(expiry), new Date());
    if (daysLeft < 0) return { label: "Expired", variant: "destructive" as const, days: daysLeft };
    if (daysLeft <= 30) return { label: "Expiring Soon", variant: "outline" as const, days: daysLeft };
    return { label: "Valid", variant: "secondary" as const, days: daysLeft };
  };

  const filtered = licenses.filter((l) => {
    const name = getName(l.user_id).toLowerCase();
    const matchSearch = name.includes(search.toLowerCase()) || l.license_number.toLowerCase().includes(search.toLowerCase());
    if (filterStatus === "all") return matchSearch;
    const status = getStatus(l.expiry_date);
    if (filterStatus === "expired") return matchSearch && status.days < 0;
    if (filterStatus === "expiring") return matchSearch && status.days >= 0 && status.days <= 30;
    if (filterStatus === "valid") return matchSearch && status.days > 30;
    return matchSearch;
  });

  const expiredCount = licenses.filter((l) => getStatus(l.expiry_date).days < 0).length;
  const expiringCount = licenses.filter((l) => { const d = getStatus(l.expiry_date).days; return d >= 0 && d <= 30; }).length;
  const validCount = licenses.filter((l) => getStatus(l.expiry_date).days > 30).length;

  const handleAdd = async () => {
    if (!form.user_id || !form.license_number || !form.expiry_date) {
      toast.error("Fill required fields"); return;
    }
    const { error } = await supabase.from("guard_licenses").insert({
      user_id: form.user_id,
      license_type: form.license_type,
      license_number: form.license_number,
      issued_date: form.issued_date || null,
      expiry_date: form.expiry_date,
      notes: form.notes,
      status: "active",
    });
    if (error) { toast.error(error.message); return; }
    toast.success("License added");
    setShowAdd(false);
    setForm({ user_id: "", license_type: "security_guard", license_number: "", issued_date: "", expiry_date: "", notes: "" });
    fetchData();
  };

  const LICENSE_TYPES = [
    { value: "security_guard", label: "Security Guard License" },
    { value: "firearm", label: "Firearm Permit" },
    { value: "first_aid", label: "First Aid Certification" },
    { value: "cpr", label: "CPR Certification" },
    { value: "driver", label: "Driver's License" },
    { value: "other", label: "Other" },
  ];

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-display font-bold text-foreground">Compliance & Licensing</h1>
          <p className="text-sm text-muted-foreground">Track guard licenses, certifications & renewals</p>
        </div>
        <Button onClick={() => setShowAdd(true)}><Plus className="w-4 h-4 mr-1" /> Add License</Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/10"><AlertTriangle className="w-5 h-5 text-destructive" /></div>
            <div><p className="text-2xl font-bold text-foreground">{expiredCount}</p><p className="text-xs text-muted-foreground">Expired</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10"><Clock className="w-5 h-5 text-amber-500" /></div>
            <div><p className="text-2xl font-bold text-foreground">{expiringCount}</p><p className="text-xs text-muted-foreground">Expiring (30d)</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><CheckCircle className="w-5 h-5 text-primary" /></div>
            <div><p className="text-2xl font-bold text-foreground">{validCount}</p><p className="text-xs text-muted-foreground">Valid</p></div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or license..." className="pl-9" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="expiring">Expiring Soon</SelectItem>
            <SelectItem value="valid">Valid</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Guard</TableHead>
                <TableHead>License Type</TableHead>
                <TableHead>Number</TableHead>
                <TableHead>Expiry Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Days Left</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No licenses found</TableCell></TableRow>
              ) : filtered.map((l) => {
                const status = getStatus(l.expiry_date);
                return (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{getName(l.user_id)}</TableCell>
                    <TableCell>{LICENSE_TYPES.find((t) => t.value === l.license_type)?.label || l.license_type}</TableCell>
                    <TableCell className="font-mono text-xs">{l.license_number}</TableCell>
                    <TableCell>{format(new Date(l.expiry_date), "MMM d, yyyy")}</TableCell>
                    <TableCell><Badge variant={status.variant}>{status.label}</Badge></TableCell>
                    <TableCell className={status.days < 0 ? "text-destructive font-medium" : status.days <= 30 ? "text-amber-600 font-medium" : "text-muted-foreground"}>
                      {status.days < 0 ? `${Math.abs(status.days)}d overdue` : `${status.days}d`}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add License / Certification</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Select value={form.user_id} onValueChange={(v) => setForm({ ...form, user_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select Guard" /></SelectTrigger>
              <SelectContent>
                {profiles.map((p) => (
                  <SelectItem key={p.user_id} value={p.user_id}>{p.first_name} {p.last_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={form.license_type} onValueChange={(v) => setForm({ ...form, license_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LICENSE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input placeholder="License Number" value={form.license_number} onChange={(e) => setForm({ ...form, license_number: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-muted-foreground">Issued Date</label><Input type="date" value={form.issued_date} onChange={(e) => setForm({ ...form, issued_date: e.target.value })} /></div>
              <div><label className="text-xs text-muted-foreground">Expiry Date *</label><Input type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} /></div>
            </div>
            <Input placeholder="Notes (optional)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            <Button className="w-full" onClick={handleAdd}>Add License</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
