// Reads the customer onboarding template (public/templates/Payroll_Onboarding_Template_v2.xlsx).
// Every sheet maps onto fields the platform already stores: the Employees sheet carries one
// column per employee-folder field, Company carries the business and pay rules, and the
// remaining sheets feed recurring allowances, deductions, loans and QuickBooks account codes.
import { employeeFolderSchema, emptyEmployee, type EmployeeForm } from "./employee-folder";
import { PAYROLL_ITEMS } from "./qbo-items";
import { loanSchema } from "./employee-loans";
import type { Cell } from "./salary-sheet";
import type { WorkbookSheet } from "./read-workbook";

export const TEMPLATE_FILE = "/templates/Payroll_Onboarding_Template_v2.xlsx";
export const TEMPLATE_NAME = "Payroll_Onboarding_Template_v2.xlsx";

/** Every employee-folder field and the Employees-sheet column that fills it. */
export const HR_FIELD_HEADERS = {
  first_name: "FIRST NAME", last_name: "LAST NAME", email: "WORK EMAIL", personal_email: "PERSONAL EMAIL",
  phone: "PHONE", person_id: "EMPLOYEE NUMBER", department: "DEPARTMENT", job_title: "JOB TITLE",
  nic_number: "NIC NO", tan_number: "TAN NO", start_date: "DATE HIRED", schedule: "SCHEDULE",
  std_hours_per_day: "HOURS PER DAY", ot_rate: "O/T RATE", status: "STATUS", date_of_birth: "DATE OF BIRTH",
  gender: "GENDER", marital_status: "MARITAL STATUS", nationality: "NATIONALITY", address: "ADDRESS",
  city: "CITY", country: "COUNTRY OF RESIDENCE", emergency_name: "EMERGENCY CONTACT NAME",
  emergency_relationship: "EMERGENCY RELATIONSHIP", emergency_phone: "EMERGENCY PHONE",
  employment_type: "EMPLOYMENT TYPE", work_location: "WORK LOCATION", supervisor: "SUPERVISOR",
  probation_end: "PROBATION END", contract_end: "CONTRACT END", termination_date: "TERMINATION DATE",
  termination_reason: "TERMINATION REASON", pay_frequency: "PAY FREQUENCY", pay_rate: "PAY RATE",
  weekly_hours: "WEEKLY HOURS", notes: "NOTES", tax_code: "TAX CODE", paye_method: "TAX METHOD",
  paye_fixed_amount: "FIXED PAYE", nic_basis: "NIC BASIS", daily_rate_rule: "DAILY RATE RULE",
  fixed_daily_rate: "FIXED DAILY RATE", staff_group: "STAFF GROUP", cost_centre_code: "COST CENTRE CODE",
  bank_name: "BANK NAME", bank_branch: "BANK BRANCH", bank_account_number: "BANK ACCOUNT NUMBER",
  bank_account_type: "BANK ACCOUNT TYPE",
} as const;

/** Fields the platform stores but the sheet works out from a company-level answer instead. */
export const DERIVED_FIELDS: Partial<Record<keyof EmployeeForm, string>> = {
  jurisdiction: "Company sheet → Country",
  monthly_salary: "Pay rate × the pay frequency on the Employees sheet",
};

export const COMPANY_KEYS: Record<string, string> = {
  "company name": "company_name", country: "country", "employer nic number": "employer_nic_number",
  "tax id": "tax_id", "vat number": "vat_number", telephone: "telephone", website: "website", address: "address",
  "pay frequency": "pay_frequency", "pay day": "pay_day", "overtime multiplier": "ot_multiplier",
  "double-time multiplier": "ot2_multiplier", "hours per working day": "hours_per_day",
  "working days in month": "working_days", "default weekly hours": "weekly_hours",
  "employee nic rate": "employee_nic_rate", "employer nic rate": "employer_nic_rate",
  "nic monthly maximum": "nic_max", "nic worked out on": "nic_basis", "paye method": "paye_method",
  "sync with quickbooks": "quickbooks",
};

const COUNTRIES: Record<string, string> = {
  "saint lucia": "LC", "st lucia": "LC", "st. lucia": "LC", "antigua and barbuda": "AG", antigua: "AG",
  "st kitts and nevis": "KN", "saint kitts and nevis": "KN", dominica: "DM", grenada: "GD",
  "saint vincent and the grenadines": "VC", "st vincent and the grenadines": "VC",
};

