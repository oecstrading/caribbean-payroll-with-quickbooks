import { useState, useRef } from "react";
import { Upload, FileText, AlertCircle, CheckCircle, X, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import type { AttendanceRecord } from "@/lib/sample-data";

interface CSVImportProps {
  onImport: (records: AttendanceRecord[]) => void;
}

const STD_HOURS = 8;
const SHIFT_START = 9; // 9:00 AM — late if after 9:00
const LATE_THRESHOLD_MIN = 0; // any minutes past shift start

function parseTimeToDecimal(time: string): number | null {
  if (!time || time.trim() === "") return null;
  const cleaned = time.trim();
  // Handle HH:MM format
  const match = cleaned.match(/^(\d{1,2}):(\d{2})$/);
  if (match) {
    return parseInt(match[1]) + parseInt(match[2]) / 60;
  }
  // Handle decimal format like 8.5
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function formatTimeFromDecimal(decimal: number): string {
  const hours = Math.floor(decimal);
  const mins = Math.round((decimal - hours) * 60);
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}

function parseDate(dateStr: string): string | null {
  if (!dateStr || dateStr.trim() === "") return null;
  const cleaned = dateStr.trim();

  // Try ISO format YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned;

  // Try MM/DD/YYYY
  const mdy = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) {
    return `${mdy[3]}-${mdy[1].padStart(2, "0")}-${mdy[2].padStart(2, "0")}`;
  }

  // Try DD/MM/YYYY
  const dmy = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  }

  // Try Excel serial date number
  const serial = parseFloat(cleaned);
  if (!isNaN(serial) && serial > 40000 && serial < 55000) {
    const date = new Date((serial - 25569) * 86400 * 1000);
    return date.toISOString().split("T")[0];
  }

  return null;
}

function processRow(
  personId: string,
  name: string,
  dateStr: string,
  clockInStr: string,
  clockOutStr: string
): AttendanceRecord | null {
  const date = parseDate(dateStr);
  if (!date || !personId.trim()) return null;

  const clockInDecimal = parseTimeToDecimal(clockInStr);
  const clockOutDecimal = parseTimeToDecimal(clockOutStr);

  const clockIn = clockInDecimal !== null ? formatTimeFromDecimal(clockInDecimal) : null;
  const clockOut = clockOutDecimal !== null ? formatTimeFromDecimal(clockOutDecimal) : null;

  let totalHours: number | null = null;
  let status: AttendanceRecord["status"] = "Complete";
  let otHours = 0;

  if (clockIn && !clockOut) {
    status = "Missing Out";
  } else if (!clockIn && clockOut) {
    status = "Missing In";
  } else if (clockInDecimal !== null && clockOutDecimal !== null) {
    totalHours = Math.round((clockOutDecimal - clockInDecimal) * 100) / 100;
    if (totalHours < 0) totalHours += 24; // overnight shift
    otHours = Math.max(0, Math.round((totalHours - STD_HOURS) * 100) / 100);
  }

  // Late detection
  let late = false;
  let lateMinutes = 0;
  if (clockInDecimal !== null && clockInDecimal > SHIFT_START + LATE_THRESHOLD_MIN / 60) {
    late = true;
    lateMinutes = Math.round((clockInDecimal - SHIFT_START) * 60);
  }

  return {
    personId: personId.trim().padStart(2, "0"),
    name: name.trim(),
    date,
    clockIn,
    clockOut,
    totalHours,
    status,
    late,
    lateMinutes,
    otHours,
  };
}

function parseCSV(text: string): string[][] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
  return lines.map((line) => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current);
    return result.map((cell) => cell.trim());
  });
}

// Column mapping — detect which columns correspond to what
function detectColumns(header: string[]): Record<string, number> | null {
  const lower = header.map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ""));
  const map: Record<string, number> = {};

  // Person ID
  const pidIdx = lower.findIndex((h) => h.includes("personid") || h.includes("empid") || h.includes("employeeid") || h === "id" || h === "pid");
  if (pidIdx >= 0) map.personId = pidIdx;

  // Name
  const nameIdx = lower.findIndex((h) => h.includes("name") || h.includes("employee"));
  if (nameIdx >= 0 && nameIdx !== pidIdx) map.name = nameIdx;

  // Date
  const dateIdx = lower.findIndex((h) => h.includes("date") || h.includes("day"));
  if (dateIdx >= 0) map.date = dateIdx;

  // Clock In
  const inIdx = lower.findIndex((h) => h.includes("clockin") || h.includes("timein") || h.includes("signin") || h.includes("in") && !h.includes("out"));
  if (inIdx >= 0) map.clockIn = inIdx;

  // Clock Out
  const outIdx = lower.findIndex((h) => h.includes("clockout") || h.includes("timeout") || h.includes("signout") || h.includes("out"));
  if (outIdx >= 0 && outIdx !== inIdx) map.clockOut = outIdx;

  // Validate minimum required columns
  if (map.date === undefined || (map.personId === undefined && map.name === undefined)) {
    return null;
  }

  return map;
}

const sampleCSV = `Person ID,Name,Date,Clock In,Clock Out
01,Jarrel John,2026-03-10,08:30,17:15
02,Lydon Fagan,2026-03-10,09:15,18:00
07,Tessa Jules,2026-03-10,07:45,16:30`;

