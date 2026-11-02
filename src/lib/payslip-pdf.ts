// Reads pay stubs (QuickBooks-style "Employee Pay Stub" PDFs) and rebuilds each one with the platform's rules.
// Text arrives as positioned tokens so numbers can be placed under the right column (Qty, Rate, Current, YTD).
import { getConfigByJurisdiction, calculatePayroll } from "./payroll-engine";

export interface Token { text: string; x: number; end: number }
export type Line = Token[];

export interface SlipEarning { label: string; qty: string; hours: number | null; rate: number | null; current: number; kind: "basic" | "overtime" | "bonus" }
export interface SlipDeduction { label: string; current: number }
export interface ParsedSlip {
  name: string; periodStart: string; periodEnd: string; payDate: string; check: string;
  earnings: SlipEarning[]; gross: number; taxes: number; nicEE: number; nicER: number | null;
  otherDeductions: SlipDeduction[]; totalAdjustments: number; net: number;
}

const NUM = /^-?\(?[\d,]*\.\d{2}\)?$|^-?[\d,]+$/;
const QTY = /^\d+:\d{2}$/;
const toNum = (s: string) => { const neg = /^-|\(/.test(s); const n = Number(s.replace(/[(),\-]/g, "")); return Number.isFinite(n) ? (neg ? -n : n) : 0; };
const money = (n: number) => Math.round(n * 100) / 100;
const isoDate = (us: string) => { const m = us.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m ? `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}` : ""; };
const lineText = (l: Line) => l.map(t => t.text).join("  ");
const nearest = (t: Token, cols: Record<string, number>) => {
  let best = ""; let gap = Infinity;
  for (const [k, end] of Object.entries(cols)) { const g = Math.abs(t.end - end); if (g < gap) { gap = g; best = k; } }
  return best;
};

/** Turn plain layout text (one string per line) into positioned tokens; used for tests and text exports. */
export function linesFromText(text: string): Line[] {
  return text.split(/\r?\n/).map(row => {
    const out: Token[] = []; const re = /\S+(?: \S+)*/g; let m: RegExpExecArray | null;
    while ((m = re.exec(row))) out.push({ text: m[0], x: m.index, end: m.index + m[0].length });
    return out;
  });
}

function kindOf(label: string): SlipEarning["kind"] {
  if (/bonus/i.test(label)) return "bonus";
  if (/x\s*1\.5|x\s*2|^ot|overtime|double/i.test(label)) return "overtime";
  return "basic";
}

function parseOne(lines: Line[]): ParsedSlip | null {
  const all = lines.map(lineText);
  const empIdx = lines.findIndex(l => l[0]?.text === "Employee" && l.some(t => t.text === "SSN"));
  const name = empIdx >= 0 ? (lines.slice(empIdx + 1).find(l => l.length)?.[0]?.text || "").replace(/\s+/g, " ").trim() : "";
  const header = all.find(t => /Pay Period:/i.test(t)) || "";
  const period = header.match(/Pay Period:\s*([\d/]+)\s*-\s*([\d/]+)/i);
  const slip: ParsedSlip = {
    name, periodStart: period ? isoDate(period[1]) : "", periodEnd: period ? isoDate(period[2]) : "",
    payDate: isoDate(header.match(/Pay Date:\s*([\d/]+)/i)?.[1] || ""), check: header.match(/Check number:\s*(\S+)/i)?.[1] || "",
    earnings: [], gross: 0, taxes: 0, nicEE: 0, nicER: null, otherDeductions: [], totalAdjustments: 0, net: 0,
  };
  if (!name) return null;

  const eIdx = lines.findIndex(l => l[0]?.text === "Earnings and Hours");
  const tIdx = lines.findIndex((l, i) => i > eIdx && l[0]?.text === "Taxes");
  const aIdx = lines.findIndex((l, i) => i > tIdx && /^Adjustments to Net Pay/.test(l[0]?.text || ""));
  const nIdx = lines.findIndex((l, i) => i > aIdx && l[0]?.text === "Net Pay");
  if (eIdx < 0 || tIdx < 0 || nIdx < 0) return null;

  // Earnings: left block columns from the header; anything right of "Paid Time Off"/"Non-taxable" is the side panel.
  const eh = lines[eIdx];
  const col = (label: string, from = 0) => eh.slice(from).find(t => t.text === label);
  const ytd = eh.findIndex(t => t.text === "YTD Amount");
  const boundary = eh[ytd + 1]?.x ?? Infinity;
  const leftCols: Record<string, number> = {};
  for (const k of ["Qty", "Rate", "Current", "YTD Amount"]) { const t = col(k); if (t) leftCols[k] = t.end; }
  let sideCols: Record<string, number> = {};
  for (let i = eIdx; i < tIdx; i++) {
    const l = lines[i]; const s = l.findIndex(t => /^Non-taxable Company Items/.test(t.text));
    if (s >= 0) sideCols = Object.fromEntries(l.slice(s + 1).map(t => [t.text, t.end]));
  }
  for (let i = eIdx + 1; i < tIdx; i++) {
    const l = lines[i];
    const left = l.filter(t => t.x < boundary - 1); const right = l.filter(t => t.x >= boundary - 1);
    const er = right.findIndex(t => /^N\.?I\.?C\.?\s*\(ER\)/i.test(t.text));
    if (er >= 0) { const cur = right.slice(er + 1).find(t => NUM.test(t.text) && nearest(t, sideCols) === "Current"); if (cur) slip.nicER = toNum(cur.text); }
    const label = left[0] && !NUM.test(left[0].text) && !QTY.test(left[0].text) ? left[0].text : "";
    if (!label) continue; // totals row
    const cells: Record<string, string> = {};
    for (const t of left.slice(1)) if (NUM.test(t.text) || QTY.test(t.text)) cells[nearest(t, leftCols)] = t.text;
    if (cells.Current === undefined) continue; // only a year-to-date figure
    const qty = cells.Qty || "";
    const [h, m] = QTY.test(qty) ? qty.split(":").map(Number) : [NaN, NaN];
    slip.earnings.push({ label, qty, hours: Number.isFinite(h) ? h + m / 60 : null, rate: cells.Rate ? toNum(cells.Rate) : null, current: toNum(cells.Current), kind: kindOf(label) });
  }
  slip.gross = money(slip.earnings.reduce((s, e) => s + e.current, 0));

  const sectionCurrent = (header: Line, l: Line) => {
    const cur = header.find(t => t.text === "Current"); const yt = header.find(t => t.text === "YTD Amount");
    const nums = l.filter(t => NUM.test(t.text));
    const hit = nums.find(t => nearest(t, { Current: cur?.end ?? 0, YTD: yt?.end ?? 1e9 }) === "Current");
    return hit ? toNum(hit.text) : null;
  };
  for (let i = tIdx + 1; i < aIdx; i++) {
    const l = lines[i]; if (!l[0] || NUM.test(l[0].text)) continue;
    slip.taxes += Math.abs(sectionCurrent(lines[tIdx], l) ?? 0);
  }
  slip.taxes = money(slip.taxes);
  for (let i = aIdx + 1; i < nIdx; i++) {
    const l = lines[i]; if (!l[0] || NUM.test(l[0].text)) continue;
    const v = sectionCurrent(lines[aIdx], l); if (v === null) continue;
    if (/^N\.?I\.?C\.?\s*\(EE\)|national insurance/i.test(l[0].text)) slip.nicEE = money(slip.nicEE + Math.abs(v));
    else slip.otherDeductions.push({ label: l[0].text, current: money(Math.abs(v)) });
  }
  slip.totalAdjustments = money(slip.nicEE + slip.otherDeductions.reduce((s, d) => s + d.current, 0));
  slip.net = sectionCurrent(lines[aIdx], lines[nIdx]) ?? 0;
  return slip;
}

/** Split a document into stubs and read each one. */
export function parsePayslips(lines: Line[]): ParsedSlip[] {
  const starts = lines.map((l, i) => (l.some(t => /^Employee Pay Stub/.test(t.text)) ? i : -1)).filter(i => i >= 0);
  return starts.map((s, k) => parseOne(lines.slice(s, starts[k + 1] ?? lines.length))).filter((x): x is ParsedSlip => !!x);
}

export type NicBasis = "gross" | "gross_less_bonus" | "basic_only";
export const NIC_BASIS_LABELS: Record<NicBasis, string> = {
  gross: "All earnings", gross_less_bonus: "All earnings except bonuses", basic_only: "Basic pay only (no overtime or bonus)",
};
export type PayeRule = "as_slips" | "calculated";

const nicBase = (s: ParsedSlip, basis: NicBasis) => s.earnings.reduce((sum, e) =>
  sum + (basis === "gross" || (basis === "gross_less_bonus" && e.kind !== "bonus") || (basis === "basic_only" && e.kind === "basic") ? e.current : 0), 0);

/** Share of a month the slip covers: half-month stubs carry half the monthly NIC ceiling and tax bands. */
export function slipFactor(start: string, end: string) {
  if (!start || !end) return 0.5;
  const days = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1;
  return days >= 27 ? 1 : days >= 12 ? 0.5 : days >= 6 ? 12 / 52 : days / 30;
}

/** The Paymaster learns which earnings attract NIC by testing each rule against every slip. */
export function learnNicBasis(slips: ParsedSlip[], jurisdiction = "LC"): { basis: NicBasis; matches: number } {
  const cfg = getConfigByJurisdiction(jurisdiction);
  let best: { basis: NicBasis; matches: number } = { basis: "gross", matches: -1 };
  for (const basis of Object.keys(NIC_BASIS_LABELS) as NicBasis[]) {
    const matches = slips.filter(s => Math.abs(Math.min(money(nicBase(s, basis) * cfg.nic.employeeRate), cfg.nic.maxContribution * slipFactor(s.periodStart, s.periodEnd)) - s.nicEE) <= 0.01).length;
    if (matches > best.matches) best = { basis, matches };
  }
  return best;
}

export interface RebuiltSlip {
  slip: ParsedSlip; gross: number; basic: number; overtime: number; nicEE: number; nicER: number; paye: number; other: number; totalDeductions: number; net: number;
  lineChecks: { label: string; slip: number; platform: number }[];
  differences: { field: string; slip: number; platform: number; reason: string }[];
}

export function rebuildSlip(slip: ParsedSlip, opts: { basis: NicBasis; paye: PayeRule; jurisdiction?: string }): RebuiltSlip {
  const cfg = getConfigByJurisdiction(opts.jurisdiction || "LC");
  const factor = slipFactor(slip.periodStart, slip.periodEnd);
  const lineChecks = slip.earnings.map(e => ({ label: e.label, slip: e.current, platform: e.hours !== null && e.rate !== null ? money(e.hours * e.rate) : e.current }));
  const gross = money(lineChecks.reduce((s, l) => s + l.platform, 0));
  const overtime = money(slip.earnings.reduce((s, e, i) => s + (e.kind === "overtime" ? lineChecks[i].platform : 0), 0));
  const base = slip.earnings.reduce((s, e, i) => s + (opts.basis === "gross" || (opts.basis === "gross_less_bonus" && e.kind !== "bonus") || (opts.basis === "basic_only" && e.kind === "basic") ? lineChecks[i].platform : 0), 0);
  const cap = cfg.nic.maxContribution * factor;
  const nicEE = money(Math.min(base * cfg.nic.employeeRate, cap));
  const nicER = money(Math.min(base * cfg.nic.employerRate, cap));
  let paye = slip.taxes;
  if (opts.paye === "calculated") {
    const scaled = { ...cfg, nic: { ...cfg.nic, maxContribution: cap }, paye: { annualAllowance: cfg.paye.annualAllowance * factor, brackets: cfg.paye.brackets.map(b => ({ ...b, min: b.min * factor, max: b.max * factor })) } };
    paye = calculatePayroll(gross, scaled).paye;
  }
  const other = money(slip.otherDeductions.reduce((s, d) => s + d.current, 0));
  const totalDeductions = money(nicEE + paye + other);
  const net = money(gross - totalDeductions);
  const differences: RebuiltSlip["differences"] = [];
  lineChecks.forEach(l => { if (Math.abs(l.slip - l.platform) > 0.01) differences.push({ field: l.label, slip: l.slip, platform: l.platform, reason: "Hours × rate works out differently from the amount printed on the slip." }); });
  const add = (field: string, a: number, b: number, reason: string) => { if (Math.abs(a - b) > 0.01) differences.push({ field, slip: a, platform: b, reason }); };
  add("Gross pay", slip.gross, gross, "Follows from the earnings lines above.");
  add("NIC (employee)", slip.nicEE, nicEE, `Platform charges ${cfg.nic.employeeRate * 100}% on ${NIC_BASIS_LABELS[opts.basis].toLowerCase()}, capped at ${cap.toFixed(2)} for this period.`);
  if (slip.nicER !== null) add("NIC (employer)", slip.nicER, nicER, "Employer share uses the same earnings and ceiling.");
  add("PAYE / income tax", slip.taxes, paye, "The slip withholds a different income tax from the platform's tax bands.");
  add("Net pay", slip.net, net, "Follows from the differences above.");
  return { slip, gross, basic: money(gross - overtime), overtime, nicEE, nicER, paye, other, totalDeductions, net, lineChecks, differences };
}

/** Match a slip name to a directory person: exact first+last, else same last name and first initial (catches Brian/Bryan). */
export function matchEmployee<T extends { first_name: string | null; last_name: string | null }>(name: string, people: T[]): T | null {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();
  const n = norm(name);
  const full = people.find(p => norm(`${p.first_name ?? ""} ${p.last_name ?? ""}`) === n);
  if (full) return full;
  const parts = n.split(" "); const last = parts[parts.length - 1]; const initial = parts[0]?.[0];
  const close = people.filter(p => norm(p.last_name ?? "") === last && norm(p.first_name ?? "")[0] === initial);
  return close.length === 1 ? close[0] : null;
}
