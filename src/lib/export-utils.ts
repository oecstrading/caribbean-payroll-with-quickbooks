import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// CSV Export
export function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const csvContent = [
    headers.join(","),
    ...rows.map((row) =>
      row.map((cell) => {
        const str = String(cell);
        return str.includes(",") || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
      }).join(",")
    ),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// PDF Export
export function downloadPDF(
  filename: string,
  title: string,
  headers: string[],
  rows: (string | number)[][],
  options?: {
    subtitle?: string;
    summaryRows?: { label: string; value: string }[];
    orientation?: "portrait" | "landscape";
  }
) {
  const doc = new jsPDF({ orientation: options?.orientation || "landscape" });

  // Title
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(title, 14, 20);

  if (options?.subtitle) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(options.subtitle, 14, 28);
    doc.setTextColor(0);
  }

  const startY = options?.subtitle ? 34 : 28;

  // Table
  autoTable(doc, {
    head: [headers],
    body: rows.map((r) => r.map(String)),
    startY,
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [41, 37, 36], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 245, 244] },
    margin: { left: 14, right: 14 },
  });

  // Summary section
  if (options?.summaryRows && options.summaryRows.length > 0) {
    const finalY = (doc as any).lastAutoTable?.finalY || startY + 20;
    let y = finalY + 10;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Summary", 14, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    for (const row of options.summaryRows) {
      doc.text(`${row.label}: ${row.value}`, 14, y);
      y += 5;
    }
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(
      `Generated ${new Date().toLocaleDateString()} — OECS HR & Payroll Solutions — Page ${i}/${pageCount}`,
      14,
      doc.internal.pageSize.height - 8
    );
  }

  doc.save(`${filename}.pdf`);
}
