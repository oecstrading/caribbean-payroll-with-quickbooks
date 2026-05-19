import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Link2, Link2Off, RefreshCw, CheckCircle2, AlertCircle, Eye, Send,
  Settings as SettingsIcon, Users as UsersIcon, BookOpen,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/payroll-engine";

interface QboConn {
  id?: string;
  status: string;
  environment: string;
  realm_id?: string | null;
  company_name?: string | null;
  connected_at?: string | null;
}

interface Mapping {
  id: string;
  payroll_item: string;
  qbo_account_id: string;
  qbo_account_name: string;
  account_type: string;
}

interface PayrollRun {
  id: string;
  period: string;
  run_date: string;
  total_gross: number;
  total_net: number;
  employee_count: number;
  status: string;
}

interface SyncLog {
  id: string;
  payroll_run_id: string | null;
  qbo_entity_id: string;
  status: string;
  created_at: string;
  payload: any;
  response: any;
}

const PAYROLL_ITEM_LABELS: Record<string, string> = {
  gross_wages: "Gross Wages (Debit)",
  overtime: "Overtime Expense (Debit)",
  employer_nic: "Employer NIC Expense (Debit)",
  employee_nic_payable: "NIC Payable (Credit)",
  paye_payable: "PAYE Tax Payable (Credit)",
  net_pay_clearing: "Net Pay Clearing / Bank (Credit)",
  creditor_deductions: "Other Deductions Payable (Credit)",
};

