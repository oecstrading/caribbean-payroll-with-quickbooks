// Reads Caribbean salary spreadsheets (two-row headers, name row + ID row per employee,
// sub-total sections) and rebuilds each employee's pay with the platform's rules so the
// customer can see where the spreadsheet and the platform agree or differ.
import { getConfigByJurisdiction, calculatePayroll } from "./payroll-engine";

export type Cell = string | number | boolean | Date | null | undefined;
export type ColumnKey = "name" | "department" | "employeeId" | "hireDate" | "basic" | "days" | "dailyRate" | "dayTotal" | "hourly"
  | "otHours" | "otRate" | "otTotal" | "travel" | "phone" | "onCall" | "commission" | "otherAllowance" | "total"
  | "taxCode" | "paye" | "nic" | "salaryDeduction" | "otherDeduction" | "net";

export interface SheetEmployee {
  row: number; name: string; employeeId: string; department: string; group: number; hireDate: string;
  basic: number; days: number; dailyRate: number; extraDays: number; extraDayRate: number;
  otHours: number; otHours2: number; travel: number; phone: number; onCall: number; commission: number; otherAllowance: number;
  total: number; taxCode: string; paye: number; nic: number; salaryDeduction: number; otherDeduction: number; net: number;
  nicOnBasic: boolean; fixedDailyRate: number | null;
}
export interface ParsedSheet { title: string; columns: Partial<Record<ColumnKey, number>>; employees: SheetEmployee[]; groups: number; headerRow: number }

const num = (value: Cell) => { if (typeof value === "number") return Number.isFinite(value) ? value : 0; const n = Number(String(value ?? "").replace(/[,$\s]/g, "")); return Number.isFinite(n) ? n : 0; };
const str = (value: Cell) => value instanceof Date ? value.toISOString().slice(0, 10) : String(value ?? "").trim();
const isIdLike = (value: Cell) => typeof value === "number" || /^\s*\d{4,}\s*$/.test(String(value ?? ""));
export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Column letter → index (A=0). */
const colIndex = (letters: string) => letters.split("").reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;

/** Combine the two header rows, carrying a top label across the empty top cells to its right. */
export function headerLabels(top: Cell[], bottom: Cell[]): string[] {
  const width = Math.max(top.length, bottom.length); const labels: string[] = []; let carry = "";
  for (let i = 0; i < width; i++) {
    const t = str(top[i]).toUpperCase(); const b = str(bottom[i]).toUpperCase();
    if (t) carry = t; else if (!b) carry = "";
    labels.push(`${t || (b ? carry : "")} ${b}`.replace(/\s+/g, " ").trim());
  }
  return labels;
}

export function detectColumns(labels: string[]): Partial<Record<ColumnKey, number>> {
  const cols: Partial<Record<ColumnKey, number>> = {};
  const set = (key: ColumnKey, i: number) => { if (cols[key] === undefined) cols[key] = i; };
  labels.forEach((l, i) => {
    if (!l) return;
    if (/^NAME\b/.test(l)) set("name", i);
    else if (l.includes("DEPARTMENT")) set("department", i);
    else if (/\bSSN\b|NIC NO|NIS NO|SOCIAL SECURITY/.test(l)) set("employeeId", i);
    else if (l.includes("HIRED")) set("hireDate", i);
    else if (l.includes("NET")) set("net", i);
    else if (l.includes("PAYE")) set("paye", i);
    else if (l.includes("NIC") || l.includes("N.I.")) set("nic", i);
    else if (l.includes("CODE")) set("taxCode", i);
    else if (l.includes("SALARY DEDUCTION")) set("salaryDeduction", i);
    else if (l.includes("HOURLY")) set("hourly", i);
    else if (l.includes("TOTAL OVERTIME") || l === "OVERTIME TOTAL") set("otTotal", i);
    else if (l.includes("OVERTIME") || l.includes("TIME & HALF")) set("otRate", i);
    else if (l.includes("TOTAL DAYS") || l === "DAILY TOTAL") set("dayTotal", i);
    else if (l.includes("DAILY") && l.includes("RATE")) set("dailyRate", i);
    else if (l.includes("HOURS")) set("otHours", i);
    else if (l.includes("DAYS")) set("days", i);
    else if (l.includes("BASIC")) set("basic", i);
    else if (l.includes("TRAVEL")) set("travel", i);
    else if (l.includes("PHONE")) set("phone", i);
    else if (l.includes("ON CALL")) set("onCall", i);
    else if (/\bCOMM/.test(l)) set("commission", i);
    else if (l.includes("TOTAL") && l.includes("SALARY") && !l.includes("DEDUCTION")) set("total", i);
  });
  labels.forEach((l, i) => {
    if (!/\bOTHER\b/.test(l) || cols.total === undefined) return;
    if (i < cols.total) set("otherAllowance", i); else set("otherDeduction", i);
  });
  return cols;
}