export function countryToJurisdiction(name: string): string {
  return COUNTRIES[name.trim().toLowerCase()] || "";
}

const str = (value: Cell) => value instanceof Date ? value.toISOString().slice(0, 10) : String(value ?? "").trim();
const num = (value: Cell) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const n = Number(String(value ?? "").replace(/[,$\s%]/g, ""));
  return Number.isFinite(n) ? n : 0;
};
const yes = (value: Cell) => /^(y|yes|true|1)/i.test(str(value));
const blank = (row: Cell[]) => !row || row.every(c => str(c) === "");
const upper = (value: Cell) => str(value).toUpperCase();

export interface OnboardingCompany {
  company_name: string; country: string; jurisdiction: string; employer_nic_number: string; tax_id: string;
  vat_number: string; telephone: string; website: string; address: string; pay_frequency: string; pay_day: string;
  ot_multiplier: number; ot2_multiplier: number; hours_per_day: number; working_days: number; weekly_hours: number;
  employee_nic_rate: number; employer_nic_rate: number; nic_max: number; nic_basis: string; paye_method: string;
  quickbooks: boolean; missing: string[];
}

export interface OnboardingEmployee { name: string; values: EmployeeForm; issues: string[] }
export interface OnboardingEntry { name: string; kind: "allowance" | "deduction"; description: string; amount: number; recurring: boolean; creditor: string; row: number }
export interface OnboardingLoan { name: string; creditor: string; original: number; balance: number; monthly: number; notes: string; row: number }
export interface OnboardingAccount { payroll_item: string; code: string; name: string; type: string; row: number }
export interface OnboardingDepartment { department: string; cost_centre: string; accounts: Record<string, string>; row: number }
export interface OnboardingBundle {
  company: OnboardingCompany; employees: OnboardingEmployee[]; entries: OnboardingEntry[]; loans: OnboardingLoan[];
  accounts: OnboardingAccount[]; departments: OnboardingDepartment[]; sheetsFound: string[]; problems: string[];
}

const emptyCompany: OnboardingCompany = {
  company_name: "", country: "", jurisdiction: "", employer_nic_number: "", tax_id: "", vat_number: "", telephone: "",
  website: "", address: "", pay_frequency: "Monthly", pay_day: "", ot_multiplier: 1.5, ot2_multiplier: 2,
  hours_per_day: 8, working_days: 22, weekly_hours: 40, employee_nic_rate: 0.05, employer_nic_rate: 0.05,
  nic_max: 250, nic_basis: "Total pay", paye_method: "Calculated", quickbooks: false, missing: [],
};

function findSheet(sheets: WorkbookSheet[], match: (name: string, values: Cell[][]) => boolean) {
  return sheets.find(s => match(s.name.toLowerCase(), s.values)) || null;
}

function headerIndex(values: Cell[][], required: string) {
  return values.findIndex(row => row.some(c => upper(c) === required));
}

function columnsFromHeader(row: Cell[]) {
  const map: Record<string, number> = {};
  row.forEach((cell, i) => { const key = upper(cell); if (key && map[key] === undefined) map[key] = i; });
  return map;
}

function parseCompany(sheets: WorkbookSheet[]): OnboardingCompany {
  const sheet = findSheet(sheets, name => name === "company");
  const company: OnboardingCompany = { ...emptyCompany, missing: [] };
  if (!sheet) { company.missing.push("Company sheet"); return company; }
  for (const row of sheet.values) {
    const key = str(row[0]).toLowerCase();
    const field = COMPANY_KEYS[key];
    if (!field) continue;
    const value = row[1];
    if (field === "quickbooks") company.quickbooks = yes(value);
    else if (["ot_multiplier", "ot2_multiplier", "hours_per_day", "working_days", "weekly_hours", "nic_max"].includes(field)) {
      if (str(value)) (company as Record<string, unknown>)[field] = num(value);
    } else if (["employee_nic_rate", "employer_nic_rate"].includes(field)) {
      if (str(value)) { const n = num(value); (company as Record<string, unknown>)[field] = n > 1 ? n / 100 : n; }
    } else if (str(value)) (company as Record<string, unknown>)[field] = str(value);
  }
  company.jurisdiction = countryToJurisdiction(company.country);
  if (!company.company_name) company.missing.push("Company name");
  if (!company.jurisdiction) company.missing.push("Country (a supported OECS country)");
  return company;
}

