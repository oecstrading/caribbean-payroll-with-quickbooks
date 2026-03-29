import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { MapPin, Plus, Shield, FileText, Users, CheckCircle, Clock, Edit, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface ClientSite {
  id: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  radius_meters: number;
  post_orders: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  status: string;
  created_at: string;
}

interface GuardAssignment {
  id: string;
  user_id: string;
  site_id: string;
  shift_start: string | null;
  shift_end: string | null;
  is_active: boolean;
}

interface SignOff {
  id: string;
  user_id: string;
  site_id: string;
  signed_at: string;
}

export default function SiteManagementPage() {
  const { isAdminOrManager } = useRole();
  const { user } = useAuth();
  const [sites, setSites] = useState<ClientSite[]>([]);
  const [assignments, setAssignments] = useState<GuardAssignment[]>([]);
  const [signoffs, setSignoffs] = useState<SignOff[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedSite, setSelectedSite] = useState<ClientSite | null>(null);
  const [form, setForm] = useState({ name: "", address: "", latitude: "", longitude: "", radius_meters: "200", post_orders: "", client_name: "", client_email: "", client_phone: "", jurisdiction_id: "" });
  const [jurisdictions, setJurisdictions] = useState<{ id: string; code: string; name: string }[]>([]);
  const [assignUserId, setAssignUserId] = useState("");
  const [assignShiftStart, setAssignShiftStart] = useState("18:00");
  const [assignShiftEnd, setAssignShiftEnd] = useState("06:00");

  const fetchAll = async () => {
    const [sitesRes, assignRes, signoffsRes, profilesRes, jurRes] = await Promise.all([
      supabase.from("client_sites").select("*").order("created_at", { ascending: false }),
      supabase.from("guard_assignments").select("*").eq("is_active", true),
      supabase.from("post_order_signoffs").select("*").order("signed_at", { ascending: false }).limit(100),
      supabase.from("profiles").select("user_id, first_name, last_name, email").eq("status", "Active"),
      supabase.from("jurisdictions").select("id, code, name"),
    ]);
    setSites(sitesRes.data || []);
    setAssignments(assignRes.data || []);
    setSignoffs(signoffsRes.data || []);
    setProfiles(profilesRes.data || []);
    setJurisdictions((jurRes.data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const handleAddSite = async () => {
    if (!form.name.trim()) { toast.error("Site name is required"); return; }
    const { error } = await supabase.from("client_sites").insert({
      name: form.name,
      address: form.address,
      latitude: form.latitude ? parseFloat(form.latitude) : null,
      longitude: form.longitude ? parseFloat(form.longitude) : null,
      radius_meters: parseInt(form.radius_meters) || 200,
      post_orders: form.post_orders,
      client_name: form.client_name,
      client_email: form.client_email,
      client_phone: form.client_phone,
    });
    if (error) { toast.error("Failed to add site"); return; }
    toast.success("Client site added");
    setShowAdd(false);
    setForm({ name: "", address: "", latitude: "", longitude: "", radius_meters: "200", post_orders: "", client_name: "", client_email: "", client_phone: "" });
    fetchAll();
  };

  const handleAssignGuard = async (siteId: string) => {
    if (!assignUserId) { toast.error("Select a guard"); return; }
    const { error } = await supabase.from("guard_assignments").insert({
      user_id: assignUserId,
      site_id: siteId,
      shift_start: assignShiftStart,
      shift_end: assignShiftEnd,
    });
    if (error) { toast.error("Failed to assign guard"); return; }
    toast.success("Guard assigned");
    setAssignUserId("");
    fetchAll();
  };

  const handleSignOff = async (site: ClientSite) => {
    if (!user) return;
    const { error } = await supabase.from("post_order_signoffs").insert({
      user_id: user.id,
      site_id: site.id,
      post_orders_text: site.post_orders,
    });
    if (error) { toast.error("Sign-off failed"); return; }
    toast.success("Post orders acknowledged");
    fetchAll();
  };

  const getGuardsForSite = (siteId: string) =>
    assignments.filter(a => a.site_id === siteId).map(a => {
      const p = profiles.find(p => p.user_id === a.user_id);
      return { ...a, name: p ? `${p.first_name} ${p.last_name}` : "Unknown" };
    });

  const getSignoffsForSite = (siteId: string) =>
    signoffs.filter(s => s.site_id === siteId).map(s => {
      const p = profiles.find(p => p.user_id === s.user_id);
      return { ...s, name: p ? `${p.first_name} ${p.last_name}` : "Unknown" };
    });

  // Guard view — my assigned sites
  const myAssignments = assignments.filter(a => a.user_id === user?.id);
  const mySites = sites.filter(s => myAssignments.some(a => a.site_id === s.id));

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading sites...</div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Site Management</h1>
          <p className="text-sm text-muted-foreground">Manage client sites, post orders, and guard assignments</p>
        </div>
        {isAdminOrManager && (
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
            <Plus size={16} /> Add Site
          </button>
        )}
      </div>

      {!isAdminOrManager && mySites.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-display font-semibold">My Assigned Sites</h2>
          {mySites.map(site => (
            <Card key={site.id} className="shadow-card border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-display flex items-center gap-2">
                  <Shield size={16} className="text-primary" /> {site.name}
                </CardTitle>
                <p className="text-xs text-muted-foreground">{site.address}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {site.post_orders && (
                  <div className="p-3 rounded-lg bg-secondary/50 border border-border/50">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Post Orders</h4>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{site.post_orders}</p>
                  </div>
                )}
                <button
                  onClick={() => handleSignOff(site)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  <CheckCircle size={16} /> Acknowledge Post Orders
                </button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {isAdminOrManager && (
        <div className="grid gap-4">
          {sites.length === 0 ? (
            <Card className="shadow-card border-border/60">
              <CardContent className="p-12 text-center">
                <MapPin size={48} className="mx-auto text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-display font-semibold mb-2">No Client Sites</h3>
                <p className="text-sm text-muted-foreground">Add your first client site to start managing guards and post orders.</p>
              </CardContent>
            </Card>
          ) : (
            sites.map(site => {
              const guards = getGuardsForSite(site.id);
              const siteSignoffs = getSignoffsForSite(site.id);
              return (
                <Card key={site.id} className="shadow-card border-border/60 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedSite(site)}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base font-display">{site.name}</CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">{site.address}</p>
                      </div>
                      <Badge variant={site.status === "active" ? "default" : "secondary"}>{site.status}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Users size={12} /> {guards.length} guards</span>
                      <span className="flex items-center gap-1"><FileText size={12} /> {site.post_orders ? "Orders set" : "No orders"}</span>
                      <span className="flex items-center gap-1"><CheckCircle size={12} /> {siteSignoffs.length} sign-offs</span>
                      {site.client_name && <span className="flex items-center gap-1"><Shield size={12} /> {site.client_name}</span>}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* Add Site Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Add Client Site</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <Input placeholder="Site Name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <Input placeholder="Address" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Latitude" type="number" step="any" value={form.latitude} onChange={e => setForm(f => ({ ...f, latitude: e.target.value }))} />
              <Input placeholder="Longitude" type="number" step="any" value={form.longitude} onChange={e => setForm(f => ({ ...f, longitude: e.target.value }))} />
            </div>
            <Input placeholder="Geofence Radius (meters)" type="number" value={form.radius_meters} onChange={e => setForm(f => ({ ...f, radius_meters: e.target.value }))} />
            <Textarea placeholder="Post Orders — site-specific instructions for guards" rows={4} value={form.post_orders} onChange={e => setForm(f => ({ ...f, post_orders: e.target.value }))} />
            <div className="border-t border-border pt-3">
              <h4 className="text-xs font-medium text-muted-foreground uppercase mb-2">Client Info</h4>
              <Input placeholder="Client Name" value={form.client_name} onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))} className="mb-2" />
              <Input placeholder="Client Email" value={form.client_email} onChange={e => setForm(f => ({ ...f, client_email: e.target.value }))} className="mb-2" />
              <Input placeholder="Client Phone" value={form.client_phone} onChange={e => setForm(f => ({ ...f, client_phone: e.target.value }))} />
            </div>
            <button onClick={handleAddSite} className="w-full px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
              Add Site
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Site Detail Dialog */}
      <Dialog open={!!selectedSite} onOpenChange={(o) => !o && setSelectedSite(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedSite && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display">{selectedSite.name}</DialogTitle>
              </DialogHeader>
              <Tabs defaultValue="orders" className="mt-2">
                <TabsList className="grid grid-cols-3 w-full">
                  <TabsTrigger value="orders">Post Orders</TabsTrigger>
                  <TabsTrigger value="guards">Guards</TabsTrigger>
                  <TabsTrigger value="signoffs">Sign-offs</TabsTrigger>
                </TabsList>
                <TabsContent value="orders" className="space-y-3 mt-3">
                  <div className="p-4 rounded-lg bg-secondary/50 border border-border/50">
                    <p className="text-sm text-foreground whitespace-pre-wrap">{selectedSite.post_orders || "No post orders configured."}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-muted-foreground">Client:</span> <span className="font-medium">{selectedSite.client_name || "—"}</span></div>
                    <div><span className="text-muted-foreground">Email:</span> <span className="font-medium">{selectedSite.client_email || "—"}</span></div>
                    <div><span className="text-muted-foreground">Phone:</span> <span className="font-medium">{selectedSite.client_phone || "—"}</span></div>
                    <div><span className="text-muted-foreground">Radius:</span> <span className="font-medium">{selectedSite.radius_meters}m</span></div>
                  </div>
                </TabsContent>
                <TabsContent value="guards" className="space-y-3 mt-3">
                  {isAdminOrManager && (
                    <div className="flex gap-2">
                      <select value={assignUserId} onChange={e => setAssignUserId(e.target.value)} className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm">
                        <option value="">Select guard...</option>
                        {profiles.map(p => <option key={p.user_id} value={p.user_id}>{p.first_name} {p.last_name}</option>)}
                      </select>
                      <Input type="time" value={assignShiftStart} onChange={e => setAssignShiftStart(e.target.value)} className="w-28" />
                      <Input type="time" value={assignShiftEnd} onChange={e => setAssignShiftEnd(e.target.value)} className="w-28" />
                      <button onClick={() => handleAssignGuard(selectedSite.id)} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">
                        Assign
                      </button>
                    </div>
                  )}
                  {getGuardsForSite(selectedSite.id).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No guards assigned</p>
                  ) : (
                    <div className="space-y-2">
                      {getGuardsForSite(selectedSite.id).map(g => (
                        <div key={g.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/50">
                          <span className="text-sm font-medium">{g.name}</span>
                          <span className="text-xs text-muted-foreground">{g.shift_start || "—"} → {g.shift_end || "—"}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="signoffs" className="space-y-2 mt-3">
                  {getSignoffsForSite(selectedSite.id).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No sign-offs yet</p>
                  ) : (
                    getSignoffsForSite(selectedSite.id).map(s => (
                      <div key={s.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/50">
                        <span className="text-sm font-medium">{s.name}</span>
                        <span className="text-xs text-muted-foreground">{new Date(s.signed_at).toLocaleString()}</span>
                      </div>
                    ))
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
