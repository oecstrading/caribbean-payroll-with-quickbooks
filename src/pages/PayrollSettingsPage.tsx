import { useEffect, useState, useMemo } from "react";
import { Link2, RefreshCw, Wand2, Sparkles, CheckCircle2, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import { toast } from "sonner";
import { PAYROLL_ITEMS as ITEM_LABELS } from "@/lib/qbo-items";

interface Mapping {
  id: string;
  payroll_item: string;
  qbo_account_id: string;
  qbo_account_name: string;
  account_type: string;
  description: string;
  category: string;
}

interface Account {
  id: string;
  qbo_account_id: string;
  account_name: string;
  account_type: string;
  account_subtype: string | null;
}


const SECTIONS: { title: string; categories: string[]; tint: string }[] = [
  { title: "Earnings & Premium Pay", categories: ["expense"], tint: "from-emerald-500/10 to-teal-500/5" },
  { title: "Statutory & Benefits Liabilities", categories: ["liability"], tint: "from-amber-500/10 to-orange-500/5" },
  { title: "Assets & Bank", categories: ["asset", "bank"], tint: "from-sky-500/10 to-blue-500/5" },
];

export default function PayrollSettingsPage() {
  const { isAdmin, isManager } = useRole();
  const canManage = isAdmin || isManager;

  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const [m, a] = await Promise.all([
      supabase.from("qbo_account_mappings").select("*").order("payroll_item"),
      supabase.from("qbo_chart_of_accounts").select("*").eq("active", true).order("account_name"),
    ]);
    setMappings((m.data ?? []) as any);
    setAccounts((a.data ?? []) as any);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const accountsByType = useMemo(() => {
    const groups: Record<string, Account[]> = {};
    accounts.forEach((a) => {
      const k = a.account_type;
      (groups[k] ||= []).push(a);
    });
    return groups;
  }, [accounts]);

  const stats = useMemo(() => {
    const total = mappings.length;
    const mapped = mappings.filter((m) => m.qbo_account_id).length;
    return { total, mapped, pct: total ? Math.round((mapped / total) * 100) : 0 };
  }, [mappings]);

  const updateMapping = async (m: Mapping, accountId: string) => {
    const acc = accounts.find((a) => a.qbo_account_id === accountId);
    setMappings((prev) => prev.map((x) => x.id === m.id ? {
      ...x,
      qbo_account_id: acc?.qbo_account_id ?? "",
      qbo_account_name: acc?.account_name ?? "",
      account_type: acc?.account_type ?? x.account_type,
    } : x));
    await supabase.from("qbo_account_mappings").update({
      qbo_account_id: acc?.qbo_account_id ?? "",
      qbo_account_name: acc?.account_name ?? "",
      account_type: acc?.account_type ?? m.account_type,
    }).eq("id", m.id);
  };

  const autoMap = async () => {
    setBusy(true);
    const tokenize = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
    const score = (a: string[], b: string[]) =>
      a.filter((t) => b.includes(t)).length / Math.max(a.length, b.length, 1);

    const updates: { id: string; qbo_account_id: string; qbo_account_name: string; account_type: string }[] = [];
    mappings.forEach((m) => {
      if (m.qbo_account_id) return;
      const target = tokenize(`${ITEM_LABELS[m.payroll_item] || m.payroll_item} ${m.qbo_account_name}`);
      let best: Account | null = null;
      let bestScore = 0.25;
      accounts.forEach((a) => {
        const s = score(target, tokenize(a.account_name));
        if (s > bestScore) { best = a; bestScore = s; }
      });
      if (best) updates.push({
        id: m.id,
        qbo_account_id: best.qbo_account_id,
        qbo_account_name: best.account_name,
        account_type: best.account_type,
      });
    });

    for (const u of updates) {
      await supabase.from("qbo_account_mappings").update({
        qbo_account_id: u.qbo_account_id,
        qbo_account_name: u.qbo_account_name,
        account_type: u.account_type,
      }).eq("id", u.id);
    }
    toast.success(`Auto-mapped ${updates.length} payroll items`);
    await load();
    setBusy(false);
  };

  const createMissing = async () => {
    setBusy(true);
    const missing = mappings.filter((m) => !m.qbo_account_id);
    const rows = missing.map((m) => ({
      qbo_account_id: `NEW-${m.payroll_item.toUpperCase().slice(0, 12)}`,
      account_name: m.qbo_account_name || ITEM_LABELS[m.payroll_item] || m.payroll_item,
      account_type: m.account_type,
      account_subtype: "PayrollExpenses",
      source: "created",
    }));
    if (rows.length === 0) {
      toast.info("No missing accounts");
      setBusy(false);
      return;
    }
    const { data, error } = await supabase.from("qbo_chart_of_accounts").insert(rows).select();
    if (error) { toast.error(error.message); setBusy(false); return; }

    // Link each missing mapping to its newly created account
    for (let i = 0; i < missing.length; i++) {
      const acc = data?.[i];
      if (!acc) continue;
      await supabase.from("qbo_account_mappings").update({
        qbo_account_id: acc.qbo_account_id,
        qbo_account_name: acc.account_name,
        account_type: acc.account_type,
      }).eq("id", missing[i].id);
    }
    toast.success(`Created ${rows.length} accounts and linked them`);
    await load();
    setBusy(false);
  };

  if (!canManage) {
    return <div className="p-6 text-muted-foreground">Admin/Manager access required.</div>;
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="p-5 flex items-start gap-4">
          <div className="p-2.5 rounded-lg bg-primary/10 text-primary"><Link2 size={20} /></div>
          <div className="flex-1">
            <h1 className="text-xl font-display font-bold">QuickBooks mappings</h1>
            <p className="text-sm text-muted-foreground">
              Link each payroll item to the matching QuickBooks account. Defaults cover typical OECS / Caribbean payroll items
              (NIC, PAYE, education & training levies, pension, health, allowances, gratuity, severance).
            </p>
          </div>
          <Badge variant={stats.pct === 100 ? "default" : "secondary"} className="text-xs">
            {stats.pct === 100
              ? <CheckCircle2 size={12} className="mr-1" />
              : <AlertCircle size={12} className="mr-1" />}
            {stats.mapped}/{stats.total} mapped ({stats.pct}%)
          </Badge>
        </CardContent>
      </Card>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={load} disabled={loading || busy}>
          <RefreshCw size={14} className={`mr-1.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
        <Button variant="outline" size="sm" onClick={createMissing} disabled={busy}>
          <Sparkles size={14} className="mr-1.5" /> Create missing accounts
        </Button>
        <Button variant="outline" size="sm" onClick={autoMap} disabled={busy}>
          <Wand2 size={14} className="mr-1.5" /> Auto-map by name
        </Button>
      </div>

      {/* Mapping sections */}
      <h2 className="text-base font-semibold">Payroll items → QuickBooks Chart of Accounts</h2>
      {SECTIONS.map((sec) => {
        const items = mappings.filter((m) => sec.categories.includes(m.category));
        if (items.length === 0) return null;
        return (
          <div key={sec.title} className="space-y-3">
            <div className={`rounded-lg bg-gradient-to-r ${sec.tint} px-3 py-2 text-sm font-medium`}>
              {sec.title}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
              {items.map((m) => (
                <div key={m.id} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold">
                      {ITEM_LABELS[m.payroll_item] || m.payroll_item}
                    </label>
                    {m.qbo_account_id && (
                      <Badge variant="outline" className="text-[10px] h-5">{m.account_type}</Badge>
                    )}
                  </div>
                  <Select value={m.qbo_account_id || undefined} onValueChange={(v) => updateMapping(m, v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a QuickBooks account…" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(accountsByType).map(([type, list]) => (
                        <div key={type}>
                          <div className="px-2 py-1 text-[10px] uppercase text-muted-foreground font-semibold">
                            {type}
                          </div>
                          {list.map((a) => (
                            <SelectItem key={a.id} value={a.qbo_account_id}>
                              {a.account_name} · {a.account_subtype || a.account_type}
                            </SelectItem>
                          ))}
                        </div>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">{m.description}</p>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <p className="text-xs text-muted-foreground border-t pt-4">
        Tip: <strong>Auto-map by name</strong> picks the closest QuickBooks account by name similarity for any unmapped
        item. <strong>Create missing accounts</strong> seeds a placeholder account in your chart for each unmapped item so
        you can finish the link in one click. When you connect a live QBO realm the chart of accounts will be replaced by
        accounts fetched from your company file.
      </p>
    </div>
  );
}
