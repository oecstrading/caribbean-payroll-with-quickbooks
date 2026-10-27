// QuickBooks Online sync (sandbox/demo mode)
// Generates a journal entry payload from a payroll run and logs it.
// In sandbox mode no live QBO API calls are made — the payload is stored in qbo_sync_log
// and returned to the client for preview. When a real OAuth connection is wired,
// switch on env QBO_LIVE=true and replace the simulateQbo() call with a fetch to
// https://quickbooks.api.intuit.com/v3/company/{realmId}/journalentry .

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

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

    const m = Object.fromEntries((mappings ?? []).map((r: any) => [r.payroll_item, r]));
    const totals = (slips ?? []).reduce(
      (a: any, s: any) => ({
        gross: a.gross + Number(s.basic_pay || 0),
        ot: a.ot + Number(s.overtime_pay || 0),
        empNic: a.empNic + Number(s.employee_nic || 0),
        erNic: a.erNic + Number(s.employer_nic || 0),
        paye: a.paye + Number(s.paye || 0),
        net: a.net + Number(s.net_pay || 0),
        otherDed: a.otherDed +
          Number(s.total_deductions || 0) -
          Number(s.employee_nic || 0) -
          Number(s.paye || 0),
      }),
      { gross: 0, ot: 0, empNic: 0, erNic: 0, paye: 0, net: 0, otherDed: 0 },
    );

    const line = (item: string, amount: number, postingType: "Debit" | "Credit") => ({
      Amount: Math.round(amount * 100) / 100,
      DetailType: "JournalEntryLineDetail",
      Description: m[item]?.qbo_account_name || item,
      JournalEntryLineDetail: {
        PostingType: postingType,
        AccountRef: {
          value: m[item]?.qbo_account_id || `MOCK-${item}`,
          name: m[item]?.qbo_account_name || item,
        },
      },
    });

    const lines: any[] = [];
    if (totals.gross > 0) lines.push(line("gross_wages", totals.gross, "Debit"));
    if (totals.ot > 0) lines.push(line("overtime", totals.ot, "Debit"));
    if (totals.erNic > 0) lines.push(line("employer_nic", totals.erNic, "Debit"));
    if (totals.empNic > 0) lines.push(line("employee_nic_payable", totals.empNic + totals.erNic, "Credit"));
    if (totals.paye > 0) lines.push(line("paye_payable", totals.paye, "Credit"));
    if (totals.otherDed > 0) lines.push(line("creditor_deductions", totals.otherDed, "Credit"));
    if (totals.net > 0) lines.push(line("net_pay_clearing", totals.net, "Credit"));

    const payload = {
      TxnDate: run.run_date,
      DocNumber: `PAY-${run.period}`,
      PrivateNote: `Payroll ${run.period} — ${run.employee_count} employees`,
      Line: lines,
    };

    const action = body.action || "preview";
    const { data: configuration } = await userClient.rpc("company_configuration");
    if (action === "sync" && configuration?.demo_mode !== true) {
      return new Response(JSON.stringify({ error: "A real QuickBooks connection is required. Simulated posting is disabled for production companies." }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const sandbox = !conn || conn.environment === "sandbox" || conn.status !== "connected";

    let response: any = { mode: sandbox ? "sandbox" : "live", lines: lines.length };
    let qboId = "";
    let status = "preview";

    if (action === "sync") {
      if (sandbox) {
        qboId = `SANDBOX-JE-${Date.now()}`;
        status = "synced_sandbox";
        response.simulated = true;
        response.qbo_id = qboId;
      } else {
        // Live mode placeholder — wire real Intuit API here
        qboId = `LIVE-JE-${Date.now()}`;
        status = "synced";
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