function parseEmployees(sheets: WorkbookSheet[], problems: string[]): OnboardingEmployee[] {
  const sheet = findSheet(sheets, (name, values) => name.includes("employee") && headerIndex(values, "FIRST NAME") >= 0);
  if (!sheet) { problems.push("No Employees sheet found — the template's employee columns were not read."); return []; }
  const header = headerIndex(sheet.values, "FIRST NAME");
  const columns = columnsFromHeader(sheet.values[header]);
  const employees: OnboardingEmployee[] = [];
  for (let r = header + 1; r < sheet.values.length; r++) {
    const row = sheet.values[r];
    if (blank(row)) continue;
    const values = { ...emptyEmployee };
    for (const [field, label] of Object.entries(HR_FIELD_HEADERS) as [keyof EmployeeForm, string][]) {
      const col = columns[label];
      if (col === undefined) continue;
      const cell = row[col];
      const text = cell instanceof Date ? cell.toISOString().slice(0, 10) : str(cell);
      if (text !== "") (values as Record<string, unknown>)[field] = text;
    }
    const name = `${values.first_name} ${values.last_name}`.trim();
    if (!name) continue;
    const parsed = employeeFolderSchema.safeParse(values);
    const issues = parsed.success ? [] : Object.entries(parsed.error.flatten().fieldErrors)
      .map(([field, messages]) => `${field}: ${(messages || []).join(", ")}`);
    employees.push({ name, values: parsed.success ? parsed.data : values, issues });
  }
  return employees;
}

function parseEntries(sheets: WorkbookSheet[], problems: string[]): OnboardingEntry[] {
  const sheet = findSheet(sheets, (name, values) => name.includes("allowance") && headerIndex(values, "EMPLOYEE NAME") >= 0);
  if (!sheet) return [];
  const header = headerIndex(sheet.values, "EMPLOYEE NAME");
  const columns = columnsFromHeader(sheet.values[header]);
  const at = (row: Cell[], label: string) => columns[label] === undefined ? undefined : row[columns[label]];
  const entries: OnboardingEntry[] = [];
  for (let r = header + 1; r < sheet.values.length; r++) {
    const row = sheet.values[r];
    if (blank(row)) continue;
    const name = str(at(row, "EMPLOYEE NAME"));
    const description = str(at(row, "DESCRIPTION"));
    const amount = num(at(row, "MONTHLY AMOUNT"));
    if (!name || !description || amount <= 0) { problems.push(`Allowances & Deductions row ${r + 1}: needs an employee, a description and an amount above zero.`); continue; }
    entries.push({
      name, kind: /^ded/i.test(str(at(row, "TYPE"))) ? "deduction" : "allowance", description,
      amount: Math.round(amount * 100) / 100, recurring: str(at(row, "EVERY MONTH?")) === "" ? true : yes(at(row, "EVERY MONTH?")),
      creditor: str(at(row, "CREDITOR / LENDER")), row: r + 1,
    });
  }
  return entries;
}

function parseLoans(sheets: WorkbookSheet[], problems: string[]): OnboardingLoan[] {
  const sheet = findSheet(sheets, (name, values) => name.includes("loan") && headerIndex(values, "EMPLOYEE NAME") >= 0);
  if (!sheet) return [];
  const header = headerIndex(sheet.values, "EMPLOYEE NAME");
  const columns = columnsFromHeader(sheet.values[header]);
  const at = (row: Cell[], label: string) => columns[label] === undefined ? undefined : row[columns[label]];
  const loans: OnboardingLoan[] = [];
  for (let r = header + 1; r < sheet.values.length; r++) {
    const row = sheet.values[r];
    if (blank(row)) continue;
    const loan = {
      name: str(at(row, "EMPLOYEE NAME")), creditor: str(at(row, "LENDER / CREDITOR")),
      original: num(at(row, "ORIGINAL AMOUNT")), balance: num(at(row, "BALANCE STILL OWED")),
      monthly: num(at(row, "MONTHLY REPAYMENT")), notes: str(at(row, "NOTES")),
    };
    if (!loan.name || !loan.creditor) { problems.push(`Loans row ${r + 1}: needs an employee and a lender.`); continue; }
    const checked = loanSchema.safeParse({
      employee: "00000000-0000-4000-8000-000000000000", creditor: "00000000-0000-4000-8000-000000000001",
      original: loan.original, balance: loan.balance, monthly: loan.monthly, notes: loan.notes.slice(0, 500),
    });
    if (!checked.success) { problems.push(`Loans row ${r + 1} (${loan.name}): ${checked.error.issues[0]?.message || "invalid loan"}`); continue; }
    loans.push({ ...loan, row: r + 1 });
  }
  return loans;
}

