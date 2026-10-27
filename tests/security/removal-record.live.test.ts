import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { expect, it } from "vitest";

// Opt-in fixture: account-free employee plus temporary company-super authority,
// provisioned through approved data tools; no auth account or real user is touched.
const env = Object.fromEntries(readFileSync(resolve(".env"), "utf8").split("\n").filter(line => /^VITE_/.test(line)).map(line => { const i = line.indexOf("="); return [line.slice(0, i), line.slice(i + 1).trim().replace(/^['"]|['"]$/g, "")]; }));
const minted = JSON.parse(readFileSync(process.env.LOVABLE_TEST_SESSION_FILE || resolve(homedir(), ".cache/lovable-auth/session.json"), "utf8"));
const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${minted.session.access_token}` } } });
it("evaluates the super-admin survivor check before loading the employee record", async () => {
  const employee = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbba9";
  const before = await client.from("company_super_administrators").select("user_id").eq("user_id", employee).single();
  expect(before.error).toBeNull(); expect(before.data?.user_id).toBe(employee);
  const removed = await client.functions.invoke("delete-employee", { body: { employee_id: employee, confirmation: "DELETE" } });
  expect(removed.error).toBeNull(); expect(removed.data?.success).toBe(true);
  expect(removed.data?.financial_history_retained).toBe(true);
  const after = await client.from("payroll_employee_directory").select("user_id").eq("user_id", employee);
  expect(after.error).toBeNull(); expect(after.data).toEqual([]);
});