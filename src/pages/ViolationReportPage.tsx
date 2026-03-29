import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Download, Filter, Search, Calendar, MapPin, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import { useCompany } from "@/hooks/useCompany";
import { toast } from "sonner";

interface Violation {
  punch_id: string;
  shift_date: string;
  punched_at: string;
  user_id: string;
  punch_type: string;
  site_name: string | null;
  guard_lat: number | null;
  guard_lon: number | null;
  within_geofence: boolean | null;
  actual_distance_meters: number | null;
  allowed_radius: number | null;
  client_site_name: string | null;
  guard_name: string | null;
  guard_jurisdiction: string | null;
}

export default function ViolationReportPage() {
  const { isAdminOrManager } = useRole();
  const company = useCompany();
  const [violations, setViolations] = useState<Violation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateRange, setDateRange] = useState<"7" | "14" | "30" | "90">("7");
  const [filterJurisdiction, setFilterJurisdiction] = useState("all");
  const [jurisdictions, setJurisdictions] = useState<{ id: string; code: string; name: string }[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - parseInt(dateRange));

      const [violRes, jurRes] = await Promise.all([
        supabase
          .from("clock_punches")
          .select("id, punched_at, user_id, punch_type, latitude, longitude, within_geofence, address_label")
          .eq("within_geofence", false)
          .gte("punched_at", fromDate.toISOString())
          .order("punched_at", { ascending: false }),
        supabase.from("jurisdictions").select("id, code, name"),
      ]);

      // Enrich with profile data
      const userIds = [...new Set((violRes.data || []).map((v: any) => v.user_id))];
      let profMap: Record<string, { name: string; jurisdiction: string }> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, first_name, last_name, jurisdiction")
          .in("user_id", userIds);
        (profiles || []).forEach((p: any) => {
          profMap[p.user_id] = {
            name: `${p.first_name} ${p.last_name}`.trim() || "Unknown",
            jurisdiction: p.jurisdiction,
          };
        });
      }

      const enriched: Violation[] = (violRes.data || []).map((v: any) => ({
        punch_id: v.id,
        shift_date: v.punched_at?.split("T")[0] || "",
        punched_at: v.punched_at,
        user_id: v.user_id,
        punch_type: v.punch_type,
        site_name: v.address_label,
        guard_lat: v.latitude,
        guard_lon: v.longitude,
        within_geofence: v.within_geofence,
        actual_distance_meters: null,
        allowed_radius: null,
        client_site_name: v.address_label,
        guard_name: profMap[v.user_id]?.name || "Unknown",
        guard_jurisdiction: profMap[v.user_id]?.jurisdiction || "LC",
      }));

      setViolations(enriched);
      setJurisdictions((jurRes.data as any[]) || []);
      setLoading(false);
    };
    fetchData();
  }, [dateRange]);

  const filtered = useMemo(() => {
    let result = violations;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (v) =>
          v.guard_name?.toLowerCase().includes(q) ||
          v.site_name?.toLowerCase().includes(q) ||
          v.client_site_name?.toLowerCase().includes(q)
      );
    }
    if (filterJurisdiction !== "all") {
      result = result.filter((v) => v.guard_jurisdiction === filterJurisdiction);
    }
    return result;
  }, [violations, searchQuery, filterJurisdiction]);

  const handleExportPDF = async () => {
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");

      const doc = new jsPDF({ orientation: "landscape" });
      const companyName = company.company_name || "OECS Security Services";

      // Header
      doc.setFontSize(16);
      doc.text(companyName, 14, 15);
      doc.setFontSize(11);
      doc.text(`Geofence Violation Report — Last ${dateRange} Days`, 14, 22);
      doc.setFontSize(9);
      doc.text(`Generated: ${new Date().toLocaleDateString()} | Total Violations: ${filtered.length}`, 14, 28);

      // Table
      autoTable(doc, {
        startY: 34,
        head: [["Date", "Time", "Guard", "Site", "Jurisdiction", "Status"]],
        body: filtered.map((v) => [
          v.shift_date,
          new Date(v.punched_at).toLocaleTimeString(),
          v.guard_name || "—",
          v.site_name || v.client_site_name || "—",
          v.guard_jurisdiction || "—",
          "VIOLATION",
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [30, 64, 124] },
        alternateRowStyles: { fillColor: [245, 245, 245] },
      });

      doc.save(`geofence-violations-${dateRange}d.pdf`);
      toast.success("PDF exported successfully");
    } catch (err) {
      toast.error("Failed to generate PDF");
    }
  };

  if (!isAdminOrManager) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <Shield size={48} className="mx-auto mb-4 text-muted-foreground/30" />
        <h2 className="text-lg font-display font-semibold">Access Restricted</h2>
        <p className="text-sm">Violation reports are only available to administrators and managers.</p>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <AlertTriangle size={22} className="text-destructive" />
            Geofence Violations
          </h1>
          <p className="text-sm text-muted-foreground">
            Guards who clocked in outside their assigned site perimeter
          </p>
        </div>
        <button
          onClick={handleExportPDF}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Download size={16} /> Export PDF
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by guard or site..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-input bg-background text-sm">
          <Calendar size={14} className="text-muted-foreground" />
          <select value={dateRange} onChange={(e) => setDateRange(e.target.value as any)}
            className="bg-transparent border-none outline-none text-foreground cursor-pointer text-sm">
            <option value="7">Last 7 days</option>
            <option value="14">Last 14 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-input bg-background text-sm">
          <Filter size={14} className="text-muted-foreground" />
          <select value={filterJurisdiction} onChange={(e) => setFilterJurisdiction(e.target.value)}
            className="bg-transparent border-none outline-none text-foreground cursor-pointer text-sm">
            <option value="all">All Islands</option>
            {jurisdictions.map((j) => <option key={j.id} value={j.code}>{j.name}</option>)}
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="shadow-card border-border/60">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Violations</p>
            <p className="text-2xl font-display font-bold text-destructive">{filtered.length}</p>
          </CardContent>
        </Card>
        <Card className="shadow-card border-border/60">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Unique Guards</p>
            <p className="text-2xl font-display font-bold text-foreground">
              {new Set(filtered.map((v) => v.user_id)).size}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-card border-border/60">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Unique Sites</p>
            <p className="text-2xl font-display font-bold text-foreground">
              {new Set(filtered.map((v) => v.site_name).filter(Boolean)).size}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-card border-border/60">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Period</p>
            <p className="text-2xl font-display font-bold text-foreground">{dateRange}d</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card className="shadow-card border-border/60">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading violations...</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <MapPin size={48} className="mx-auto text-muted-foreground/20 mb-4" />
              <h3 className="text-lg font-display font-semibold mb-1">No Violations</h3>
              <p className="text-sm text-muted-foreground">
                All guards clocked in within their geofence for the selected period.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="text-left p-3 font-medium text-muted-foreground">Date</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Time</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Guard</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Site</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Island</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Type</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((v) => (
                    <tr key={v.punch_id} className="hover:bg-secondary/20 transition-colors">
                      <td className="p-3 text-foreground">{v.shift_date}</td>
                      <td className="p-3 text-foreground">{new Date(v.punched_at).toLocaleTimeString()}</td>
                      <td className="p-3 font-medium text-foreground">{v.guard_name}</td>
                      <td className="p-3 text-foreground">{v.site_name || v.client_site_name || "—"}</td>
                      <td className="p-3 text-foreground">{v.guard_jurisdiction || "—"}</td>
                      <td className="p-3">
                        <Badge variant="secondary" className="text-xs">
                          {v.punch_type.replace("_", " ")}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <Badge variant="destructive" className="text-xs">VIOLATION</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