function parseAccounts(sheets: WorkbookSheet[], problems: string[]): OnboardingAccount[] {
  const sheet = findSheet(sheets, (name, values) => name === "accounts" && headerIndex(values, "PAYROLL ITEM") >= 0);
  if (!sheet) return [];
  const header = headerIndex(sheet.values, "PAYROLL ITEM");
  const columns = columnsFromHeader(sheet.values[header]);
  const at = (row: Cell[], label: string) => columns[label] === undefined ? undefined : row[columns[label]];
  const accounts: OnboardingAccount[] = [];
  for (let r = header + 1; r < sheet.values.length; r++) {
    const row = sheet.values[r];
    if (blank(row)) continue;
    const item = str(at(row, "PAYROLL ITEM")).toLowerCase().replace(/\s+/g, "_");
    const code = str(at(row, "ACCOUNT CODE"));
    if (!item || !code) { problems.push(`Accounts row ${r + 1}: needs a payroll item and an account code.`); continue; }
    if (!PAYROLL_ITEMS[item]) { problems.push(`Accounts row ${r + 1}: "${item}" is not a payroll item the platform posts.`); continue; }
    accounts.push({ payroll_item: item, code, name: str(at(row, "ACCOUNT NAME")) || PAYROLL_ITEMS[item], type: str(at(row, "ACCOUNT TYPE")) || "Expense", row: r + 1 });
  }
  return accounts;
}

function parseDepartments(sheets: WorkbookSheet[], problems: string[]): OnboardingDepartment[] {
  const sheet = findSheet(sheets, (name, values) => name.includes("department") && headerIndex(values, "DEPARTMENT") >= 0);
  if (!sheet) return [];
  const header = headerIndex(sheet.values, "DEPARTMENT");
  const columns = columnsFromHeader(sheet.values[header]);
  const departments: OnboardingDepartment[] = [];
  for (let r = header + 1; r < sheet.values.length; r++) {
    const row = sheet.values[r];
    if (blank(row)) continue;
    const department = str(row[columns["DEPARTMENT"]]);
    if (!department) { problems.push(`Departments row ${r + 1}: the department name is blank.`); continue; }
    const accounts: Record<string, string> = {};
    for (const [label, col] of Object.entries(columns)) {
      if (label === "DEPARTMENT" || label === "COST CENTRE CODE") continue;
      const value = str(row[col]);
      if (value) accounts[label.toLowerCase().replace(/ account$/, "")] = value;
    }
    departments.push({ department, cost_centre: str(row[columns["COST CENTRE CODE"]]), accounts, row: r + 1 });
  }
  return departments;
}

/** Read every onboarding sheet the workbook carries, leaving the Payroll sheet to the pay reader. */
export function readOnboarding(sheets: WorkbookSheet[]): OnboardingBundle {
  const problems: string[] = [];
  const company = parseCompany(sheets);
  const employees = parseEmployees(sheets, problems);
  const entries = parseEntries(sheets, problems);
  const loans = parseLoans(sheets, problems);
  const accounts = parseAccounts(sheets, problems);
  const departments = parseDepartments(sheets, problems);
  const names = new Set(employees.map(e => e.name.toLowerCase()));
  for (const item of [...entries, ...loans]) {
    if (!names.has(item.name.toLowerCase())) problems.push(`"${item.name}" on row ${item.row} has no matching employee on the Employees sheet.`);
  }
  const departmentNames = new Set(departments.map(d => d.department.toLowerCase()));
  for (const employee of employees) {
    const department = employee.values.department.trim();
    if (department && departmentNames.size && !departmentNames.has(department.toLowerCase())) {
      problems.push(`${employee.name}: department "${department}" is not listed on the Departments sheet.`);
    }
  }
  return {
    company, employees, entries, loans, accounts, departments,
    sheetsFound: sheets.map(s => s.name), problems,
  };
}
