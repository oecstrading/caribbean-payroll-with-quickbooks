// QuickBooks Online sync (sandbox/demo mode)
// Generates a journal entry payload from a payroll run and logs it.
// In sandbox mode no live QBO API calls are made — the payload is stored in qbo_sync_log
// and returned to the client for preview. When a real OAuth connection is wired,
// switch on env QBO_LIVE=true and replace the simulateQbo() call with a fetch to
// https://quickbooks.api.intuit.com/v3/company/{realmId}/journalentry .

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { buildPayrollJournal } from "../_shared/qbo-journal.ts";

interface SyncRequest {
  payroll_run_id: string;
  action?: "preview" | "sync";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const checks = await Promise.all(["quickbooks", "payroll"].map(module => userClient.rpc("has_workspace_access", { _user_id: userData.user.id, _module: module })));
    if (checks.some(check => check.error || !check.data)) {
      return new Response(JSON.stringify({ error: "Payroll and QuickBooks workspace access required" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: orgId, error: orgError } = await userClient.rpc("current_org_id");
    if (orgError || !orgId) return new Response(JSON.stringify({ error: "Company membership required" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const body: SyncRequest = await req.json();
    if (!body.payroll_run_id) {
      return new Response(JSON.stringify({ error: "payroll_run_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [{ data: run }, { data: slips }, { data: mappings }, { data: conn }] = await Promise.all([
      supabase.from("payroll_runs").select("*").eq("org_id", orgId).eq("id", body.payroll_run_id).maybeSingle(),
      supabase.from("payslips").select("*").eq("org_id", orgId).eq("payroll_run_id", body.payroll_run_id),
      supabase.from("qbo_account_mappings").select("*").eq("org_id", orgId),
      supabase.from("qbo_connection").select("*").eq("org_id", orgId).limit(1).maybeSingle(),
    ]);

    if (!run) {
      return new Response(JSON.stringify({ error: "Payroll run not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.action && body.action !== "preview" && body.action !== "sync") {
      return new Response(JSON.stringify({ error: "Unsupported action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const action = body.action || "preview";
    const { data: configuration, error: configurationError } = await userClient.rpc("company_configuration");
    if (configurationError || !configuration) {
      return new Response(JSON.stringify({ error: "Company configuration unavailable" }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (action === "sync" && configuration.demo_mode !== true) {
      return new Response(JSON.stringify({ error: "Live QuickBooks posting is not configured. Production sync is disabled." }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (action === "sync") {
      const { data: previous, error: previousError } = await supabase.from("qbo_sync_log").select("id").eq("org_id", orgId).eq("payroll_run_id", body.payroll_run_id).eq("sync_type", "journal_entry").in("status", ["synced", "synced_sandbox"]).limit(1);
      if (previousError) throw previousError;
      if (previous?.length) return new Response(JSON.stringify({ error: "Payroll run already synced; duplicate posting prevented" }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { lines } = buildPayrollJournal(slips ?? [], mappings ?? [], { requireMappedAccounts: false });

    const payload = {
      TxnDate: run.run_date,
      DocNumber: `PAY-${run.period}`,
      PrivateNote: `Payroll ${run.period} — ${run.employee_count} employees`,
      Line: lines,
    };

    const sandbox = true; // Live OAuth/API posting intentionally disabled until integration is implemented.

    let response: any = { mode: "sandbox", lines: lines.length, simulated: true };
    let qboId = "";
    let status = "preview";

    if (action === "sync") {
      if (sandbox) {
        qboId = `SANDBOX-JE-${Date.now()}`;
        status = "synced_sandbox";
        response.simulated = true;
        response.qbo_id = qboId;
      }
    }

    const { data: log } = await supabase
      .from("qbo_sync_log")
      .insert({
        org_id: orgId,
        payroll_run_id: body.payroll_run_id,
        sync_type: "journal_entry",
        qbo_entity_id: qboId,
        status,
        payload,
        response,
        created_by: userData.user.id,
      })
      .select()
      .single();

    return new Response(
      JSON.stringify({ success: true, payload, response, log_id: log?.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
