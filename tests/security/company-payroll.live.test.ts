import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

// No service-role credentials: every assertion uses the requesting admin's RLS-bound session.
const env = Object.fromEntries(readFileSync(resolve(".env"), "utf8").split("\n").filter(line => /^VITE_/.test(line)).map(line => { const i = line.indexOf("="); return [line.slice(0, i), line.slice(i + 1).trim().replace(/^['"]|['"]$/g, "")]; }));
const minted = JSON.parse(readFileSync(process.env.LOVABLE_TEST_SESSION_FILE || resolve(homedir(), ".cache/lovable-auth/session.json"), "utf8"));
const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${minted.session.access_token}` } } });
const own = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2";
const foreign = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3";
const org = "11111111-1111-4111-8111-111111111111";
const creditor = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4";
let loanId: string;
const row = (changes = {}) => ({ user_id: own, department: "Automated security verification", basic_pay: 2600, overtime_pay: 0, gross_pay: 2600, employee_nic: 130, employer_nic: 130, paye: 100, total_deductions: 265, net_pay: 2335, loan_deductions: 35, ...changes });
const approve = (rows = [row()], start = "2097-02-01", end = "2097-02-28") => client.rpc("approve_payroll_run", { _pay_type: "custom", _start: start, _end: end, _jurisdiction: "LC", _departments: ["Automated security verification"], _rows: rows, _notes: `Automated security verification ${own}` });
const snapshot = async () => {
  const [loans, repayments, slips, runs] = await Promise.all([
    client.from("employee_loans").select("balance,is_active").eq("id", loanId).single(),
    client.from("loan_repayments").select("id,amount").eq("user_id", own),
    client.from("employee_payslips").select("id,net_pay,total_deductions").eq("user_id", own),
    client.from("payroll_runs").select("id").eq("notes", `Automated security verification ${own}`),
  ]);
  for (const r of [loans, repayments, slips, runs]) expect(r.error).toBeNull();
  return { loan: loans.data, repayments: repayments.data, slips: slips.data, runs: runs.data };
};
describe.sequential("live company isolation and atomic payroll approval", () => {
  beforeAll(async () => {
    const membership = await client.rpc("current_org_id"); expect(membership.error).toBeNull(); expect(membership.data).toBe(org);
    const employee = await client.from("employee_records").select("user_id").eq("user_id", own).single(); expect(employee.error, "Apply scripts/security-tests/setup.sql first").toBeNull();
    const result = await client.rpc("create_employee_loan", { _employee: own, _creditor: creditor, _original: 800, _balance: 35, _monthly: 100, _notes: "Automated security verification" });
    expect(result.error).toBeNull(); expect(typeof result.data).toBe("string"); loanId = result.data;
  });
  it("hides another company's employees and creditors", async () => {
    for (const [table, key, id] of [["employee_records", "user_id", foreign], ["creditors", "id", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5"]]) {
      const r = await client.from(table).select("*").eq(key, id); expect(r.error).toBeNull(); expect(r.data).toEqual([]);
    }
  });
  it("prevents changing another company's employee", async () => {
    const r = await client.from("employee_records").update({ first_name: "Unauthorized" }).eq("user_id", foreign).select("user_id"); expect(r.data || []).toEqual([]);
  });
  it("rejects inserting a row into another company", async () => {
    const r = await client.from("employee_deductions").insert({ user_id: own, creditor_id: creditor, amount: 100, org_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1" }); expect(r.error).not.toBeNull();
  });
  it("rejects cross-company employee loan creation", async () => {
    const r = await client.rpc("create_employee_loan", { _employee: foreign, _creditor: creditor, _original: 800, _balance: 500, _monthly: 100 }); expect(r.error?.message).toContain("your company");
  });
  it("rejects cross-company creditor loan creation", async () => {
    const r = await client.rpc("create_employee_loan", { _employee: own, _creditor: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5", _original: 800, _balance: 500, _monthly: 100 }); expect(r.error?.message).toContain("your company");
  });
  it("rejects payroll for another company's employee", async () => {
    const before = await snapshot(); const r = await approve([row({ user_id: foreign })]); expect(r.error?.message).toContain("not active"); expect(await snapshot()).toEqual(before);
  });
  it("rejects a salary changed since preview", async () => {
    const before = await snapshot(); const r = await approve([row({ basic_pay: 2599 })]); expect(r.error?.message).toContain("Salary changed"); expect(await snapshot()).toEqual(before);
  });
  it("rejects duplicate employee rows", async () => {
    const before = await snapshot(); const r = await approve([row(), row()]); expect(r.error?.message).toContain("Duplicate employee"); expect(await snapshot()).toEqual(before);
  });
  it("rejects a repayment not withheld from net pay", async () => {
    const before = await snapshot(); const r = await approve([row({ total_deductions: 230, net_pay: 2370 })]); expect(r.error?.message).toContain("withheld"); expect(await snapshot()).toEqual(before);
  });
  it("rolls back run, payslip and balance after stale loan preview", async () => {
    const before = await snapshot(); const r = await approve([row({ loan_deductions: 34, total_deductions: 264, net_pay: 2336 })]); expect(r.error?.message).toContain("Loan balance changed"); expect(await snapshot()).toEqual(before);
  });
  it("atomically approves payroll and caps repayment at the remaining 35", async () => {
    const r = await approve(); expect(r.error).toBeNull(); expect(typeof r.data).toBe("string");
    const after = await snapshot(); expect(after.loan).toEqual({ balance: 0, is_active: false }); expect(after.repayments).toHaveLength(1); expect(after.repayments?.[0].amount).toBe(35); expect(after.slips).toHaveLength(1); expect(after.slips?.[0]).toMatchObject({ net_pay: 2335, total_deductions: 265 }); expect(after.runs).toHaveLength(1);
  });
  it("rejects a second approval of the same paid dates", async () => {
    const before = await snapshot(); const r = await approve(); expect(r.error?.message).toContain("already paid"); expect(await snapshot()).toEqual(before);
  });
  it("rejects a partially overlapping paid date range", async () => {
    const before = await snapshot(); const r = await approve([row()], "2097-02-15", "2097-03-01"); expect(r.error?.message).toContain("already paid"); expect(await snapshot()).toEqual(before);
  });
  it("denies direct payroll-run writes outside the approval RPC", async () => {
    const r = await client.from("payroll_runs").insert({ period: "2097-02", status: "approved", total_gross: 2600, total_deductions: 265, total_net: 2335, employee_count: 1 }); expect(r.error).not.toBeNull();
  });
});