import { useState, useRef, useCallback } from "react";
import { Upload, FileText, AlertCircle, CheckCircle, X, Download } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { employeeFolderSchema, emptyEmployee, folderUpdate } from "@/lib/employee-folder";

type ImportType = "employees" | "clients";

interface ColumnMapping {
  csvColumn: string;
  dbField: string;
}

const EMPLOYEE_FIELDS = [
  { value: "skip", label: "— Skip —" },
  { value: "first_name", label: "First Name" },
  { value: "last_name", label: "Last Name" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "department", label: "Department" },
  { value: "job_title", label: "Job Title" },
  { value: "monthly_salary", label: "Monthly Salary" },
  { value: "jurisdiction", label: "Jurisdiction Code" },
  { value: "nic_number", label: "NIC Number" },
  { value: "start_date", label: "Start Date" },
  { value: "status", label: "Status" },
  { value: "schedule", label: "Schedule" },
  { value: "std_hours_per_day", label: "Std Hours/Day" },
];

const CLIENT_FIELDS = [
  { value: "skip", label: "— Skip —" },
  { value: "name", label: "Site Name" },
  { value: "address", label: "Address" },
  { value: "client_name", label: "Client/Company Name" },
  { value: "client_email", label: "Client Email" },
  { value: "client_phone", label: "Client Phone" },
  { value: "latitude", label: "Latitude" },
  { value: "longitude", label: "Longitude" },
  { value: "radius_meters", label: "Geofence Radius (m)" },
  { value: "post_orders", label: "Post Orders" },
  { value: "status", label: "Status" },
];

// Smart auto-mapping
function autoMap(header: string, type: ImportType): string {
  const h = header.toLowerCase().trim().replace(/[_\-\s]+/g, " ");
  if (type === "employees") {
    if (/first.?name|given.?name|fname/i.test(h)) return "first_name";
    if (/last.?name|surname|family.?name|lname/i.test(h)) return "last_name";
    if (/email|e-mail/i.test(h)) return "email";
    if (/phone|mobile|cell|tel/i.test(h)) return "phone";
    if (/dept|department/i.test(h)) return "department";
    if (/title|position|job|role/i.test(h)) return "job_title";
    if (/salary|wage|pay|rate/i.test(h)) return "monthly_salary";
    if (/jurisdiction|island|country/i.test(h)) return "jurisdiction";
    if (/nic|national.?insurance/i.test(h)) return "nic_number";
    if (/start.?date|hire.?date|joined/i.test(h)) return "start_date";
    if (/status/i.test(h)) return "status";
    if (/hours/i.test(h)) return "std_hours_per_day";
    if (/schedule/i.test(h)) return "schedule";
  } else {
    if (/site.?name|location.?name|name/i.test(h)) return "name";
    if (/address|location/i.test(h)) return "address";
    if (/client|company|customer/i.test(h)) return "client_name";
    if (/email/i.test(h)) return "client_email";
    if (/phone|tel/i.test(h)) return "client_phone";
    if (/lat/i.test(h)) return "latitude";
    if (/lon|lng/i.test(h)) return "longitude";
    if (/radius|geofence/i.test(h)) return "radius_meters";
    if (/post.?order|instruction/i.test(h)) return "post_orders";
    if (/status/i.test(h)) return "status";
  }
  return "skip";
}

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };
  const parse = (line: string) => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') { inQuotes = !inQuotes; }
      else if (char === "," && !inQuotes) { result.push(current.trim()); current = ""; }
      else { current += char; }
    }
    result.push(current.trim());
    return result;
  };
  return { headers: parse(lines[0]), rows: lines.slice(1).map(parse) };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: ImportType;
  onSuccess?: () => void;
}

