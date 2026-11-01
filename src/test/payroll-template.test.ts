import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { readWorkbook } from "@/lib/read-workbook";
import { readOnboarding, HR_FIELD_HEADERS, DERIVED_FIELDS, COMPANY_KEYS, TEMPLATE_FILE } from "@/lib/onboarding-sheet";
import { emptyEmployee, type EmployeeForm } from "@/lib/employee-folder";
import { parseSalarySheet, platformPay, defaultRules } from "@/lib/salary-sheet";
import { PAYROLL_ITEMS } from "@/lib/qbo-items";

const buffer = readFileSync(resolve("public", TEMPLATE_FILE.replace(/^\//, "")));
const sheets = readWorkbook(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
const bundle = readOnboarding(sheets);
const payroll = sheets.find(s => s.name === "Payroll")!;
const parsed = parseSalarySheet(payroll.values, payroll.formulas);

describe("payroll onboarding template coverage", () => {
  it("maps every employee-folder field to a column or a stated derivation", () => {
    const uncovered = Object.keys(emptyEmployee).filter(field => !HR_FIELD_HEADERS[field as keyof EmployeeForm] && !DERIVED_FIELDS[field as keyof EmployeeForm]);
    expect(uncovered).toEqual([]);
  });

  it("carries every mapped column in the Employees sheet", () => {
    const header = bundle.employees.length ? sheets.find(s => s.name === "Employees")!.values[0].map(c => String(c ?? "").toUpperCase()) : [];
    const missing = Object.entries(HR_FIELD_HEADERS).filter(([, label]) => !header.includes(label)).map(([field]) => field);
    expect(missing).toEqual([]);
    expect(header).toContain("FIRST NAME");
    expect(header.length).toBeGreaterThanOrEqual(Object.keys(HR_FIELD_HEADERS).length);
  });

  it("carries every company setting the importer reads", () => {
    const settings = sheets.find(s => s.name === "Company")!.values.map(r => String(r[0] ?? "").trim().toLowerCase());
    const missing = Object.keys(COMPANY_KEYS).filter(key => !settings.includes(key));
    expect(missing).toEqual([]);
  });

  it("reads the finished template into full employee folders, entries, loans and account codes", () => {
    // Unchanged template examples are blanked and flagged, never saved as real details.
    expect(bundle.company.company_name).toBe("");
    expect(bundle.company.missing.some(m => m.startsWith("Company name"))).toBe(true);
    expect(bundle.company.missing.some(m => m.startsWith("Tax ID"))).toBe(true);
    expect(bundle.company.jurisdiction).toBe("LC");
    expect(bundle.company.employee_nic_rate).toBe(0.05);
    expect(bundle.company.quickbooks).toBe(false);
    expect(bundle.employees.length).toBe(3);
    expect(bundle.employees.filter(e => e.issues.length)).toEqual([]);
    const one = bundle.employees[0].values;
    expect(one.job_title).toBe("Office Clerk");
    expect(one.emergency_name).toBe("A. Person");
    expect(one.bank_account_number).toBe("123456789");
    expect(one.bank_account_type).toBe("Savings");
    expect(one.weekly_hours).toBe("40");
    expect(bundle.employees[1].values.pay_frequency).toBe("Weekly");
    expect(bundle.employees[2].values.staff_group).toBe("Director");
    expect(bundle.entries.map(e => `${e.kind}:${e.description}:${e.amount}`)).toEqual(["allowance:On-call allowance:250", "deduction:Medical insurance:50"]);
    expect(bundle.loans).toEqual([{ name: "Example Person Two", creditor: "Company staff advance", original: 1200, balance: 800, monthly: 100, notes: "Advance from July", row: 2 }]);
    expect(bundle.departments.map(d => d.department)).toEqual(["Administration", "Sales", "Management"]);
    expect(bundle.problems).toEqual([]);
  });

  it("posts only payroll items the platform recognises", () => {
    expect(bundle.accounts.length).toBe(12);
    expect(bundle.accounts.every(a => Boolean(PAYROLL_ITEMS[a.payroll_item]))).toBe(true);
    expect(bundle.accounts.find(a => a.payroll_item === "employer_nic")?.code).toBe("66070");
  });

  it("rebuilds the template's own payslips with the platform's rules", () => {
    expect(parsed.employees.length).toBe(3);
    const one = platformPay(parsed.employees[0], defaultRules);
    expect(one.gross).toBe(3250);
    expect(one.nic).toBe(162.5);
    expect(one.net).toBe(2954.37);
    const director = platformPay(parsed.employees[2], defaultRules);
    expect(director.nic).toBe(250);
    expect(director.net).toBe(11537.5);
  });
});
