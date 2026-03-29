import { useState, useEffect, useMemo } from "react";
import { Users, TrendingUp, Clock, AlertTriangle, Star, Award, FileDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { downloadPDF, downloadCSV } from "@/lib/export-utils";
import { toast } from "sonner";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";

interface GuardScore {
  userId: string;
  name: string;
  department: string;
  punctuality: number;     // % on-time clock-ins
  attendance: number;      // % shifts attended
  patrolCompletion: number; // % patrols completed
  incidentReporting: number; // responsiveness
  overallScore: number;
  lateCount: number;
  totalShifts: number;
  patrolCount: number;
}

export default function GuardPerformancePage() {
  const [scores, setScores] = useState<GuardScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("30");
  const [sortBy, setSortBy] = useState<"overallScore" | "punctuality" | "attendance">("overallScore");

  useEffect(() => {
    fetchPerformance();
  }, [period]);

  const fetchPerformance = async () => {
    setLoading(true);
    const since = format(subDays(new Date(), parseInt(period)), "yyyy-MM-dd");

    const [profilesRes, assignmentsRes, punchesRes, lateRes, patrolRes] = await Promise.all([
      supabase.from("profiles").select("user_id, first_name, last_name, department"),
      supabase.from("guard_assignments").select("*").eq("is_active", true),
      supabase.from("clock_punches").select("user_id, punch_type, punched_at, within_geofence").gte("punched_at", since),
      supabase.from("late_clock_in_alerts").select("user_id, late_minutes").gte("shift_date", since),
      supabase.from("patrol_logs").select("user_id").gte("scanned_at", since),
    ]);

    const profiles = profilesRes.data || [];
    const assignments = assignmentsRes.data || [];
    const punches = punchesRes.data || [];
    const lateAlerts = lateRes.data || [];
    const patrols = patrolRes.data || [];

    const guardIds = [...new Set(assignments.map((a: any) => a.user_id))];
    const days = parseInt(period);

    const guardScores: GuardScore[] = guardIds.map((uid) => {
      const prof = profiles.find((p: any) => p.user_id === uid);
      const guardPunches = punches.filter((p: any) => p.user_id === uid && p.punch_type === "clock_in");
      const guardLate = lateAlerts.filter((l: any) => l.user_id === uid);
      const guardPatrols = patrols.filter((p: any) => p.user_id === uid);
      const guardAssignments = assignments.filter((a: any) => a.user_id === uid);

      const expectedShifts = guardAssignments.length * Math.ceil(days / 7);
      const actualShifts = guardPunches.length;
      const attendance = expectedShifts > 0 ? Math.min(100, Math.round((actualShifts / expectedShifts) * 100)) : 100;
      const punctuality = actualShifts > 0 ? Math.round(((actualShifts - guardLate.length) / actualShifts) * 100) : 100;
      const patrolCompletion = Math.min(100, guardPatrols.length > 0 ? Math.round((guardPatrols.length / Math.max(1, expectedShifts * 2)) * 100) : 0);
      const incidentReporting = 80; // base score

      const overallScore = Math.round(punctuality * 0.35 + attendance * 0.30 + patrolCompletion * 0.20 + incidentReporting * 0.15);

      return {
        userId: uid as string,
        name: prof ? `${(prof as any).first_name} ${(prof as any).last_name}` : "Unknown",
        department: (prof as any)?.department || "",
        punctuality,
        attendance,
        patrolCompletion,
        incidentReporting,
        overallScore,
        lateCount: guardLate.length,
        totalShifts: actualShifts,
        patrolCount: guardPatrols.length,
      };
    });

    setScores(guardScores.sort((a, b) => b.overallScore - a.overallScore));
    setLoading(false);
  };

  const sorted = useMemo(() => [...scores].sort((a, b) => b[sortBy] - a[sortBy]), [scores, sortBy]);

  const avgScore = scores.length > 0 ? Math.round(scores.reduce((s, g) => s + g.overallScore, 0) / scores.length) : 0;
  const topPerformers = scores.filter((g) => g.overallScore >= 85).length;
  const needsImprovement = scores.filter((g) => g.overallScore < 60).length;

  const chartData = sorted.slice(0, 10).map((g) => ({
    name: g.name.split(" ")[0],
    score: g.overallScore,
  }));

  const getScoreBadge = (score: number) => {
    if (score >= 85) return <Badge className="bg-primary/10 text-primary border-primary/20">Excellent</Badge>;
    if (score >= 70) return <Badge variant="secondary">Good</Badge>;
    if (score >= 60) return <Badge variant="outline">Fair</Badge>;
    return <Badge variant="destructive">Needs Work</Badge>;
  };

  const handleExport = () => {
    const headers = ["Guard", "Overall", "Punctuality", "Attendance", "Patrols", "Late Count", "Shifts"];
    const rows = sorted.map((g) => [g.name, g.overallScore, g.punctuality, g.attendance, g.patrolCompletion, g.lateCount, g.totalShifts]);
    downloadPDF("guard-performance", "Guard Performance Report", headers, rows, {
      subtitle: `Last ${period} days`,
      summaryRows: [
        { label: "Avg Score", value: String(avgScore) },
        { label: "Top Performers", value: String(topPerformers) },
      ],
    });
    toast.success("Report exported");
  };

  const chartConfig = { score: { label: "Score", color: "hsl(var(--primary))" } };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-display font-bold text-foreground">Guard Performance</h1>
          <p className="text-sm text-muted-foreground">Analytics & scoring for security personnel</p>
        </div>
        <div className="flex gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" onClick={handleExport}><FileDown className="w-4 h-4 mr-1" /> Export</Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10"><Star className="w-5 h-5 text-primary" /></div>
          <div><p className="text-2xl font-bold text-foreground">{avgScore}%</p><p className="text-xs text-muted-foreground">Avg Score</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10"><Award className="w-5 h-5 text-primary" /></div>
          <div><p className="text-2xl font-bold text-foreground">{topPerformers}</p><p className="text-xs text-muted-foreground">Top Performers</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-destructive/10"><AlertTriangle className="w-5 h-5 text-destructive" /></div>
          <div><p className="text-2xl font-bold text-foreground">{needsImprovement}</p><p className="text-xs text-muted-foreground">Needs Work</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-muted"><Users className="w-5 h-5 text-muted-foreground" /></div>
          <div><p className="text-2xl font-bold text-foreground">{scores.length}</p><p className="text-xs text-muted-foreground">Guards Tracked</p></div>
        </CardContent></Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Top 10 Guards by Score</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[200px] w-full">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="name" className="text-xs" />
              <YAxis domain={[0, 100]} className="text-xs" />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="score" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base">All Guards</CardTitle>
          <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="overallScore">Overall Score</SelectItem>
              <SelectItem value="punctuality">Punctuality</SelectItem>
              <SelectItem value="attendance">Attendance</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Guard</TableHead>
                <TableHead className="text-right">Overall</TableHead>
                <TableHead className="text-right">Punctuality</TableHead>
                <TableHead className="text-right">Attendance</TableHead>
                <TableHead className="text-right">Patrols</TableHead>
                <TableHead>Rating</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : sorted.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No guard assignments found</TableCell></TableRow>
              ) : sorted.map((g, i) => (
                <TableRow key={g.userId}>
                  <TableCell className="font-mono text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="font-medium">{g.name}</TableCell>
                  <TableCell className="text-right font-bold">{g.overallScore}%</TableCell>
                  <TableCell className="text-right">{g.punctuality}%</TableCell>
                  <TableCell className="text-right">{g.attendance}%</TableCell>
                  <TableCell className="text-right">{g.patrolCompletion}%</TableCell>
                  <TableCell>{getScoreBadge(g.overallScore)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
