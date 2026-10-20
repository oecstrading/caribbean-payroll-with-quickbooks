import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { departmentSummaries, payrollTotals, type PayrollReportRow } from "@/lib/department-payroll";
import { downloadCSV, downloadPDF } from "@/lib/export-utils";
import { formatCurrency } from "@/lib/payroll-engine";

export default function DepartmentPayrollReport({ rows, period, sample = false, currency = "XCD" }: {
  rows: PayrollReportRow[]; period: string; sample?: boolean; currency?: string;
}) {
  const [mode, setMode] = useState("consolidated");
  const summaries = departmentSummaries(rows);
  const totals = payrollTotals(rows);
  const money = (n: number) => n.toFixed(2);
  const title = `${sample ? "Sample · " : ""}${mode === "consolidated" ? "Consolidated" : "Departmental"} payroll`;
  const headers = mode === "consolidated"
    ? ["Department", "Employees", "Gross", "Employee NIC", "Employer NIC", "PAYE", "Deductions", "Net", "Employer cost"]
    : ["Department / Employee", "Basic", "OT", "Gross", "Employee NIC", "Employer NIC", "PAYE", "Deductions", "Net"];
  const tableRows: (string | number)[][] = mode === "consolidated"
    ? [...summaries.map(s => [s.department, s.employees, money(s.gross), money(s.nic), money(s.employerNIC), money(s.paye), money(s.deductions), money(s.net), money(s.cost)]),
      ["CONSOLIDATED TOTAL", totals.employees, money(totals.gross), money(totals.nic), money(totals.employerNIC), money(totals.paye), money(totals.deductions), money(totals.net), money(totals.cost)]]
    : summaries.flatMap(summary => [
      ...rows.filter(row => row.department === summary.department).map(row => [`${summary.department} / ${row.name}`, money(row.basic), money(row.overtime), money(row.gross), money(row.nic), money(row.employerNIC), money(row.paye), money(row.deductions), money(row.net)]),
      [`${summary.department} TOTAL`, money(summary.basic), money(summary.overtime), money(summary.gross), money(summary.nic), money(summary.employerNIC), money(summary.paye), money(summary.deductions), money(summary.net)],
    ]);
  const exportReport = (format: "csv" | "pdf") => {
    const filename = `${sample ? "sample-" : ""}${mode}-payroll-${period}`;
    if (format === "csv") downloadCSV(filename, headers, tableRows);
    else downloadPDF(filename, title, headers, tableRows, {
      subtitle: `${period} | ${currency} | ${totals.employees} employees | ${summaries.length} departments`,
      summaryRows: [{ label: "Gross", value: `${money(totals.gross)} ${currency}` }, { label: "Deductions", value: `${money(totals.deductions)} ${currency}` },
        { label: "Net", value: `${money(totals.net)} ${currency}` }, { label: "Employer cost (gross + employer NIC)", value: `${money(totals.cost)} ${currency}` }],
    });
  };
  return <section className="space-y-4 border-t border-border pt-5">
    <div className="flex items-center justify-between flex-wrap gap-3">
      <h2 className="font-display font-semibold text-lg text-foreground">Payroll reports · {period}</h2>
      <div className="flex gap-2"><Button variant="secondary" disabled={!rows.length} onClick={() => exportReport("csv")}><Download /> CSV</Button>
        <Button disabled={!rows.length} onClick={() => exportReport("pdf")}><Download /> PDF</Button></div>
    </div>
    <Tabs value={mode} onValueChange={setMode}><TabsList><TabsTrigger value="consolidated">Consolidated</TabsTrigger><TabsTrigger value="departmental">Departmental</TabsTrigger></TabsList></Tabs>
    {!rows.length ? <p className="text-sm text-muted-foreground py-5">No payroll records in this selection.</p> : <>
      <div className="overflow-x-auto"><table className="w-full text-sm">
        <thead><tr className="border-b border-border bg-secondary/50">{headers.map((h, i) => <th key={h} className={`p-3 whitespace-nowrap font-medium text-muted-foreground ${i ? "text-right" : "text-left"}`}>{h}</th>)}</tr></thead>
        <tbody>{tableRows.map((row, index) => <tr key={index} className="border-b border-border/50">{row.map((cell, i) => <td key={i} className={`p-3 ${i ? "text-right font-mono whitespace-nowrap" : "text-left min-w-48"}`}>{cell}</td>)}</tr>)}</tbody>
      </table></div>
      <div className="flex flex-wrap justify-between gap-3 text-sm text-muted-foreground"><span>{totals.employees} employees · {summaries.length} departments · {currency}</span><span className="font-semibold text-success">Net pay {formatCurrency(totals.net)} {currency}</span></div>
    </>}
  </section>;
}