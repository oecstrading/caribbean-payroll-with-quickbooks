import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Briefcase, Plus, DollarSign, Search, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Contractor {
  id: string; company_name: string; contact_name: string; email: string; phone: string;
  trade: string; tax_id: string; bank_name: string; account_number: string; status: string;
}
interface Payment {
  id: string; contractor_id: string; project_id: string | null; amount: number;
  description: string; payment_date: string; status: string; invoice_number: string;
}

type ContractorFilter = "all" | "active" | "paid" | "pending";

export default function ContractorsPage() {
  const { isAdminOrManager } = useRole();
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ContractorFilter>("all");
  const [activeTab, setActiveTab] = useState("contractors");
  const [showAddContractor, setShowAddContractor] = useState(false);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [selected, setSelected] = useState<Contractor | null>(null);

  const [contractorForm, setContractorForm] = useState({ company_name: "", contact_name: "", email: "", phone: "", trade: "", tax_id: "", bank_name: "", account_number: "" });
  const [paymentForm, setPaymentForm] = useState({ contractor_id: "", project_id: "", amount: "", description: "", invoice_number: "", payment_date: new Date().toISOString().split("T")[0] });

  const fetchAll = async () => {
    const [{ data: ct }, { data: py }, { data: pr }] = await Promise.all([
      supabase.from("contractors").select("*").order("created_at", { ascending: false }),
      supabase.from("contractor_payments").select("*").order("payment_date", { ascending: false }),
      supabase.from("projects").select("id, name"),
    ]);
    setContractors((ct as any[]) || []); setPayments((py as any[]) || []);
    setProjects((pr as any[]) || []); setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const handleCreateContractor = async () => {
    if (!contractorForm.company_name.trim()) { toast.error("Company name required"); return; }
    const { error } = await supabase.from("contractors").insert(contractorForm as any);
    if (error) { toast.error(error.message); return; }
    toast.success("Contractor added"); setShowAddContractor(false);
    setContractorForm({ company_name: "", contact_name: "", email: "", phone: "", trade: "", tax_id: "", bank_name: "", account_number: "" });
    fetchAll();
  };

  const handleCreatePayment = async () => {
    if (!paymentForm.contractor_id || !paymentForm.amount) { toast.error("Contractor and amount required"); return; }
    const { error } = await supabase.from("contractor_payments").insert({
      contractor_id: paymentForm.contractor_id, project_id: paymentForm.project_id || null,
      amount: parseFloat(paymentForm.amount), description: paymentForm.description,
      invoice_number: paymentForm.invoice_number, payment_date: paymentForm.payment_date,
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("Payment recorded"); setShowAddPayment(false);
    setPaymentForm({ contractor_id: "", project_id: "", amount: "", description: "", invoice_number: "", payment_date: new Date().toISOString().split("T")[0] });
    fetchAll();
  };

  const handlePaymentStatus = async (paymentId: string, status: string) => {
    await supabase.from("contractor_payments").update({ status } as any).eq("id", paymentId);
    fetchAll(); toast.success("Payment status updated");
  };

  const filtered = contractors.filter(c => {
    if (search && !c.company_name.toLowerCase().includes(search.toLowerCase()) && !c.trade.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === "active") return c.status === "active";
    return true;
  });

  const stats = {
    total: contractors.length,
    active: contractors.filter(c => c.status === "active").length,
    totalPaid: payments.filter(p => p.status === "paid").reduce((s, p) => s + p.amount, 0),
    pending: payments.filter(p => p.status === "pending").reduce((s, p) => s + p.amount, 0),
  };

  const getContractorName = (id: string) => contractors.find(c => c.id === id)?.company_name || "Unknown";
  const getProjectName = (id: string | null) => id ? (projects.find(p => p.id === id)?.name || "—") : "—";

  const statCards: { key: ContractorFilter; label: string; value: string | number; icon: any; color: string; bg: string; tab?: string }[] = [
    { key: "all", label: "Contractors", value: stats.total, icon: Briefcase, color: "text-primary", bg: "bg-primary/10" },
    { key: "active", label: "Active", value: stats.active, icon: Briefcase, color: "text-success", bg: "bg-success/10" },
    { key: "paid", label: "Total Paid", value: `$${stats.totalPaid.toLocaleString()}`, icon: DollarSign, color: "text-foreground", bg: "bg-secondary", tab: "payments" },
    { key: "pending", label: "Pending", value: `$${stats.pending.toLocaleString()}`, icon: FileText, color: "text-warning", bg: "bg-warning/10", tab: "payments" },
  ];

  const handleCardClick = (card: typeof statCards[0]) => {
    if (card.tab) setActiveTab(card.tab);
    else setActiveTab("contractors");
    setFilter(filter === card.key ? "all" : card.key);
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4 md:space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-display font-bold text-foreground">Contractors & Sub Payments</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage subcontractors and track payments</p>
        </div>
        {isAdminOrManager && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowAddContractor(true)} className="gap-2"><Plus size={16} /> Add Contractor</Button>
            <Button onClick={() => setShowAddPayment(true)} className="gap-2"><DollarSign size={16} /> Record Payment</Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {statCards.map(s => (
          <Card key={s.key} onClick={() => handleCardClick(s)}
            className={cn("shadow-card border-border/60 cursor-pointer transition-all hover:shadow-md",
              filter === s.key && s.key !== "all" && "ring-2 ring-primary border-primary/40")}>
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

      {filter !== "all" && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs capitalize">Filtered: {filter}</Badge>
          <Button variant="ghost" size="sm" onClick={() => setFilter("all")} className="text-xs h-6">Clear</Button>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList><TabsTrigger value="contractors">Contractors</TabsTrigger><TabsTrigger value="payments">Payments</TabsTrigger></TabsList>

        <TabsContent value="contractors" className="space-y-4">
          <div className="relative max-w-xs">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search contractors..." className="pl-9" />
          </div>
          <Card className="shadow-card border-border/60 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Company</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Contact</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Trade</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Total Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">Loading...</td></tr> :
                    filtered.length === 0 ? <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">No contractors</td></tr> :
                    filtered.map((c, i) => {
                      const totalPaid = payments.filter(p => p.contractor_id === c.id && p.status === "paid").reduce((s, p) => s + p.amount, 0);
                      return (
                        <motion.tr key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                          className="border-b border-border/50 hover:bg-secondary/30 transition-colors cursor-pointer" onClick={() => setSelected(c)}>
                          <td className="py-3 px-4 font-medium text-foreground">{c.company_name}</td>
                          <td className="py-3 px-4 text-muted-foreground">{c.contact_name || "—"}</td>
                          <td className="py-3 px-4 text-muted-foreground capitalize">{c.trade || "—"}</td>
                          <td className="py-3 px-4">
                            <Badge variant="secondary" className={c.status === "active" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}>{c.status}</Badge>
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-foreground">${totalPaid.toLocaleString()}</td>
                        </motion.tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card className="shadow-card border-border/60 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Date</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Contractor</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Project</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Invoice #</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Amount</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const filteredPayments = filter === "paid" ? payments.filter(p => p.status === "paid") :
                      filter === "pending" ? payments.filter(p => p.status === "pending") : payments;
                    return filteredPayments.length === 0 ? <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">No payments</td></tr> :
                      filteredPayments.map((p, i) => (
                        <motion.tr key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                          className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                          <td className="py-3 px-4 text-foreground">{new Date(p.payment_date).toLocaleDateString()}</td>
                          <td className="py-3 px-4 text-foreground">{getContractorName(p.contractor_id)}</td>
                          <td className="py-3 px-4 text-muted-foreground">{getProjectName(p.project_id)}</td>
                          <td className="py-3 px-4 font-mono text-muted-foreground text-xs">{p.invoice_number || "—"}</td>
                          <td className="py-3 px-4 text-right font-mono font-semibold text-foreground">${p.amount.toLocaleString()}</td>
                          <td className="py-3 px-4">
                            {isAdminOrManager ? (
                              <Select value={p.status} onValueChange={v => handlePaymentStatus(p.id, v)}>
                                <SelectTrigger className="h-7 w-24 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="pending">Pending</SelectItem>
                                  <SelectItem value="paid">Paid</SelectItem>
                                  <SelectItem value="cancelled">Cancelled</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <Badge variant="secondary" className={
                                p.status === "paid" ? "bg-success/10 text-success" :
                                p.status === "pending" ? "bg-warning/10 text-warning" : "bg-muted text-muted-foreground"
                              }>{p.status}</Badge>
                            )}
                          </td>
                        </motion.tr>
                      ));
                  })()}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Contractor */}
      <Dialog open={showAddContractor} onOpenChange={setShowAddContractor}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Add Contractor</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Company Name *" value={contractorForm.company_name} onChange={e => setContractorForm({...contractorForm, company_name: e.target.value})} />
            <Input placeholder="Contact Person" value={contractorForm.contact_name} onChange={e => setContractorForm({...contractorForm, contact_name: e.target.value})} />
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Email" type="email" value={contractorForm.email} onChange={e => setContractorForm({...contractorForm, email: e.target.value})} />
              <Input placeholder="Phone" value={contractorForm.phone} onChange={e => setContractorForm({...contractorForm, phone: e.target.value})} />
            </div>
            <Input placeholder="Trade (e.g. Plumbing, Electrical)" value={contractorForm.trade} onChange={e => setContractorForm({...contractorForm, trade: e.target.value})} />
            <Input placeholder="Tax ID" value={contractorForm.tax_id} onChange={e => setContractorForm({...contractorForm, tax_id: e.target.value})} />
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Bank Name" value={contractorForm.bank_name} onChange={e => setContractorForm({...contractorForm, bank_name: e.target.value})} />
              <Input placeholder="Account #" value={contractorForm.account_number} onChange={e => setContractorForm({...contractorForm, account_number: e.target.value})} />
            </div>
            <Button onClick={handleCreateContractor} className="w-full">Add Contractor</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Record Payment */}
      <Dialog open={showAddPayment} onOpenChange={setShowAddPayment}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Record Payment</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Select value={paymentForm.contractor_id} onValueChange={v => setPaymentForm({...paymentForm, contractor_id: v})}>
              <SelectTrigger><SelectValue placeholder="Select contractor *" /></SelectTrigger>
              <SelectContent>{contractors.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={paymentForm.project_id} onValueChange={v => setPaymentForm({...paymentForm, project_id: v})}>
              <SelectTrigger><SelectValue placeholder="Project (optional)" /></SelectTrigger>
              <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
            <Input placeholder="Amount ($) *" type="number" value={paymentForm.amount} onChange={e => setPaymentForm({...paymentForm, amount: e.target.value})} />
            <Input placeholder="Invoice Number" value={paymentForm.invoice_number} onChange={e => setPaymentForm({...paymentForm, invoice_number: e.target.value})} />
            <Input placeholder="Description" value={paymentForm.description} onChange={e => setPaymentForm({...paymentForm, description: e.target.value})} />
            <Input type="date" value={paymentForm.payment_date} onChange={e => setPaymentForm({...paymentForm, payment_date: e.target.value})} />
            <Button onClick={handleCreatePayment} className="w-full">Record Payment</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Contractor Detail */}
      <Dialog open={!!selected} onOpenChange={open => !open && setSelected(null)}>
        <DialogContent>
          {selected && (
            <>
              <DialogHeader><DialogTitle className="font-display">{selected.company_name}</DialogTitle></DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div><span className="text-muted-foreground">Contact:</span> <span className="text-foreground">{selected.contact_name || "—"}</span></div>
                  <div><span className="text-muted-foreground">Email:</span> <span className="text-foreground">{selected.email || "—"}</span></div>
                  <div><span className="text-muted-foreground">Phone:</span> <span className="text-foreground">{selected.phone || "—"}</span></div>
                  <div><span className="text-muted-foreground">Trade:</span> <span className="text-foreground capitalize">{selected.trade || "—"}</span></div>
                  <div><span className="text-muted-foreground">Tax ID:</span> <span className="font-mono text-foreground">{selected.tax_id || "—"}</span></div>
                  <div><span className="text-muted-foreground">Bank:</span> <span className="text-foreground">{selected.bank_name || "—"}</span></div>
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Payment History</h4>
                  {payments.filter(p => p.contractor_id === selected.id).length === 0 ? (
                    <p className="text-muted-foreground text-xs">No payments yet</p>
                  ) : (
                    <div className="space-y-1.5">
                      {payments.filter(p => p.contractor_id === selected.id).map(p => (
                        <div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-secondary/50">
                          <div>
                            <span className="text-foreground text-xs">{new Date(p.payment_date).toLocaleDateString()}</span>
                            {p.description && <span className="text-muted-foreground text-xs ml-2">— {p.description}</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-semibold text-foreground">${p.amount.toLocaleString()}</span>
                            <Badge variant="secondary" className={p.status === "paid" ? "bg-success/10 text-success text-[10px]" : "bg-warning/10 text-warning text-[10px]"}>{p.status}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
