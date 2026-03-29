import { useEffect, useState } from "react";
import { FileText, Plus, Eye, Download, Search, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format } from "date-fns";

interface Invoice {
  id: string;
  invoice_number: string;
  site_id: string | null;
  client_name: string;
  client_email: string;
  invoice_date: string;
  due_date: string;
  period_start: string;
  period_end: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  status: string;
  notes: string;
}

interface LineItem {
  id: string;
  invoice_id: string;
  description: string;
  guard_name: string;
  shift_date: string | null;
  hours: number;
  rate: number;
  amount: number;
}

interface Site {
  id: string;
  name: string;
  client_name: string | null;
  client_email: string | null;
}

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-500/10 text-blue-600",
  paid: "bg-green-500/10 text-green-700",
  overdue: "bg-red-500/10 text-red-600",
  cancelled: "bg-muted text-muted-foreground",
};

function formatCurrency(amount: number) {
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}

export default function InvoicingPage() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [generating, setGenerating] = useState(false);

  const [form, setForm] = useState({
    site_id: "",
    period_start: format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), "yyyy-MM-dd"),
    period_end: format(new Date(), "yyyy-MM-dd"),
    tax_rate: 0,
    notes: "",
  });

  const fetchInvoices = async () => {
    const { data } = await supabase
      .from("client_invoices")
      .select("*")
      .order("created_at", { ascending: false });
    setInvoices((data as any[]) || []);
    setLoading(false);
  };

  const fetchSites = async () => {
    const { data } = await supabase.from("client_sites").select("id, name, client_name, client_email").eq("status", "active");
    setSites((data as any[]) || []);
  };

  useEffect(() => { fetchInvoices(); fetchSites(); }, []);

  const fetchLineItems = async (invoiceId: string) => {
    const { data } = await supabase.from("invoice_line_items").select("*").eq("invoice_id", invoiceId).order("shift_date");
    setLineItems((data as any[]) || []);
  };

  const generateInvoice = async () => {
    if (!form.site_id) { toast.error("Select a client site"); return; }
    setGenerating(true);

    const site = sites.find(s => s.id === form.site_id);
    if (!site) { setGenerating(false); return; }

    // Fetch verified clock punches for the period
    const { data: assignments } = await supabase
      .from("guard_assignments")
      .select("user_id, shift_start, shift_end")
      .eq("site_id", form.site_id)
      .eq("is_active", true);

    if (!assignments || assignments.length === 0) {
      toast.error("No guard assignments found for this site");
      setGenerating(false);
      return;
    }

    const guardIds = assignments.map(a => a.user_id);

    // Get profiles for guard names
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, first_name, last_name, monthly_salary")
      .in("user_id", guardIds);

    const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));

    // Get clock punches within the period
    const { data: punches } = await supabase
      .from("clock_punches")
      .select("*")
      .in("user_id", guardIds)
      .eq("within_geofence", true)
      .gte("punched_at", `${form.period_start}T00:00:00`)
      .lte("punched_at", `${form.period_end}T23:59:59`)
      .order("punched_at");

    // Pair clock-in/out to calculate hours per guard per day
    const shiftMap = new Map<string, { guard: string; date: string; hours: number }>();

    if (punches) {
      const clockIns = new Map<string, string>();
      for (const p of punches) {
        const key = p.user_id;
        if (p.punch_type === "clock_in") {
          clockIns.set(key, p.punched_at);
        } else if (p.punch_type === "clock_out" && clockIns.has(key)) {
          const inTime = new Date(clockIns.get(key)!);
          const outTime = new Date(p.punched_at);
          const hours = Math.round(((outTime.getTime() - inTime.getTime()) / 3600000) * 100) / 100;
          const date = format(inTime, "yyyy-MM-dd");
          const shiftKey = `${p.user_id}-${date}`;
          const existing = shiftMap.get(shiftKey);
          const profile = profileMap.get(p.user_id);
          const guardName = profile ? `${profile.first_name} ${profile.last_name}` : "Unknown";
          shiftMap.set(shiftKey, {
            guard: guardName,
            date,
            hours: (existing?.hours || 0) + hours,
          });
          clockIns.delete(key);
        }
      }
    }

    const items = Array.from(shiftMap.values());
    if (items.length === 0) {
      toast.error("No verified shifts found for this period");
      setGenerating(false);
      return;
    }

    // Calculate rate from assignment or use default hourly rate
    const defaultHourlyRate = 25; // XCD per hour default
    const subtotal = items.reduce((sum, item) => sum + item.hours * defaultHourlyRate, 0);
    const taxAmount = subtotal * (form.tax_rate / 100);
    const total = subtotal + taxAmount;
    const invoiceNumber = `INV-${format(new Date(), "yyyyMMdd")}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

    // Create invoice
    const { data: invoice, error } = await supabase
      .from("client_invoices")
      .insert({
        invoice_number: invoiceNumber,
        site_id: form.site_id,
        client_name: site.client_name || site.name,
        client_email: site.client_email || "",
        period_start: form.period_start,
        period_end: form.period_end,
        subtotal,
        tax_rate: form.tax_rate,
        tax_amount: taxAmount,
        total,
        notes: form.notes,
        created_by: user?.id,
      } as any)
      .select()
      .single();

    if (error || !invoice) {
      toast.error("Failed to create invoice");
      setGenerating(false);
      return;
    }

    // Create line items
    const lineItemsData = items.map(item => ({
      invoice_id: (invoice as any).id,
      description: `Security services - ${item.guard}`,
      guard_name: item.guard,
      shift_date: item.date,
      hours: item.hours,
      rate: defaultHourlyRate,
      amount: item.hours * defaultHourlyRate,
    }));

    await supabase.from("invoice_line_items").insert(lineItemsData as any);

    toast.success(`Invoice ${invoiceNumber} generated — ${formatCurrency(total)}`);
    setShowCreate(false);
    setGenerating(false);
    fetchInvoices();
  };

  const updateInvoiceStatus = async (id: string, status: string) => {
    await supabase.from("client_invoices").update({ status } as any).eq("id", id);
    toast.success(`Invoice marked as ${status}`);
    fetchInvoices();
    if (selectedInvoice?.id === id) setSelectedInvoice({ ...selectedInvoice, status });
  };

  const filtered = invoices.filter(inv => {
    if (filterStatus !== "all" && inv.status !== filterStatus) return false;
    if (search) return `${inv.invoice_number} ${inv.client_name}`.toLowerCase().includes(search.toLowerCase());
    return true;
  });

  const totals = {
    all: invoices.reduce((s, i) => s + i.total, 0),
    paid: invoices.filter(i => i.status === "paid").reduce((s, i) => s + i.total, 0),
    outstanding: invoices.filter(i => ["sent", "overdue"].includes(i.status)).reduce((s, i) => s + i.total, 0),
    draft: invoices.filter(i => i.status === "draft").reduce((s, i) => s + i.total, 0),
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Client Invoicing</h1>
          <p className="text-sm text-muted-foreground">Auto-generate invoices from verified guard shifts</p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button><Plus size={16} className="mr-2" />Generate Invoice</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Generate Invoice from Shifts</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Client Site *</Label>
                <Select value={form.site_id} onValueChange={v => setForm({...form, site_id: v})}>
                  <SelectTrigger><SelectValue placeholder="Select site..." /></SelectTrigger>
                  <SelectContent>
                    {sites.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name} {s.client_name ? `(${s.client_name})` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Period Start</Label>
                  <Input type="date" value={form.period_start} onChange={e => setForm({...form, period_start: e.target.value})} />
                </div>
                <div>
                  <Label>Period End</Label>
                  <Input type="date" value={form.period_end} onChange={e => setForm({...form, period_end: e.target.value})} />
                </div>
              </div>
              <div>
                <Label>Tax Rate (%)</Label>
                <Input type="number" value={form.tax_rate} onChange={e => setForm({...form, tax_rate: parseFloat(e.target.value) || 0})} />
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2} placeholder="Additional notes for the client..." />
              </div>
              <Button onClick={generateInvoice} disabled={generating} className="w-full">
                {generating ? "Generating..." : "Generate Invoice"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Invoiced", value: formatCurrency(totals.all), color: "text-foreground" },
          { label: "Paid", value: formatCurrency(totals.paid), color: "text-green-600" },
          { label: "Outstanding", value: formatCurrency(totals.outstanding), color: "text-blue-600" },
          { label: "Draft", value: formatCurrency(totals.draft), color: "text-muted-foreground" },
        ].map(s => (
          <Card key={s.label} className="shadow-card border-border/60">
            <CardContent className="p-4 text-center">
              <p className={`text-lg font-display font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search invoices..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="shadow-card border-border/60">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Invoice #</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Client</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden md:table-cell">Period</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Total</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(inv => (
                <tr key={inv.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="py-3 px-4 font-mono font-medium text-foreground">{inv.invoice_number}</td>
                  <td className="py-3 px-4 text-foreground">{inv.client_name}</td>
                  <td className="py-3 px-4 hidden md:table-cell text-muted-foreground">
                    {inv.period_start} — {inv.period_end}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-semibold text-foreground">{formatCurrency(inv.total)}</td>
                  <td className="py-3 px-4">
                    <Badge variant="outline" className={statusColors[inv.status]}>{inv.status}</Badge>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <Button size="sm" variant="ghost" onClick={() => { setSelectedInvoice(inv); fetchLineItems(inv.id); }}>
                      <Eye size={14} />
                    </Button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="py-12 text-center text-muted-foreground">
                  {loading ? "Loading..." : "No invoices found. Generate one from verified shifts."}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Invoice Detail */}
      <Dialog open={!!selectedInvoice} onOpenChange={open => !open && setSelectedInvoice(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          {selectedInvoice && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display">Invoice {selectedInvoice.invoice_number}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Client:</span> <span className="text-foreground font-medium">{selectedInvoice.client_name}</span></div>
                  <div><span className="text-muted-foreground">Status:</span> <Badge variant="outline" className={statusColors[selectedInvoice.status]}>{selectedInvoice.status}</Badge></div>
                  <div><span className="text-muted-foreground">Invoice Date:</span> <span className="text-foreground">{selectedInvoice.invoice_date}</span></div>
                  <div><span className="text-muted-foreground">Due Date:</span> <span className="text-foreground">{selectedInvoice.due_date}</span></div>
                  <div className="col-span-2"><span className="text-muted-foreground">Period:</span> <span className="text-foreground">{selectedInvoice.period_start} — {selectedInvoice.period_end}</span></div>
                </div>

                {/* Line items */}
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-2">Shift Details</h3>
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-secondary/50 border-b border-border">
                          <th className="text-left py-2 px-3 text-muted-foreground font-medium">Guard</th>
                          <th className="text-left py-2 px-3 text-muted-foreground font-medium">Date</th>
                          <th className="text-right py-2 px-3 text-muted-foreground font-medium">Hours</th>
                          <th className="text-right py-2 px-3 text-muted-foreground font-medium">Rate</th>
                          <th className="text-right py-2 px-3 text-muted-foreground font-medium">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lineItems.map(li => (
                          <tr key={li.id} className="border-b border-border/50">
                            <td className="py-2 px-3 text-foreground">{li.guard_name}</td>
                            <td className="py-2 px-3 text-muted-foreground">{li.shift_date}</td>
                            <td className="py-2 px-3 text-right font-mono text-foreground">{li.hours}</td>
                            <td className="py-2 px-3 text-right font-mono text-muted-foreground">{formatCurrency(li.rate)}</td>
                            <td className="py-2 px-3 text-right font-mono text-foreground">{formatCurrency(li.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Totals */}
                <div className="space-y-1.5 text-sm border-t border-border pt-3">
                  <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-mono text-foreground">{formatCurrency(selectedInvoice.subtotal)}</span></div>
                  {selectedInvoice.tax_rate > 0 && (
                    <div className="flex justify-between"><span className="text-muted-foreground">Tax ({selectedInvoice.tax_rate}%)</span><span className="font-mono text-foreground">{formatCurrency(selectedInvoice.tax_amount)}</span></div>
                  )}
                  <div className="flex justify-between font-semibold text-base border-t border-border pt-2">
                    <span className="text-foreground">Total</span>
                    <span className="font-mono text-foreground">{formatCurrency(selectedInvoice.total)} XCD</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2 border-t border-border">
                  {selectedInvoice.status === "draft" && (
                    <Button size="sm" onClick={() => updateInvoiceStatus(selectedInvoice.id, "sent")}>Mark as Sent</Button>
                  )}
                  {selectedInvoice.status === "sent" && (
                    <>
                      <Button size="sm" onClick={() => updateInvoiceStatus(selectedInvoice.id, "paid")}>Mark as Paid</Button>
                      <Button size="sm" variant="destructive" onClick={() => updateInvoiceStatus(selectedInvoice.id, "overdue")}>Mark Overdue</Button>
                    </>
                  )}
                  {selectedInvoice.status === "overdue" && (
                    <Button size="sm" onClick={() => updateInvoiceStatus(selectedInvoice.id, "paid")}>Mark as Paid</Button>
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