/**
 * Parse a sheet given as rows of cell values (and optionally the matching formulas).
 * Stops at "Grand Total"; each "Sub-Total" starts a new group (e.g. Staff, then Directors).
 */
export function parseSalarySheet(values: Cell[][], formulas: (string | undefined)[][] = []): ParsedSheet {
  const headerRow = values.findIndex(r => r.some(c => /^NAME$/i.test(str(c))));
  if (headerRow < 0) throw new Error("Couldn't find a NAME column. Check that the sheet has a header row with NAME.");
  const labels = headerLabels(values[headerRow], values[headerRow + 1] || []);
  const columns = detectColumns(labels);
  if (columns.basic === undefined) throw new Error("Couldn't find a BASIC salary column.");
  const nameCol = columns.name ?? 0;
  const at = (r: Cell[], key: ColumnKey) => columns[key] === undefined ? undefined : r[columns[key]!];
  const fAt = (row: number, key: ColumnKey) => columns[key] === undefined ? undefined : formulas[row]?.[columns[key]!];
  const title = values.slice(0, headerRow).flat().map(str).find(s => /salar|payroll/i.test(s)) || "";
  const employees: SheetEmployee[] = []; let group = 0; let last: SheetEmployee | null = null;
  const letterOf = (key: ColumnKey) => { const i = columns[key]; if (i === undefined) return "#"; let s = ""; let n = i + 1; while (n) { s = String.fromCharCode(65 + ((n - 1) % 26)) + s; n = Math.floor((n - 1) / 26); } return s; };
  for (let r = headerRow + 2; r < values.length; r++) {
    const row = values[r] || []; const first = row[nameCol];
    const label = str(first);
    if (/grand\s*total|^totals?$|clearing/i.test(label)) break;
    if (/sub-?\s*total/i.test(label)) { group++; last = null; continue; }
    if (!label || /n\s*i\s*c\s+company/i.test(label)) continue;
    if (isIdLike(first) && last) {
      if (!last.employeeId) last.employeeId = label;
      last.otHours2 += num(at(row, "otHours")); last.extraDays += num(at(row, "days")); last.extraDayRate = num(at(row, "dailyRate")) || last.extraDayRate;
      last.paye += num(at(row, "paye"));
      last = null; continue;
    }
    if (isIdLike(first)) continue;
    const nicFormula = (fAt(r, "nic") || "").toUpperCase().replace(/\$/g, "");
    const dailyFormula = (fAt(r, "dailyRate") || "").toUpperCase().replace(/\$/g, "");
    const fixed = dailyFormula && !dailyFormula.includes(`${letterOf("basic")}`) ? dailyFormula.match(/^=\(?\s*([\d.]+)\s*\*\s*12/) : null;
    last = {
      row: r + 1, name: label.replace(/\s+/g, " "), employeeId: str(at(row, "employeeId")), department: str(at(row, "department")), group,
      hireDate: str(at(row, "hireDate")), basic: num(at(row, "basic")), days: num(at(row, "days")), dailyRate: num(at(row, "dailyRate")),
      extraDays: 0, extraDayRate: 0, otHours: num(at(row, "otHours")), otHours2: 0,
      travel: num(at(row, "travel")), phone: num(at(row, "phone")), onCall: num(at(row, "onCall")), commission: num(at(row, "commission")),
      otherAllowance: num(at(row, "otherAllowance")), total: num(at(row, "total")), taxCode: str(at(row, "taxCode")),
      paye: num(at(row, "paye")), nic: num(at(row, "nic")), salaryDeduction: num(at(row, "salaryDeduction")), otherDeduction: num(at(row, "otherDeduction")),
      net: num(at(row, "net")), nicOnBasic: Boolean(nicFormula) && nicFormula.includes(letterOf("basic")) && !nicFormula.includes(letterOf("total")),
      fixedDailyRate: fixed ? Number(fixed[1]) : null,
    };
    employees.push(last);
  }
  return { title, columns, employees, groups: group, headerRow };
}

export interface SheetRules {
  jurisdiction: string; nicBasis: "total" | "basic" | "as_sheet"; payeMethod: "sheet" | "calculated";
  nicCap: "law" | "sheet"; zeroTotal: "pay_basic" | "not_paid"; dailyRule: "formula" | "as_sheet";
  otMultiplier: number; ot2Multiplier: number; hoursPerDay: number;
}
export const defaultRules: SheetRules = { jurisdiction: "LC", nicBasis: "total", payeMethod: "sheet", nicCap: "law", zeroTotal: "pay_basic", dailyRule: "formula", otMultiplier: 1.5, ot2Multiplier: 2, hoursPerDay: 8 };

/** Platform's monthly daily-rate rule used by Caribbean salary sheets: monthly × 12 ÷ 52 weeks ÷ 5 days. */
export const dailyFromMonthly = (monthly: number) => monthly * 12 / 52 / 5;

export interface PlatformPay { daily: number; hourly: number; dayAdjustment: number; overtime: number; allowances: number; gross: number; nic: number; employerNic: number; paye: number; otherDeductions: number; net: number }

export function platformPay(e: SheetEmployee, rules: SheetRules): PlatformPay {
  const config = getConfigByJurisdiction(rules.jurisdiction);
  const basicTypedTotalZero = e.basic > 0 && e.total === 0;
  const basic = basicTypedTotalZero && rules.zeroTotal === "not_paid" ? 0 : e.basic;
  const daily = rules.dailyRule === "as_sheet" && e.fixedDailyRate !== null ? dailyFromMonthly(e.fixedDailyRate) : dailyFromMonthly(basic);
  const hourly = daily / rules.hoursPerDay;
  const dayAdjustment = e.days * daily + e.extraDays * (e.extraDayRate || daily);
  const overtime = e.otHours * hourly * rules.otMultiplier + e.otHours2 * hourly * rules.ot2Multiplier;
  const allowances = e.travel + e.phone + e.onCall + e.commission + e.otherAllowance;
  const gross = basic + dayAdjustment + overtime + allowances;
  const onBasic = rules.nicBasis === "basic" || (rules.nicBasis === "as_sheet" && e.nicOnBasic);
  const base = onBasic ? basic : gross;
  const cap = rules.nicCap === "law" ? config.nic.maxContribution : Infinity;
  const nic = Math.min(Math.max(0, base) * config.nic.employeeRate, cap);
  const employerNic = Math.min(Math.max(0, base) * config.nic.employerRate, cap);
  const paye = rules.payeMethod === "sheet" ? e.paye : calculatePayroll(gross, config).paye;
  const otherDeductions = e.salaryDeduction + e.otherDeduction;
  const net = gross - nic - paye - otherDeductions;
  return { daily: round2(daily), hourly: round2(hourly), dayAdjustment: round2(dayAdjustment), overtime: round2(overtime), allowances: round2(allowances), gross: round2(gross), nic: round2(nic), employerNic: round2(employerNic), paye: round2(paye), otherDeductions: round2(otherDeductions), net: round2(net) };
}

export interface Difference { name: string; row: number; field: "Gross" | "NIC" | "PAYE" | "Net"; sheet: number; platform: number; difference: number; reason: string }

export function compareSheet(sheet: ParsedSheet, rules: SheetRules): { rows: { employee: SheetEmployee; pay: PlatformPay }[]; differences: Difference[]; totals: { sheetNet: number; platformNet: number; sheetGross: number; platformGross: number } } {
  const config = getConfigByJurisdiction(rules.jurisdiction);
  const rows = sheet.employees.map(employee => ({ employee, pay: platformPay(employee, rules) }));
  const differences: Difference[] = [];
  for (const { employee: e, pay: p } of rows) {
    const add = (field: Difference["field"], s: number, v: number, reason: string) => { if (Math.abs(round2(s) - v) > 0.015) differences.push({ name: e.name, row: e.row, field, sheet: round2(s), platform: v, difference: round2(v - s), reason }); };
    const grossReason = e.basic > 0 && e.total === 0 ? "Sheet total salary is 0 although basic salary is filled in" : "Sheet total uses different rates or a typed-in amount";
    add("Gross", e.total, p.gross, grossReason);
    const sheetBase = e.nicOnBasic ? e.basic : e.total;
    add("NIC", e.nic, p.nic, e.nic > config.nic.maxContribution + 0.01 ? `Sheet goes above the ${config.countryName} NIC monthly maximum of ${config.nic.maxContribution}`
      : Math.abs(e.nic - sheetBase * config.nic.employeeRate) > 0.01 ? "Sheet NIC is typed in, not 5% of pay" : "NIC worked out on a different pay amount");
    add("PAYE", e.paye, p.paye, rules.payeMethod === "calculated" ? `Platform calculates PAYE with ${config.countryName} tax bands; sheet PAYE was typed in` : "PAYE differs");
    add("Net", e.net, p.net, differences.some(d => d.name === e.name && d.field !== "Net") ? "Follows from the differences above" : "Sheet net uses a different formula");
  }
  const sum = (f: (r: typeof rows[number]) => number) => round2(rows.reduce((t, r) => t + f(r), 0));
  return { rows, differences, totals: { sheetNet: sum(r => r.employee.net), platformNet: sum(r => r.pay.net), sheetGross: sum(r => r.employee.total), platformGross: sum(r => r.pay.gross) } };
}

export interface ImportQuestion { id: string; question: string; detail: string; options: { value: string; label: string }[]; recommended: string }

/** The questions the AI Paymaster asks before it trusts a sheet. Only asked when the sheet shows the issue. */
export function importQuestions(sheet: ParsedSheet, jurisdiction = "LC"): ImportQuestion[] {
  const config = getConfigByJurisdiction(jurisdiction);
  const e = sheet.employees; const q: ImportQuestion[] = [];
  const names = (list: SheetEmployee[]) => list.slice(0, 4).map(x => x.name).join(", ") + (list.length > 4 ? ` and ${list.length - 4} more` : "");
  q.push({ id: "jurisdiction", question: "Which country's NIC and PAYE rules apply to this payroll?", detail: "This sets the NIC rate, the monthly NIC maximum and the tax bands.", options: [["LC", "Saint Lucia"], ["AG", "Antigua and Barbuda"], ["KN", "St Kitts and Nevis"], ["DM", "Dominica"], ["GD", "Grenada"]].map(([value, label]) => ({ value, label })), recommended: jurisdiction });
  if (e.some(x => x.employeeId)) q.push({ id: "idMeaning", question: "What is the number under each employee's name?", detail: `For example ${e.find(x => x.employeeId)?.name}: ${e.find(x => x.employeeId)?.employeeId}.`, options: [{ value: "nic", label: "NIC / social security number" }, { value: "employee", label: "Our employee number" }], recommended: "nic" });
  const onBasic = e.filter(x => x.nicOnBasic);
  if (onBasic.length) q.push({ id: "nicBasis", question: "Should NIC be worked out on total pay or basic pay only?", detail: `${names(onBasic)} ${onBasic.length === 1 ? "is" : "are"} charged NIC on basic pay only; everyone else on total pay.`, options: [{ value: "total", label: "Total pay for everyone" }, { value: "basic", label: "Basic pay for everyone" }, { value: "as_sheet", label: "Keep each row as the sheet does" }], recommended: "total" });
  const overCap = e.filter(x => x.nic > config.nic.maxContribution + 0.01);
  if (overCap.length) q.push({ id: "nicCap", question: `The sheet charges more NIC than the ${config.countryName} monthly maximum (${config.nic.maxContribution}). Which should we use?`, detail: `Affects ${names(overCap)}.`, options: [{ value: "law", label: `Apply the legal maximum of ${config.nic.maxContribution}` }, { value: "sheet", label: "Match the sheet (no maximum)" }], recommended: "law" });
  if (e.some(x => x.paye > 0)) q.push({ id: "payeMethod", question: "PAYE is typed in by hand on this sheet. How should the platform handle PAYE?", detail: `Tax codes found: ${[...new Set(e.map(x => x.taxCode.trim()).filter(Boolean))].join(", ")}. The platform can calculate PAYE with ${config.countryName} tax bands, or keep the sheet's amounts as fixed monthly PAYE.`, options: [{ value: "sheet", label: "Keep the sheet's PAYE as fixed amounts" }, { value: "calculated", label: "Calculate PAYE with the tax bands" }], recommended: "sheet" });
  const zeroTotal = e.filter(x => x.basic > 0 && x.total === 0);
  if (zeroTotal.length) q.push({ id: "zeroTotal", question: `${names(zeroTotal)}: basic salary is filled in but the total salary is 0. Was this person paid this month?`, detail: zeroTotal.map(x => `${x.name}: basic ${x.basic}, total 0, net ${x.net}`).join("; "), options: [{ value: "pay_basic", label: "Yes, pay the basic salary" }, { value: "not_paid", label: "No, not paid this month" }], recommended: "pay_basic" });
  const fixedDaily = e.filter(x => x.fixedDailyRate !== null);
  if (fixedDaily.length) q.push({ id: "dailyRule", question: "Some daily rates use a fixed amount instead of the employee's salary. Which rule should we use?", detail: `${names(fixedDaily)}: daily rate based on ${fixedDaily[0].fixedDailyRate} a month. Everyone else: monthly salary × 12 ÷ 52 ÷ 5.`, options: [{ value: "formula", label: "Use each employee's salary" }, { value: "as_sheet", label: "Keep the fixed amount" }], recommended: "formula" });
  if (sheet.groups > 1 || e.some(x => x.group > 0)) q.push({ id: "groups", question: "The sheet has a second section after the first sub-total. Who are these people?", detail: `Second section: ${names(e.filter(x => x.group > 0))}.`, options: [{ value: "Director", label: "Directors" }, { value: "Management", label: "Management" }, { value: "Staff", label: "Ordinary staff" }], recommended: "Director" });
  const unpaid = e.filter(x => x.basic === 0 && x.total === 0 && x.net === 0);
  if (unpaid.length) q.push({ id: "unpaid", question: `${unpaid.length} people have no pay at all this month. How should they be imported?`, detail: names(unpaid), options: [{ value: "Inactive", label: "Import as inactive" }, { value: "Active", label: "Import as active (pay set later)" }, { value: "skip", label: "Don't import them" }], recommended: "Inactive" });
  if (sheet.columns.department === undefined) q.push({ id: "department", question: "The sheet has no department column. What should we do for now?", detail: "Departments can be set later in each employee folder; they control departmental payroll and QuickBooks accounts.", options: [{ value: "Unassigned", label: "Put everyone in 'Unassigned'" }, { value: "General", label: "Put everyone in 'General'" }], recommended: "Unassigned" });
  if (e.some(x => x.travel || x.phone || x.onCall || x.commission || x.otherAllowance)) q.push({ id: "allowances", question: "Are the travel, phone, on-call and other allowances paid every month?", detail: names(e.filter(x => x.travel || x.phone || x.onCall || x.commission || x.otherAllowance)), options: [{ value: "recurring", label: "Yes, every month" }, { value: "once", label: "Only this month" }], recommended: "recurring" });
  return q;
}

export function rulesFromAnswers(answers: Record<string, string>): SheetRules {
  return { ...defaultRules,
    jurisdiction: answers.jurisdiction || defaultRules.jurisdiction,
    nicBasis: (answers.nicBasis as SheetRules["nicBasis"]) || defaultRules.nicBasis,
    payeMethod: (answers.payeMethod as SheetRules["payeMethod"]) || defaultRules.payeMethod,
    nicCap: (answers.nicCap as SheetRules["nicCap"]) || defaultRules.nicCap,
    zeroTotal: (answers.zeroTotal as SheetRules["zeroTotal"]) || defaultRules.zeroTotal,
    dailyRule: (answers.dailyRule as SheetRules["dailyRule"]) || defaultRules.dailyRule,
  };
}

/** Split "First Middle Last" into first + last name for an employee folder. */
export function splitName(full: string): { first_name: string; last_name: string } {
  const parts = full.trim().split(/\s+/);
  return parts.length === 1 ? { first_name: parts[0], last_name: "-" } : { first_name: parts.slice(0, -1).join(" "), last_name: parts[parts.length - 1] };
}

export { colIndex };
