import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

// Opt-in live test: disposable fixtures only; every assertion uses requesting-user RLS.
const env = Object.fromEntries(readFileSync(resolve(".env"), "utf8").split("\n").filter(line => /^VITE_/.test(line)).map(line => { const i = line.indexOf("="); return [line.slice(0, i), line.slice(i + 1).trim().replace(/^['"]|['"]$/g, "")]; }));
const minted = JSON.parse(readFileSync(process.env.LOVABLE_TEST_SESSION_FILE || resolve(homedir(), ".cache/lovable-auth/session.json"), "utf8"));
const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${minted.session.access_token}` } } });
const employee = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1";
describe.sequential("permanent employee removal with financial retention", () => {
  it("requires confirmation without changing the employee", async () => {
    const r = await client.functions.invoke("delete-employee", { body: { employee_id: employee, confirmation: "" } });
    expect(r.error).not.toBeNull();
    const p = await client.from("employee_records").select("permanently_deleted_at").eq("user_id", employee).single();
    expect(p.error).toBeNull(); expect(p.data?.permanently_deleted_at).toBeNull();
  });
  it("blocks direct access to privileged removal RPC", async () => {
    const r = await client.rpc("prepare_employee_removal", { _actor: minted.user_id, _employee: employee, _confirmation: "DELETE" });
    expect(r.error).not.toBeNull();
  });
  it("rejects self removal", async () => {
    const r = await client.functions.invoke("delete-employee", { body: { employee_id: minted.session.user.id, confirmation: "DELETE" } });
    expect(r.error).not.toBeNull();
  });
  it("removes the employee from the live directory", async () => {
    const r = await client.functions.invoke("delete-employee", { body: { employee_id: employee, confirmation: "DELETE" } });
    expect(r.error).toBeNull(); expect(r.data?.success).toBe(true);
    const p = await client.from("payroll_employee_directory").select("user_id").eq("user_id", employee);
    expect(p.error).toBeNull(); expect(p.data).toEqual([]);
  });
  it("preserves payslip amounts and shared run totals", async () => {
    const p = await client.from("employee_payslips").select("gross_pay,total_deductions,net_pay").eq("user_id", employee).single();
    expect(p.error).toBeNull(); expect(p.data).toEqual({ gross_pay: 1000, total_deductions: 150, net_pay: 850 });
    const r = await client.from("payroll_runs").select("total_net,employee_count").eq("id", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3").single();
    expect(r.error).toBeNull(); expect(r.data).toEqual({ total_net: 850, employee_count: 1 });
  });
  it("retains repayments and balance but pauses future deductions", async () => {
    const r = await client.from("loan_repayments").select("amount").eq("user_id", employee).single();
    expect(r.error).toBeNull(); expect(r.data?.amount).toBe(100);
    const l = await client.from("employee_loans").select("balance,is_active").eq("user_id", employee).single();
    expect(l.error).toBeNull(); expect(l.data).toEqual({ balance: 400, is_active: false });
  });
  it("cannot reactivate removed employee loan", async () => {
    const r = await client.rpc("set_employee_loan_active", { _loan: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb5", _active: true });
    expect(r.error?.message).toContain("cannot be reactivated");
  });
  it("cannot restore a permanently removed employee", async () => {
    const r = await client.from("employee_records").update({ deleted_at: null }).eq("user_id", employee);
    expect(r.error?.message).toContain("cannot be edited or restored");
  });
});