export default function CSVImportDialog({ open, onOpenChange, type, onSuccess }: Props) {
  const [step, setStep] = useState<"upload" | "map" | "preview" | "done">("upload");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState({ success: 0, errors: 0, errorDetails: [] as string[] });
  const fileRef = useRef<HTMLInputElement>(null);

  const fields = type === "employees" ? EMPLOYEE_FIELDS : CLIENT_FIELDS;

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const { headers: h, rows: r } = parseCSV(ev.target?.result as string);
      if (h.length === 0) { toast.error("Invalid CSV file"); return; }
      setHeaders(h);
      setRows(r);
      setMappings(h.map((col) => ({ csvColumn: col, dbField: autoMap(col, type) })));
      setStep("map");
    };
    reader.readAsText(file);
  };

  const updateMapping = (index: number, dbField: string) => {
    setMappings((prev) => prev.map((m, i) => (i === index ? { ...m, dbField } : m)));
  };

  const mappedFields = mappings.filter((m) => m.dbField !== "skip");
  const hasRequired = type === "employees"
    ? ["first_name", "last_name"].every(field => mappedFields.some(m => m.dbField === field))
    : mappedFields.some((m) => m.dbField === "name");

  const handleImport = async () => {
    setImporting(true);
    let success = 0;
    let errors = 0;
    const errorDetails: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const record: Record<string, any> = {};
      mappings.forEach((m, colIdx) => {
        if (m.dbField !== "skip" && row[colIdx] !== undefined) {
          let val: any = row[colIdx].trim();
          if (["monthly_salary", "latitude", "longitude", "radius_meters", "std_hours_per_day"].includes(m.dbField)) {
            val = parseFloat(val) || 0;
          }
          record[m.dbField] = val;
        }
      });

      try {
        if (type === "employees") {
          const values = employeeFolderSchema.parse({ ...emptyEmployee, ...record });
          if (!values.email) {
            const { error } = await supabase.from("employee_records").insert({ ...folderUpdate(values), email: "" });
            if (error) throw error;
          } else {
            const { data, error } = await supabase.functions.invoke("invite-user", { body: { email: values.email, first_name: values.first_name, last_name: values.last_name, role: "employee" } });
            if (error || data?.error || !data?.user_id) throw new Error(data?.error || error?.message || "Unable to create employee");
            const updated = await supabase.from("profiles").update(folderUpdate(values)).eq("user_id", data.user_id);
            if (updated.error) throw new Error("Account created, but HR details need saving in the employee folder");
          }
          success++;
        } else {
          if (!record.name) { errorDetails.push(`Row ${i + 1}: Missing site name`); errors++; continue; }
          const { error } = await supabase.from("client_sites").insert({
            name: record.name,
            address: record.address || "",
            client_name: record.client_name || "",
            client_email: record.client_email || "",
            client_phone: record.client_phone || "",
            latitude: record.latitude || null,
            longitude: record.longitude || null,
            radius_meters: record.radius_meters || 200,
            post_orders: record.post_orders || "",
            status: record.status || "active",
          });
          if (error) { errorDetails.push(`Row ${i + 1} (${record.name}): ${error.message}`); errors++; }
          else success++;
        }
      } catch (err: any) {
        errorDetails.push(`Row ${i + 1}: ${err.message}`);
        errors++;
      }
    }

    setResults({ success, errors, errorDetails });
    setStep("done");
    setImporting(false);
    if (success > 0) onSuccess?.();
  };

  const downloadTemplate = () => {
    const templateHeaders = type === "employees"
      ? ["first_name", "last_name", "email", "phone", "department", "job_title", "monthly_salary", "jurisdiction", "nic_number", "start_date"]
      : ["name", "address", "client_name", "client_email", "client_phone", "latitude", "longitude", "radius_meters"];
    const sampleRow = type === "employees"
      ? ["John", "Doe", "john@example.com", "758-555-0100", "Security", "Guard", "2500", "LC", "LC-12345", "2025-01-15"]
      : ["Bay Gardens Resort", "Rodney Bay, St. Lucia", "Bay Gardens", "info@baygardens.com", "758-457-8006", "14.0722", "-60.9530", "200"];
    const csv = [templateHeaders.join(","), sampleRow.join(",")].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${type}-import-template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setStep("upload");
    setHeaders([]);
    setRows([]);
    setMappings([]);
    setResults({ success: 0, errors: 0, errorDetails: [] });
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Import {type === "employees" ? "Employees" : "Client Sites"} from CSV
          </DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4 py-4">
            <div
              className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <FileText className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm font-medium text-foreground">Click to upload CSV file</p>
              <p className="text-xs text-muted-foreground mt-1">or drag and drop</p>
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
            </div>
            <Button variant="outline" size="sm" onClick={downloadTemplate} className="w-full">
              <Download className="w-4 h-4 mr-2" /> Download Template
            </Button>
          </div>
        )}

        {step === "map" && (
          <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{rows.length} rows detected. Map columns:</p>
              {!hasRequired && (
                <Badge variant="destructive" className="text-xs">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  {type === "employees" ? "First and last name required" : "Site Name required"}
                </Badge>
              )}
            </div>
            <ScrollArea className="flex-1 max-h-[300px]">
              <div className="space-y-2">
                {headers.map((h, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-sm font-mono bg-muted px-2 py-1 rounded min-w-[140px] truncate">{h}</span>
                    <span className="text-muted-foreground">→</span>
                    <Select value={mappings[i]?.dbField || "skip"} onValueChange={(v) => updateMapping(i, v)}>
                      <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {fields.map((f) => (
                          <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {mappings[i]?.dbField !== "skip" && (
                      <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={reset}>Back</Button>
              <Button onClick={() => setStep("preview")} disabled={!hasRequired}>
                Preview ({mappedFields.length} fields)
              </Button>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
            <p className="text-sm text-muted-foreground">Preview first 5 rows:</p>
            <ScrollArea className="flex-1 max-h-[300px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    {mappedFields.map((m) => (
                      <TableHead key={m.dbField} className="text-xs">{fields.find((f) => f.value === m.dbField)?.label}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.slice(0, 5).map((row, ri) => (
                    <TableRow key={ri}>
                      {mappedFields.map((m) => {
                        const colIdx = headers.indexOf(m.csvColumn);
                        return <TableCell key={m.dbField} className="text-xs">{row[colIdx] || "—"}</TableCell>;
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setStep("map")}>Back</Button>
              <Button onClick={handleImport} disabled={importing}>
                {importing ? "Importing..." : `Import ${rows.length} Records`}
              </Button>
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="space-y-4 py-4">
            <div className="text-center space-y-2">
              {results.errors === 0 ? (
                <CheckCircle className="w-12 h-12 mx-auto text-primary" />
              ) : (
                <AlertCircle className="w-12 h-12 mx-auto text-destructive" />
              )}
              <p className="text-lg font-semibold text-foreground">Import Complete</p>
              <div className="flex justify-center gap-4 text-sm">
                <span className="text-primary font-medium">{results.success} successful</span>
                {results.errors > 0 && <span className="text-destructive font-medium">{results.errors} failed</span>}
              </div>
            </div>
            {results.errorDetails.length > 0 && (
              <ScrollArea className="max-h-[150px] border border-border rounded p-2">
                {results.errorDetails.map((e, i) => (
                  <p key={i} className="text-xs text-destructive">{e}</p>
                ))}
              </ScrollArea>
            )}
            <Button className="w-full" onClick={() => { reset(); onOpenChange(false); }}>Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
