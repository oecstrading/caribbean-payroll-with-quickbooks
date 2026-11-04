// ERPNext (open-source accounting) connector: save credentials, test, list accounts,
// preview and post payroll journal entries. Credentials never leave the server.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.25.76";

const ITEMS = ["gross_wages", "overtime", "employer_nic", "employee_nic_payable", "paye_payable", "creditor_deductions", "net_pay_clearing"] as const;
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save"), base_url: z.string().url().max(200), erp_company: z.string().trim().min(1).max(140), api_key: z.string().trim().max(100).optional(), api_secret: z.string().trim().max(100).optional(), auto_post: z.boolean().default(true) }),
  z.object({ action: z.literal("test") }),
  z.object({ action: z.literal("accounts") }),
  z.object({ action: z.literal("disconnect") }),
  z.object({ action: z.enum(["preview", "sync"]), payroll_run_id: z.string().uuid(), auto: z.boolean().optional() }),
]);
const reply = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const r2 = (n: number) => Math.round(n * 100) / 100;

function cleanUrl(u: string) {
  const url = new URL(u);
  if (url.protocol !== "https:") throw new Error("ERPNext address must start with https://");
  const h = url.hostname;
  if (h === "localhost" || /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h)) throw new Error("ERPNext address must be a public site");
  return url.origin;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return reply({ error: "Sign in required" }, 401);
    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const caller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await caller.auth.getUser();
    if (!user) return reply({ error: "Sign in required" }, 401);
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return reply({ error: "Invalid request" }, 400);
    const body = parsed.data;
    const [acc, pay, mgr, org] = await Promise.all([
      caller.rpc("has_workspace_access", { _user_id: user.id, _module: "quickbooks" }),
      caller.rpc("has_workspace_access", { _user_id: user.id, _module: "payroll" }),
      caller.rpc("is_admin_or_manager", { _user_id: user.id }),
      caller.rpc("current_org_id"),
    ]);
    if (!org.data) return reply({ error: "Company membership required" }, 403);
    if (!acc.data || !mgr.data) return reply({ error: "Accounting access (admin or manager) required" }, 403);
    const orgId = org.data as string;

    const { data: conn } = await admin.from("erpnext_connection").select("*").eq("org_id", orgId).maybeSingle();
    const erp = async (path: string, init: RequestInit = {}) => {
      if (!conn) throw new Error("Connect ERPNext first");
      const res = await fetch(`${conn.base_url}${path}`, { ...init, headers: { Authorization: `token ${conn.api_key}:${conn.api_secret}`, Accept: "application/json", "Content-Type": "application/json" }, signal: AbortSignal.timeout(20000) });
      const text = await res.text();
      let json: any = null; try { json = JSON.parse(text); } catch { /* not json */ }
      if (!res.ok) {
        let msg = json?.exception || json?.message || `ERPNext replied ${res.status}`;
        try { if (json?._server_messages) msg = JSON.parse(JSON.parse(json._server_messages)[0]).message; } catch { /* keep */ }
        throw new Error(String(msg).replace(/<[^>]+>/g, "").slice(0, 300));
      }
      return json;
    };

    if (body.action === "save") {
      const base = cleanUrl(body.base_url);
      const key = body.api_key || conn?.api_key, secret = body.api_secret || conn?.api_secret;
      if (!key || !secret) return reply({ error: "Enter the ERPNext API key and secret" }, 400);
      const { error } = await admin.from("erpnext_connection").upsert({ org_id: orgId, base_url: base, erp_company: body.erp_company, api_key: key, api_secret: secret, auto_post: body.auto_post, status: "untested", last_message: null, updated_by: user.id, updated_at: new Date().toISOString() }, { onConflict: "org_id" });
      if (error) return reply({ error: error.message }, 400);
      return reply({ success: true });
    }
    if (body.action === "disconnect") {
      await admin.from("erpnext_connection").delete().eq("org_id", orgId);
      return reply({ success: true });
    }
    if (body.action === "test") {
      try {
        const who = await erp("/api/method/frappe.auth.get_logged_user");
        const co = await erp(`/api/resource/Company/${encodeURIComponent(conn!.erp_company)}`);
        const msg = `Connected as ${who.message} · company ${co.data?.name}`;
        await admin.from("erpnext_connection").update({ status: "connected", last_message: msg, last_tested_at: new Date().toISOString() }).eq("org_id", orgId);
        return reply({ success: true, message: msg });
      } catch (e) {
        const msg = (e as Error).message;
        await admin.from("erpnext_connection").update({ status: "error", last_message: msg, last_tested_at: new Date().toISOString() }).eq("org_id", orgId);
        return reply({ error: msg }, 400);
      }
    }
    if (body.action === "accounts") {
      const filters = encodeURIComponent(JSON.stringify([["company", "=", conn?.erp_company ?? ""], ["is_group", "=", 0]]));
      const fields = encodeURIComponent(JSON.stringify(["name", "account_type", "root_type"]));
      const data = await erp(`/api/resource/Account?filters=${filters}&fields=${fields}&limit_page_length=1000&order_by=name%20asc`);
      return reply({ accounts: data.data ?? [] });
    }

    // preview / sync
    if (!pay.data) return reply({ error: "Payroll access required" }, 403);
    const [{ data: run }, { data: slipsA }, { data: slipsB }, { data: maps }] = await Promise.all([
      admin.from("payroll_runs").select("*").eq("org_id", orgId).eq("id", body.payroll_run_id).maybeSingle(),
      admin.from("payslips").select("*").eq("org_id", orgId).eq("payroll_run_id", body.payroll_run_id),
      admin.from("employee_payslips").select("*").eq("org_id", orgId).eq("payroll_run_id", body.payroll_run_id),
      admin.from("erpnext_account_mappings").select("payroll_item,erp_account").eq("org_id", orgId),
    ]);
    if (!run) return reply({ error: "Payroll run not found" }, 404);
    const slips = [...(slipsA ?? []), ...(slipsB ?? [])];
    const m = Object.fromEntries((maps ?? []).map((r) => [r.payroll_item, r.erp_account]));
    const t = (slips ?? []).reduce((a: any, s: any) => ({
      gross: a.gross + Number(s.gross_pay || 0) - Number(s.overtime_pay || 0),
      ot: a.ot + Number(s.overtime_pay || 0),
      empNic: a.empNic + Number(s.employee_nic || 0), erNic: a.erNic + Number(s.employer_nic || 0),
      paye: a.paye + Number(s.paye || 0), net: a.net + Number(s.net_pay || 0),
      other: a.other + Number(s.total_deductions || 0) - Number(s.employee_nic || 0) - Number(s.paye || 0),
    }), { gross: 0, ot: 0, empNic: 0, erNic: 0, paye: 0, net: 0, other: 0 });
    const lines: { item: string; account: string; debit: number; credit: number }[] = [];
    const add = (item: string, amt: number, side: "d" | "c") => { if (r2(amt) > 0) lines.push({ item, account: m[item] ?? "", debit: side === "d" ? r2(amt) : 0, credit: side === "c" ? r2(amt) : 0 }); };
    add("gross_wages", t.gross, "d"); add("overtime", t.ot, "d"); add("employer_nic", t.erNic, "d");
    add("employee_nic_payable", t.empNic + t.erNic, "c"); add("paye_payable", t.paye, "c"); add("creditor_deductions", t.other, "c");
    const debit = r2(lines.reduce((s, l) => s + l.debit, 0)), creditSoFar = r2(lines.reduce((s, l) => s + l.credit, 0));
    add("net_pay_clearing", debit - creditSoFar, "c"); // balances the entry to the cent
    const missing = [...new Set(lines.filter((l) => !l.account).map((l) => l.item))];
    const result = { lines, total: debit, missing, period: run.period, posting_date: run.period_end ?? run.run_date ?? new Date().toISOString().slice(0, 10) };
    if (body.action === "preview") return reply(result);

    if (!conn || conn.status !== "connected") return reply({ error: "Test the ERPNext connection before posting" }, 409);
    if (body.auto && !conn.auto_post) return reply({ skipped: true });
    if (missing.length) return reply({ error: `Map these payroll items to ERPNext accounts first: ${missing.join(", ")}` }, 409);
    const { data: done } = await admin.from("qbo_sync_log").select("qbo_entity_id").eq("org_id", orgId).eq("payroll_run_id", body.payroll_run_id).eq("sync_type", "erpnext_journal_entry").eq("status", "synced").limit(1).maybeSingle();
    if (done) return reply({ error: `Already posted to ERPNext as ${done.qbo_entity_id}` }, 409);
    const payload = {
      doctype: "Journal Entry", voucher_type: "Journal Entry", company: conn.erp_company, posting_date: result.posting_date,
      user_remark: `Payroll ${run.period} — ${run.employee_count ?? (slips ?? []).length} employees (OECS Payroll)`, docstatus: 1,
      accounts: lines.map((l) => ({ account: l.account, debit_in_account_currency: l.debit, credit_in_account_currency: l.credit, user_remark: l.item })),
    };
    try {
      const res = await erp("/api/resource/Journal%20Entry", { method: "POST", body: JSON.stringify(payload) });
      const name = res.data?.name;
      await admin.from("qbo_sync_log").insert({ org_id: orgId, payroll_run_id: body.payroll_run_id, sync_type: "erpnext_journal_entry", qbo_entity_id: name, status: "synced", payload, response: { name }, created_by: user.id });
      return reply({ success: true, name, total: debit });
    } catch (e) {
      const msg = (e as Error).message;
      await admin.from("qbo_sync_log").insert({ org_id: orgId, payroll_run_id: body.payroll_run_id, sync_type: "erpnext_journal_entry", status: "failed", payload, response: { error: msg }, created_by: user.id });
      return reply({ error: msg }, 400);
    }
  } catch (e) {
    return reply({ error: (e as Error).message || "ERPNext request failed" }, 400);
  }
});