export default function AttendanceCSVImport({ onImport }: CSVImportProps) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<AttendanceRecord[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!file.name.endsWith(".csv") && !file.name.endsWith(".txt")) {
      toast.error("Please upload a CSV file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too large (max 5MB)");
      return;
    }
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      processCSVText(text);
    };
    reader.readAsText(file);
  };

  const processCSVText = (text: string) => {
    const rows = parseCSV(text);
    if (rows.length < 2) {
      setErrors(["File appears empty or has no data rows"]);
      return;
    }

    const header = rows[0];
    const colMap = detectColumns(header);

    if (!colMap) {
      setErrors([
        "Could not detect required columns. Expected columns like: Person ID, Name, Date, Clock In, Clock Out",
        `Found headers: ${header.join(", ")}`,
      ]);
      return;
    }

    const records: AttendanceRecord[] = [];
    const parseErrors: string[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.every((cell) => cell === "")) continue;

      const personId = colMap.personId !== undefined ? row[colMap.personId] || "" : "";
      const name = colMap.name !== undefined ? row[colMap.name] || "" : `Employee ${personId}`;
      const dateStr = colMap.date !== undefined ? row[colMap.date] || "" : "";
      const clockIn = colMap.clockIn !== undefined ? row[colMap.clockIn] || "" : "";
      const clockOut = colMap.clockOut !== undefined ? row[colMap.clockOut] || "" : "";

      const record = processRow(personId, name, dateStr, clockIn, clockOut);
      if (record) {
        records.push(record);
      } else {
        parseErrors.push(`Row ${i + 1}: Could not parse — "${row.join(", ")}"`);
      }
    }

    setPreview(records);
    setErrors(parseErrors);
    if (records.length === 0 && parseErrors.length === 0) {
      setErrors(["No valid records found in the file"]);
    }
  };

  const handleImport = () => {
    onImport(preview);
    toast.success(`${preview.length} attendance records imported`);
    setOpen(false);
    setPreview([]);
    setErrors([]);
    setFileName("");
  };

  const handleDownloadSample = () => {
    const blob = new Blob([sampleCSV], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "attendance_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setPreview([]);
    setErrors([]);
    setFileName("");
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
      >
        <Upload size={16} />
        Import CSV
      </button>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Upload size={18} className="text-primary" />
              Import Attendance Data
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {/* Upload zone */}
            {preview.length === 0 && (
              <>
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                  onClick={() => fileRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                    dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                  }`}
                >
                  <Upload size={32} className="mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-sm font-medium text-foreground">Drop CSV file here or click to browse</p>
                  <p className="text-xs text-muted-foreground mt-1">Supports CSV files up to 5MB</p>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".csv,.txt"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                    className="hidden"
                  />
                </div>

                <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 border border-border/50">
                  <FileText size={16} className="text-primary flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs font-medium text-foreground">Expected format</p>
                    <p className="text-[10px] text-muted-foreground">Columns: Person ID, Name, Date, Clock In, Clock Out</p>
                  </div>
                  <button
                    onClick={handleDownloadSample}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary text-foreground rounded-lg text-xs font-medium hover:bg-muted transition-colors"
                  >
                    <Download size={12} />
                    Template
                  </button>
                </div>
              </>
            )}

            {/* Errors */}
            {errors.length > 0 && (
              <div className="space-y-1.5">
                {errors.slice(0, 5).map((err, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-destructive/5 border border-destructive/10">
                    <AlertCircle size={14} className="text-destructive mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-destructive">{err}</p>
                  </div>
                ))}
                {errors.length > 5 && (
                  <p className="text-xs text-muted-foreground">...and {errors.length - 5} more errors</p>
                )}
              </div>
            )}

            {/* Preview */}
            {preview.length > 0 && (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle size={16} className="text-success" />
                    <span className="text-sm font-medium text-foreground">
                      {preview.length} records ready from <span className="font-mono text-xs">{fileName}</span>
                    </span>
                  </div>
                  <button onClick={reset} className="p-1.5 rounded-md hover:bg-secondary transition-colors">
                    <X size={14} className="text-muted-foreground" />
                  </button>
                </div>

                <div className="overflow-x-auto max-h-60 border border-border rounded-lg">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-secondary">
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">ID</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Name</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Date</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">In</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Out</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Hours</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.slice(0, 50).map((r, i) => (
                        <tr key={i} className="border-b border-border/50">
                          <td className="py-1.5 px-3 font-mono text-muted-foreground">{r.personId}</td>
                          <td className="py-1.5 px-3 text-foreground">{r.name}</td>
                          <td className="py-1.5 px-3 font-mono text-foreground">{r.date}</td>
                          <td className="py-1.5 px-3 font-mono text-foreground">{r.clockIn || "—"}</td>
                          <td className="py-1.5 px-3 font-mono text-foreground">{r.clockOut || "—"}</td>
                          <td className="py-1.5 px-3 font-mono text-foreground">{r.totalHours?.toFixed(2) || "—"}</td>
                          <td className="py-1.5 px-3">
                            <Badge
                              variant="secondary"
                              className={`text-[10px] ${r.status === "Complete" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}
                            >
                              {r.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {preview.length > 50 && (
                    <p className="text-xs text-muted-foreground text-center py-2">Showing 50 of {preview.length} records</p>
                  )}
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border/50 text-xs">
                  <div className="flex gap-4 text-muted-foreground">
                    <span>📅 {new Set(preview.map((r) => r.date)).size} dates</span>
                    <span>👤 {new Set(preview.map((r) => r.personId)).size} employees</span>
                    <span>⚠️ {preview.filter((r) => r.status !== "Complete").length} missing punches</span>
                    <span>🔴 {preview.filter((r) => r.late).length} late</span>
                  </div>
                </div>

                <div className="flex gap-2 justify-end">
                  <button
                    onClick={reset}
                    className="px-4 py-2.5 bg-secondary text-foreground rounded-lg text-sm font-medium hover:bg-muted transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleImport}
                    className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                  >
                    <CheckCircle size={16} />
                    Import {preview.length} Records
                  </button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
