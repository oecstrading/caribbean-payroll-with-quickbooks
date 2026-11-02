// Extracts positioned text lines from a PDF in the browser so column-based readers can place numbers.
import type { Line, Token } from "./payslip-pdf";

type Item = { str: string; transform: number[]; width: number; height: number };

/** Group raw text items into lines (same baseline) and merge items separated by a single space. */
export function itemsToLines(items: Item[]): Line[] {
  const rows = new Map<number, Item[]>();
  for (const it of items) {
    if (!it.str.trim()) continue;
    const y = Math.round(it.transform[5] / 2) * 2;
    const key = [...rows.keys()].find(k => Math.abs(k - y) <= 2) ?? y;
    rows.set(key, [...(rows.get(key) || []), it]);
  }
  return [...rows.entries()].sort((a, b) => b[0] - a[0]).map(([, row]) => {
    row.sort((a, b) => a.transform[4] - b.transform[4]);
    const out: Token[] = [];
    for (const it of row) {
      const x = it.transform[4]; const end = x + it.width; const size = Math.abs(it.transform[0]) || it.height || 8;
      const prev = out[out.length - 1];
      if (prev && x - prev.end < size * 0.6) { prev.text = `${prev.text}${x - prev.end > size * 0.15 ? " " : ""}${it.str.trim()}`.replace(/\s+/g, " "); prev.end = end; }
      else out.push({ text: it.str.trim().replace(/\s+/g, " "), x, end });
    }
    return out;
  });
}

export async function pdfLines(data: ArrayBuffer): Promise<Line[]> {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise;
  const lines: Line[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const content = await (await doc.getPage(p)).getTextContent();
    lines.push(...itemsToLines(content.items as Item[]));
  }
  return lines;
}
