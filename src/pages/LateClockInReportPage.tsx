import { useState, useEffect, useMemo } from "react";
import { format, startOfWeek, endOfWeek, subWeeks, eachDayOfInterval } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line } from "recharts";
import { FileDown, Clock, AlertTriangle, MapPin, TrendingUp, CalendarDays } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { downloadPDF, downloadCSV } from "@/lib/export-utils";
import { toast } from "sonner";

interface LateAlert {
  id: string;
  user_id: string;
  site_id: string;
  shift_date: string;
  shift_start: string;
  late_minutes: number;
  clock_in_at: string | null;
  alert_sent_at: string;
}

interface Profile {
  user_id: string;
  first_name: string;
  last_name: string;
}

interface Site {
  id: string;
  name: string;
}

export default function LateClockInReportPage() {
  const [alerts, setAlerts] = useState<LateAlert[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);
  const [filterSite, setFilterSite] = useState<string>("all");
  const [filterGuard, setFilterGuard] = useState<string>("all");

  const weekStart = startOfWeek(subWeeks(new Date(), weekOffset), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  const weekLabel = `${format(weekStart, "MMM d")} – ${format(weekEnd, "MMM d, yyyy")}`;

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const startStr = format(weekStart, "yyyy-MM-dd");
      const endStr = format(weekEnd, "yyyy-MM-dd");

      const [alertsRes, profilesRes, sitesRes] = await Promise.all([
        supabase
          .from("late_clock_in_alerts")
          .select("*")
          .gte("shift_date", startStr)
          .lte("shift_date", endStr)
          .order("shift_date", { ascending: true }),
        supabase.from("profiles").select("user_id, first_name, last_name"),
        supabase.from("client_sites").select("id, name"),
      ]);

      setAlerts((alertsRes.data as LateAlert[]) || []);
      setProfiles((profilesRes.data as Profile[]) || []);
      setSites((sitesRes.data as Site[]) || []);
      setLoading(false);
    };
    fetchData();
  }, [weekOffset]);

  const getName = (uid: string) => {
    const p = profiles.find((pr) => pr.user_id === uid);
    return p ? `${p.first_name} ${p.last_name}` : "Unknown";
  };

  const getSiteName = (sid: string) => sites.find((s) => s.id === sid)?.name || "Unknown";

  const filtered = useMemo(() => {
    let data = alerts;
    if (filterSite !== "all") data = data.filter((a) => a.site_id === filterSite);
    if (filterGuard !== "all") data = data.filter((a) => a.user_id === filterGuard);
    return data;
  }, [alerts, filterSite, filterGuard]);

  // Per-day trend
  const dailyTrend = useMemo(() => {
    const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
    return days.map((day) => {
      const dayStr = format(day, "yyyy-MM-dd");
      const dayAlerts = filtered.filter((a) => a.shift_date === dayStr);
      return {
        day: format(day, "EEE"),
        date: dayStr,
        count: dayAlerts.length,
        avgMinutes: dayAlerts.length > 0 ? Math.round(dayAlerts.reduce((s, a) => s + a.late_minutes, 0) / dayAlerts.length) : 0,
        noShows: dayAlerts.filter((a) => !a.clock_in_at).length,
      };
    });
  }, [filtered, weekStart, weekEnd]);

  // Per-guard summary
  const guardSummary = useMemo(() => {
    const map = new Map<string, { count: number; totalMin: number; noShows: number }>();
    filtered.forEach((a) => {
      const cur = map.get(a.user_id) || { count: 0, totalMin: 0, noShows: 0 };
      cur.count++;
      cur.totalMin += a.late_minutes;
      if (!a.clock_in_at) cur.noShows++;
      map.set(a.user_id, cur);
    });
    return Array.from(map.entries())
      .map(([uid, stats]) => ({ uid, name: getName(uid), ...stats, avg: Math.round(stats.totalMin / stats.count) }))
      .sort((a, b) => b.count - a.count);
  }, [filtered, profiles]);

  // Per-site summary
  const siteSummary = useMemo(() => {
    const map = new Map<string, { count: number; totalMin: number; noShows: number }>();
    filtered.forEach((a) => {
      const cur = map.get(a.site_id) || { count: 0, totalMin: 0, noShows: 0 };
      cur.count++;
      cur.totalMin += a.late_minutes;
      if (!a.clock_in_at) cur.noShows++;
      map.set(a.site_id, cur);
    });
    return Array.from(map.entries())
      .map(([sid, stats]) => ({ sid, name: getSiteName(sid), ...stats, avg: Math.round(stats.totalMin / stats.count) }))
      .sort((a, b) => b.count - a.count);
  }, [filtered, sites]);

  const totalIncidents = filtered.length;
  const totalNoShows = filtered.filter((a) => !a.clock_in_at).length;
  const avgLate = totalIncidents > 0 ? Math.round(filtered.reduce((s, a) => s + a.late_minutes, 0) / totalIncidents) : 0;
  const uniqueGuards = new Set(filtered.map((a) => a.user_id)).size;

  const handleExportPDF = () => {
    const headers = ["Date", "Guard", "Site", "Shift Start", "Late (min)", "Status"];
    const rows = filtered.map((a) => [
      a.shift_date,
      getName(a.user_id),
      getSiteName(a.site_id),
      a.shift_start,
      a.late_minutes,
      a.clock_in_at ? "Late" : "No Show",
    ]);
    const summaryRows = [
      { label: "Total Incidents", value: String(totalIncidents) },
      { label: "No-Shows", value: String(totalNoShows) },
      { label: "Avg. Late Minutes", value: String(avgLate) },
      { label: "Guards Affected", value: String(uniqueGuards) },
    ];
    downloadPDF(`late-clockin-report-${format(weekStart, "yyyy-MM-dd")}`, `Late Clock-In Report — ${weekLabel}`, headers, rows, {
      subtitle: "Weekly Management Review",
      summaryRows,
      orientation: "landscape",
    });
    toast.success("PDF exported");
  };

  const handleExportCSV = () => {
    const headers = ["Date", "Guard", "Site", "Shift Start", "Late Minutes", "Clock In At", "Status"];
    const rows = filtered.map((a) => [
      a.shift_date,
      getName(a.user_id),
      getSiteName(a.site_id),
      a.shift_start,
      a.late_minutes,
      a.clock_in_at || "N/A",
      a.clock_in_at ? "Late" : "No Show",
    ]);
    downloadCSV(`late-clockin-report-${format(weekStart, "yyyy-MM-dd")}`, headers, rows);
    toast.success("CSV exported");
  };

  const chartConfig = {
    count: { label: "Incidents", color: "hsl(var(--destructive))" },
    avgMinutes: { label: "Avg Late (min)", color: "hsl(var(--primary))" },
  };

  const uniqueGuardIds = [...new Set(alerts.map((a) => a.user_id))];
  const uniqueSiteIds = [...new Set(alerts.map((a) => a.site_id))];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Late Clock-In Report</h1>
          <p className="text-muted-foreground text-sm">Weekly trends per guard and per site</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <FileDown className="w-4 h-4 mr-1" /> CSV
          </Button>
          <Button size="sm" onClick={handleExportPDF}>
            <FileDown className="w-4 h-4 mr-1" /> Export PDF
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-muted-foreground" />
          <Button variant="outline" size="sm" onClick={() => setWeekOffset((w) => w + 1)}>← Prev</Button>
          <span className="text-sm font-medium min-w-[180px] text-center">{weekLabel}</span>
          <Button variant="outline" size="sm" onClick={() => setWeekOffset((w) => Math.max(0, w - 1))} disabled={weekOffset === 0}>Next →</Button>
        </div>
        <Select value={filterSite} onValueChange={setFilterSite}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Sites" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sites</SelectItem>
            {uniqueSiteIds.map((sid) => (
              <SelectItem key={sid} value={sid}>{getSiteName(sid)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterGuard} onValueChange={setFilterGuard}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Guards" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Guards</SelectItem>
            {uniqueGuardIds.map((uid) => (
              <SelectItem key={uid} value={uid}>{getName(uid)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/10"><AlertTriangle className="w-5 h-5 text-destructive" /></div>
            <div>
              <p className="text-2xl font-bold text-foreground">{totalIncidents}</p>
              <p className="text-xs text-muted-foreground">Total Incidents</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-500/10"><Clock className="w-5 h-5 text-orange-500" /></div>
            <div>
              <p className="text-2xl font-bold text-foreground">{avgLate} min</p>
              <p className="text-xs text-muted-foreground">Avg. Late</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/10"><TrendingUp className="w-5 h-5 text-destructive" /></div>
            <div>
              <p className="text-2xl font-bold text-foreground">{totalNoShows}</p>
              <p className="text-xs text-muted-foreground">No-Shows</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><MapPin className="w-5 h-5 text-primary" /></div>
            <div>
              <p className="text-2xl font-bold text-foreground">{uniqueGuards}</p>
              <p className="text-xs text-muted-foreground">Guards Affected</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Daily Incidents</CardTitle>
            <CardDescription>Late arrivals & no-shows per day</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[220px] w-full">
              <BarChart data={dailyTrend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="day" className="text-xs" />
                <YAxis allowDecimals={false} className="text-xs" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Avg. Late Minutes</CardTitle>
            <CardDescription>Average delay trend through the week</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[220px] w-full">
              <LineChart data={dailyTrend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="day" className="text-xs" />
                <YAxis className="text-xs" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line type="monotone" dataKey="avgMinutes" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Per-Guard & Per-Site Tables */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">By Guard</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Guard</TableHead>
                  <TableHead className="text-right">Incidents</TableHead>
                  <TableHead className="text-right">Avg (min)</TableHead>
                  <TableHead className="text-right">No-Shows</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {guardSummary.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">No incidents this week</TableCell></TableRow>
                ) : guardSummary.map((g) => (
                  <TableRow key={g.uid}>
                    <TableCell className="font-medium">{g.name}</TableCell>
                    <TableCell className="text-right"><Badge variant="destructive">{g.count}</Badge></TableCell>
                    <TableCell className="text-right">{g.avg}</TableCell>
                    <TableCell className="text-right">{g.noShows > 0 ? <Badge variant="outline" className="text-destructive border-destructive">{g.noShows}</Badge> : "0"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">By Site</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Site</TableHead>
                  <TableHead className="text-right">Incidents</TableHead>
                  <TableHead className="text-right">Avg (min)</TableHead>
                  <TableHead className="text-right">No-Shows</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {siteSummary.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">No incidents this week</TableCell></TableRow>
                ) : siteSummary.map((s) => (
                  <TableRow key={s.sid}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-right"><Badge variant="destructive">{s.count}</Badge></TableCell>
                    <TableCell className="text-right">{s.avg}</TableCell>
                    <TableCell className="text-right">{s.noShows > 0 ? <Badge variant="outline" className="text-destructive border-destructive">{s.noShows}</Badge> : "0"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Log */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Detailed Log</CardTitle>
          <CardDescription>{filtered.length} records for {weekLabel}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Guard</TableHead>
                <TableHead>Site</TableHead>
                <TableHead>Shift Start</TableHead>
                <TableHead className="text-right">Late (min)</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No late clock-ins this week 🎉</TableCell></TableRow>
              ) : filtered.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>{format(new Date(a.shift_date), "EEE, MMM d")}</TableCell>
                  <TableCell className="font-medium">{getName(a.user_id)}</TableCell>
                  <TableCell>{getSiteName(a.site_id)}</TableCell>
                  <TableCell>{a.shift_start}</TableCell>
                  <TableCell className="text-right font-mono">{a.late_minutes}</TableCell>
                  <TableCell>
                    {a.clock_in_at ? (
                      <Badge variant="outline" className="text-orange-600 border-orange-400">Late</Badge>
                    ) : (
                      <Badge variant="destructive">No Show</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