export default function QuickBooksPage() {
  const { isAdmin, isManager } = useRole();
  const canManage = isAdmin || isManager;

  const [conn, setConn] = useState<QboConn>({ status: "disconnected", environment: "sandbox" });
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);

  const load = async () => {
    setLoading(true);
    const [c, m, r, l] = await Promise.all([
      supabase.from("qbo_connection").select("*").limit(1).maybeSingle(),
      supabase.from("qbo_account_mappings").select("*").order("payroll_item"),
      supabase.from("payroll_runs").select("*").order("run_date", { ascending: false }).limit(20),
      supabase.from("qbo_sync_log").select("*").order("created_at", { ascending: false }).limit(20),
    ]);
    if (c.data) setConn(c.data as any);
    setMappings((m.data ?? []) as any);
    setRuns((r.data ?? []) as any);
    setLogs((l.data ?? []) as any);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const connectSandbox = async () => {
    setBusy(true);
    const payload = {
      status: "connected",
      environment: "sandbox",
      realm_id: `SANDBOX-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
      company_name: "Sandbox Demo Co.",
      connected_at: new Date().toISOString(),
    };
    const { error } = conn.id
      ? await supabase.from("qbo_connection").update(payload).eq("id", conn.id)
      : await supabase.from("qbo_connection").insert(payload);
    if (error) toast.error(error.message);
    else { toast.success("Connected to QuickBooks Sandbox"); await load(); }
    setBusy(false);
  };

  const disconnect = async () => {
    if (!conn.id) return;
    setBusy(true);
    const { error } = await supabase.from("qbo_connection").update({
      status: "disconnected", realm_id: null, access_token: null, refresh_token: null,
    }).eq("id", conn.id);
    if (error) toast.error(error.message); else { toast.success("Disconnected"); await load(); }
    setBusy(false);
  };

  const updateMapping = async (id: string, field: keyof Mapping, value: string) => {
    setMappings((prev) => prev.map((m) => (m.id === id ? { ...m, [field]: value } : m)));
    await supabase.from("qbo_account_mappings").update({ [field]: value }).eq("id", id);
  };

  const runSync = async (runId: string, action: "preview" | "sync") => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("qbo-sync", {
        body: { payroll_run_id: runId, action },
      });
      if (error) throw error;
      if (action === "preview") {
        setPreviewData(data);
        setPreviewOpen(true);
      } else {
        toast.success(`Journal Entry synced (${data?.response?.mode || "sandbox"})`);
      }
      await load();
    } catch (e: any) {
      toast.error(e.message || "Sync failed");
    }
    setBusy(false);
  };

  if (!canManage) {
    return <div className="p-6 text-muted-foreground">Admin/Manager access required.</div>;
  }

  const isConnected = conn.status === "connected";

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <BookOpen className="text-primary" /> QuickBooks Online
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Sync payroll journal entries, employees and chart-of-account mappings to QBO.
          </p>
        </div>
        <Badge variant={isConnected ? "default" : "secondary"} className="text-sm">
          {isConnected ? <CheckCircle2 size={14} className="mr-1" /> : <AlertCircle size={14} className="mr-1" />}
          {isConnected ? `Connected · ${conn.environment}` : "Not connected"}
        </Badge>
      </div>

      <Tabs defaultValue="connection" className="w-full">
        <TabsList className="grid grid-cols-4 w-full max-w-2xl">
          <TabsTrigger value="connection"><Link2 size={14} className="mr-1" />Connection</TabsTrigger>
          <TabsTrigger value="mapping"><SettingsIcon size={14} className="mr-1" />COA Mapping</TabsTrigger>
          <TabsTrigger value="sync"><Send size={14} className="mr-1" />Sync Runs</TabsTrigger>
          <TabsTrigger value="log"><RefreshCw size={14} className="mr-1" />Log</TabsTrigger>
        </TabsList>

        <TabsContent value="connection" className="mt-4">
          <Card>
            <CardHeader><CardTitle>QuickBooks Online Connection</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div><Label>Status</Label><Input value={conn.status} disabled /></div>
                <div><Label>Environment</Label><Input value={conn.environment} disabled /></div>
                <div><Label>Realm ID</Label><Input value={conn.realm_id ?? ""} disabled /></div>
                <div><Label>QBO Company</Label><Input value={conn.company_name ?? ""} disabled /></div>
              </div>
              <div className="flex gap-2 pt-2">
                {!isConnected ? (
                  <Button onClick={connectSandbox} disabled={busy}>
                    <Link2 size={16} className="mr-2" /> Connect Sandbox (Demo)
                  </Button>
                ) : (
                  <Button variant="destructive" onClick={disconnect} disabled={busy}>
                    <Link2Off size={16} className="mr-2" /> Disconnect
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground pt-2 border-t">
                <strong>Demo mode:</strong> generates a fake realm ID and simulates pushes to QBO. To go live,
                add Intuit OAuth (QBO_CLIENT_ID / QBO_CLIENT_SECRET) and switch environment to <code>production</code>.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mapping" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Chart of Accounts Mapping</CardTitle>
              <p className="text-sm text-muted-foreground">
                Map each payroll posting item to a QuickBooks account. IDs match the AccountRef.value in JE lines.
              </p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/50">
                    <tr>
                      <th className="text-left p-2">Payroll Item</th>
                      <th className="text-left p-2">QBO Account Name</th>
                      <th className="text-left p-2">QBO Account ID</th>
                      <th className="text-left p-2">Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mappings.map((m) => (
                      <tr key={m.id} className="border-b border-border/50">
                        <td className="p-2 font-medium">
                          {PAYROLL_ITEM_LABELS[m.payroll_item] || m.payroll_item}
                        </td>
                        <td className="p-2"><Input value={m.qbo_account_name}
                          onChange={(e) => updateMapping(m.id, "qbo_account_name", e.target.value)} /></td>
                        <td className="p-2"><Input value={m.qbo_account_id} placeholder="e.g. 73"
                          onChange={(e) => updateMapping(m.id, "qbo_account_id", e.target.value)} /></td>
                        <td className="p-2"><Input value={m.account_type}
                          onChange={(e) => updateMapping(m.id, "account_type", e.target.value)} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sync" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Payroll Runs → QuickBooks</CardTitle></CardHeader>
            <CardContent>
              {runs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No payroll runs yet. Process a run first.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-secondary/50">
                      <tr>
                        <th className="text-left p-2">Period</th>
                        <th className="text-left p-2">Run Date</th>
                        <th className="text-right p-2">Employees</th>
                        <th className="text-right p-2">Gross</th>
                        <th className="text-right p-2">Net</th>
                        <th className="text-right p-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {runs.map((r) => (
                        <motion.tr key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                          className="border-b border-border/50">
                          <td className="p-2 font-medium">{r.period}</td>
                          <td className="p-2">{r.run_date}</td>
                          <td className="p-2 text-right">{r.employee_count}</td>
                          <td className="p-2 text-right font-mono">{formatCurrency(Number(r.total_gross))}</td>
                          <td className="p-2 text-right font-mono">{formatCurrency(Number(r.total_net))}</td>
                          <td className="p-2 text-right space-x-2">
                            <Button size="sm" variant="outline" disabled={busy}
                              onClick={() => runSync(r.id, "preview")}>
                              <Eye size={14} className="mr-1" /> Preview JE
                            </Button>
                            <Button size="sm" disabled={busy}
                              onClick={() => runSync(r.id, "sync")}>
                              <Send size={14} className="mr-1" /> Sync
                            </Button>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="log" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Sync History</CardTitle></CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No syncs yet.</p>
              ) : (
                <div className="space-y-2">
                  {logs.map((l) => (
                    <div key={l.id} className="border border-border/50 rounded-lg p-3 flex items-center justify-between">
                      <div>
                        <div className="font-mono text-xs">{l.qbo_entity_id || "(preview)"}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(l.created_at).toLocaleString()} · run {l.payroll_run_id?.slice(0, 8)}
                        </div>
                      </div>
                      <Badge variant={l.status.startsWith("synced") ? "default" : "secondary"}>{l.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Journal Entry Preview</DialogTitle></DialogHeader>
          <pre className="text-xs bg-secondary/40 p-4 rounded-lg overflow-x-auto">
            {JSON.stringify(previewData?.payload, null, 2)}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}
