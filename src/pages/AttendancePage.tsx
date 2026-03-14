import { useState } from "react";
import { motion } from "framer-motion";
import { Clock, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { sampleAttendance, type AttendanceRecord } from "@/lib/sample-data";
import AttendanceCSVImport from "@/components/AttendanceCSVImport";

export default function AttendancePage() {
  const [importedRecords, setImportedRecords] = useState<AttendanceRecord[]>([]);
  const allRecords = [...sampleAttendance, ...importedRecords];

  const dates = [...new Set(allRecords.map((a) => a.date))].sort();
  const [selectedDate, setSelectedDate] = useState(dates[dates.length - 1] || "2026-03-06");

  const dayRecords = allRecords.filter((a) => a.date === selectedDate);
  const completeCount = dayRecords.filter((a) => a.status === "Complete").length;
  const missingCount = dayRecords.filter((a) => a.status !== "Complete").length;
  const lateCount = dayRecords.filter((a) => a.late).length;
  const totalOT = dayRecords.reduce((s, a) => s + a.otHours, 0);

  const handleImport = (records: AttendanceRecord[]) => {
    setImportedRecords((prev) => [...prev, ...records]);
    // Auto-select the first imported date
    const importedDates = [...new Set(records.map((r) => r.date))].sort();
    if (importedDates.length > 0) {
      setSelectedDate(importedDates[0]);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4 md:space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-display font-bold text-foreground">Attendance</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track clock-ins, overtime, and late arrivals
            {importedRecords.length > 0 && (
              <span className="ml-2 text-primary">• {importedRecords.length} imported records</span>
            )}
          </p>
        </div>
        <AttendanceCSVImport onImport={handleImport} />
      </div>

      {/* Date Selector */}
      <div className="flex gap-2 flex-wrap">
        {dates.map((date) => (
          <button
            key={date}
            onClick={() => setSelectedDate(date)}
            className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              selectedDate === date
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-foreground hover:bg-muted"
            }`}
          >
            {new Date(date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
          </button>
        ))}
      </div>

      {/* Day Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Complete", value: completeCount, icon: CheckCircle, color: "text-success", bg: "bg-success/10" },
          { label: "Missing Punch", value: missingCount, icon: XCircle, color: "text-destructive", bg: "bg-destructive/10" },
          { label: "Late Arrivals", value: lateCount, icon: AlertTriangle, color: "text-warning", bg: "bg-warning/10" },
          { label: "OT Hours", value: totalOT.toFixed(1), icon: Clock, color: "text-primary", bg: "bg-primary/10" },
        ].map((stat) => (
          <Card key={stat.label} className="shadow-card border-border/60">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`p-2 rounded-lg ${stat.bg}`}>
                <stat.icon size={18} className={stat.color} />
              </div>
              <div>
                <p className="text-lg font-display font-bold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Timesheet Table */}
      <Card className="shadow-card border-border/60 overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-display">
            Timesheet — {new Date(selectedDate).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          </CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Employee</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Clock In</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Clock Out</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Total Hours</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Late</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">OT Hours</th>
              </tr>
            </thead>
            <tbody>
              {dayRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground">
                    No attendance records for this date
                  </td>
                </tr>
              ) : (
                dayRecords.map((record, i) => (
                  <motion.tr
                    key={`${record.personId}-${i}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="border-b border-border/50 hover:bg-secondary/30 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-xs font-bold text-primary">
                            {record.name.split(" ").map(n => n[0]).join("").slice(0,2)}
                          </span>
                        </div>
                        <span className="font-medium text-foreground">{record.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-foreground">{record.clockIn || "—"}</td>
                    <td className="py-3 px-4 font-mono text-foreground">{record.clockOut || <span className="text-destructive">MISSING</span>}</td>
                    <td className="py-3 px-4 font-medium text-foreground">{record.totalHours?.toFixed(2) || "—"}</td>
                    <td className="py-3 px-4">
                      <Badge
                        variant="secondary"
                        className={record.status === "Complete"
                          ? "bg-success/10 text-success border-success/20"
                          : "bg-destructive/10 text-destructive border-destructive/20"
                        }
                      >
                        {record.status === "Complete" ? "✅ Complete" : "⚠ " + record.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      {record.late ? (
                        <Badge variant="secondary" className="bg-warning/10 text-warning border-warning/20">
                          🔴 {record.lateMinutes} min
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">On Time</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-foreground">
                      {record.otHours > 0 ? `${record.otHours.toFixed(2)} hrs` : "—"}
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
