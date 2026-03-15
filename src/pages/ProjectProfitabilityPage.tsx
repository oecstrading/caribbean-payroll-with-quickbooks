import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, DollarSign, Clock, Briefcase, Download, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/payroll-engine";
import { downloadCSV } from "@/lib/export-utils";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ProjectProfit {
  id: string;
  name: string;
  client_name: string;
  status: string;
  budget: number;
  laborHours: number;
  laborCost: number;
  contractorCost: number;
  totalCost: number;
  profit: number;
  margin: number;
}

export default function ProjectProfitabilityPage() {
  const [projects, setProjects] = useState<ProjectProfit[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "profitable" | "over-budget">("all");

  useEffect(() => {
    const fetchData = async () => {
      const [{ data: projectsData }, { data: timeLogs }, { data: payments }, { data: assignments }] = await Promise.all([
        supabase.from("projects").select("*"),
        supabase.from("project_time_logs").select("project_id, hours"),
        supabase.from("contractor_payments").select("project_id, amount, status"),
        supabase.from("project_assignments").select("project_id, hourly_rate"),
      ]);

      const avgRateByProject: Record<string, number> = {};
      (assignments || []).forEach((a) => {
        if (!avgRateByProject[a.project_id]) avgRateByProject[a.project_id] = Number(a.hourly_rate) || 25;
        else avgRateByProject[a.project_id] = (avgRateByProject[a.project_id] + (Number(a.hourly_rate) || 25)) / 2;
      });

      const hoursByProject: Record<string, number> = {};
      (timeLogs || []).forEach((t) => {
        hoursByProject[t.project_id] = (hoursByProject[t.project_id] || 0) + Number(t.hours);
      });

      const contractorByProject: Record<string, number> = {};
      (payments || []).forEach((p) => {
        if (p.project_id) {
          contractorByProject[p.project_id] = (contractorByProject[p.project_id] || 0) + Number(p.amount);
        }
      });

      const result: ProjectProfit[] = (projectsData || []).map((p) => {
        const laborHours = hoursByProject[p.id] || 0;
        const rate = avgRateByProject[p.id] || 25;
        const laborCost = laborHours * rate;
        const contractorCost = contractorByProject[p.id] || 0;
        const totalCost = laborCost + contractorCost;
        const budget = Number(p.budget) || 0;
        const profit = budget - totalCost;
        const margin = budget > 0 ? (profit / budget) * 100 : 0;

        return {
          id: p.id,
          name: p.name,
          client_name: p.client_name || "",
          status: p.status,
          budget,
          laborHours,
          laborCost,
          contractorCost,
          totalCost,
          profit,
          margin,
        };
      });

      setProjects(result.sort((a, b) => b.budget - a.budget));
      setLoading(false);
    };
    fetchData();
  }, []);

  const totals = projects.reduce(
    (acc, p) => ({
      budget: acc.budget + p.budget,
      totalCost: acc.totalCost + p.totalCost,
      laborCost: acc.laborCost + p.laborCost,
      contractorCost: acc.contractorCost + p.contractorCost,
      laborHours: acc.laborHours + p.laborHours,
    }),
    { budget: 0, totalCost: 0, laborCost: 0, contractorCost: 0, laborHours: 0 }
  );
  const totalProfit = totals.budget - totals.totalCost;
  const overallMargin = totals.budget > 0 ? (totalProfit / totals.budget) * 100 : 0;

  const filtered = projects.filter((p) => {
    if (filter === "profitable") return p.profit >= 0;
    if (filter === "over-budget") return p.profit < 0;
    return true;
  });

  const handleExport = () => {
    const headers = ["Project", "Client", "Status", "Budget", "Labor Hours", "Labor Cost", "Contractor Cost", "Total Cost", "Profit/Loss", "Margin %"];
    const rows = projects.map((p) => [
      p.name, p.client_name, p.status, p.budget.toFixed(2), p.laborHours.toFixed(1),
      p.laborCost.toFixed(2), p.contractorCost.toFixed(2), p.totalCost.toFixed(2),
      p.profit.toFixed(2), p.margin.toFixed(1),
    ]);
    downloadCSV("Project-Profitability-Report", headers, rows);
    toast.success("Report exported as CSV");
  };

  const summaryCards = [
    { label: "Total Budget", value: formatCurrency(totals.budget), icon: Briefcase, color: "text-primary", bg: "bg-primary/10" },
    { label: "Total Costs", value: formatCurrency(totals.totalCost), icon: DollarSign, color: "text-warning", bg: "bg-warning/10" },
    { label: "Net Profit", value: formatCurrency(totalProfit), icon: totalProfit >= 0 ? TrendingUp : TrendingDown, color: totalProfit >= 0 ? "text-success" : "text-destructive", bg: totalProfit >= 0 ? "bg-success/10" : "bg-destructive/10" },
    { label: "Total Hours", value: `${totals.laborHours.toFixed(0)}h`, icon: Clock, color: "text-accent-foreground", bg: "bg-accent/20" },
  ];

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4 md:space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-display font-bold text-foreground">Project Profitability</h1>
          <p className="text-sm text-muted-foreground mt-1">Budget vs actual labor & contractor costs per project</p>
        </div>
        <Button onClick={handleExport} variant="outline" className="gap-2">
          <Download size={16} /> Export CSV
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="shadow-card border-border/60">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`p-2 rounded-lg ${s.bg}`}><s.icon size={18} className={s.color} /></div>
                <div>
                  <p className="text-lg font-display font-bold text-foreground">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Overall Margin Bar */}
      <Card className="shadow-card border-border/60">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground">Overall Profit Margin</span>
            <span className={cn("text-sm font-bold", overallMargin >= 0 ? "text-success" : "text-destructive")}>
              {overallMargin.toFixed(1)}%
            </span>
          </div>
          <Progress value={Math.max(0, Math.min(100, overallMargin))} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>Costs: {formatCurrency(totals.totalCost)}</span>
            <span>Budget: {formatCurrency(totals.budget)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {(["all", "profitable", "over-budget"] as const).map((f) => (
          <Button key={f} variant={filter === f ? "default" : "outline"} size="sm"
            onClick={() => setFilter(f)} className="text-xs capitalize">
            {f === "all" ? `All (${projects.length})` : f === "profitable" ? `Profitable (${projects.filter(p => p.profit >= 0).length})` : `Over Budget (${projects.filter(p => p.profit < 0).length})`}
          </Button>
        ))}
      </div>

      {/* Project Breakdown Table */}
      <Card className="shadow-card border-border/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Project</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Budget</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Labor (hrs)</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Labor Cost</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Contractor</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Total Cost</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Profit/Loss</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Margin</th>
                <th className="text-center py-3 px-4 font-medium text-muted-foreground">Burn</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="py-8 text-center text-muted-foreground">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="py-8 text-center text-muted-foreground">No projects found</td></tr>
              ) : (
                filtered.map((p, i) => {
                  const burnPct = p.budget > 0 ? Math.min((p.totalCost / p.budget) * 100, 100) : 0;
                  return (
                    <motion.tr key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                      className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-medium text-foreground">{p.name}</div>
                        {p.client_name && <div className="text-xs text-muted-foreground">{p.client_name}</div>}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-foreground">{formatCurrency(p.budget)}</td>
                      <td className="py-3 px-4 text-right font-mono text-foreground">{p.laborHours.toFixed(1)}</td>
                      <td className="py-3 px-4 text-right font-mono text-foreground">{formatCurrency(p.laborCost)}</td>
                      <td className="py-3 px-4 text-right font-mono text-foreground">{formatCurrency(p.contractorCost)}</td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-foreground">{formatCurrency(p.totalCost)}</td>
                      <td className="py-3 px-4 text-right">
                        <span className={cn("font-mono font-semibold inline-flex items-center gap-1",
                          p.profit > 0 ? "text-success" : p.profit < 0 ? "text-destructive" : "text-muted-foreground")}>
                          {p.profit > 0 ? <ArrowUpRight size={12} /> : p.profit < 0 ? <ArrowDownRight size={12} /> : <Minus size={12} />}
                          {formatCurrency(Math.abs(p.profit))}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Badge variant="secondary" className={cn("text-[10px]",
                          p.margin >= 20 ? "bg-success/10 text-success" :
                          p.margin >= 0 ? "bg-warning/10 text-warning" :
                          "bg-destructive/10 text-destructive")}>
                          {p.margin.toFixed(1)}%
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="w-20 mx-auto">
                          <Progress value={burnPct} className={cn("h-1.5", burnPct > 90 ? "[&>div]:bg-destructive" : burnPct > 70 ? "[&>div]:bg-warning" : "")} />
                          <p className="text-[10px] text-muted-foreground text-center mt-0.5">{burnPct.toFixed(0)}%</p>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
            {!loading && filtered.length > 0 && (
              <tfoot>
                <tr className="bg-secondary/80 font-semibold">
                  <td className="py-3 px-4 text-foreground">Totals ({filtered.length} projects)</td>
                  <td className="py-3 px-4 text-right font-mono text-foreground">{formatCurrency(totals.budget)}</td>
                  <td className="py-3 px-4 text-right font-mono text-foreground">{totals.laborHours.toFixed(1)}</td>
                  <td className="py-3 px-4 text-right font-mono text-foreground">{formatCurrency(totals.laborCost)}</td>
                  <td className="py-3 px-4 text-right font-mono text-foreground">{formatCurrency(totals.contractorCost)}</td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-foreground">{formatCurrency(totals.totalCost)}</td>
                  <td className="py-3 px-4 text-right">
                    <span className={cn("font-mono font-bold", totalProfit >= 0 ? "text-success" : "text-destructive")}>
                      {formatCurrency(totalProfit)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <Badge variant="secondary" className={cn("text-[10px]", overallMargin >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>
                      {overallMargin.toFixed(1)}%
                    </Badge>
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>

      {/* Cost Breakdown */}
      {!loading && totals.totalCost > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="shadow-card border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-display">Cost Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: "Labor Costs", value: totals.laborCost, pct: (totals.laborCost / totals.totalCost) * 100, color: "bg-primary" },
                { label: "Contractor Costs", value: totals.contractorCost, pct: (totals.contractorCost / totals.totalCost) * 100, color: "bg-warning" },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="font-mono font-medium text-foreground">{formatCurrency(item.value)} ({item.pct.toFixed(0)}%)</span>
                  </div>
                  <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all", item.color)} style={{ width: `${item.pct}%` }} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="shadow-card border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-display">Budget Utilization</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Budget Spent</span>
                <span className="text-sm font-mono font-bold text-foreground">
                  {totals.budget > 0 ? ((totals.totalCost / totals.budget) * 100).toFixed(1) : 0}%
                </span>
              </div>
              <div className="w-full h-3 bg-secondary rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all",
                    totals.totalCost / totals.budget > 1 ? "bg-destructive" :
                    totals.totalCost / totals.budget > 0.8 ? "bg-warning" : "bg-success")}
                  style={{ width: `${Math.min((totals.totalCost / totals.budget) * 100, 100)}%` }}
                />
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="text-center p-3 rounded-lg bg-secondary/50">
                  <p className="text-lg font-display font-bold text-foreground">{formatCurrency(totals.budget - totals.totalCost)}</p>
                  <p className="text-xs text-muted-foreground">Remaining</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-secondary/50">
                  <p className="text-lg font-display font-bold text-foreground">{totals.laborHours.toFixed(0)}h</p>
                  <p className="text-xs text-muted-foreground">Hours Logged</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
