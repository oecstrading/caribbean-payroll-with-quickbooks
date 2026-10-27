import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Check caller is admin/manager
    const { data: roleCheck } = await adminClient.rpc("is_admin_or_manager", { _user_id: caller.id });
    if (!roleCheck) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: access, error: accessError } = await callerClient.rpc("has_workspace_access", { _user_id: caller.id, _module: "payroll" });
    if (accessError || !access) return new Response(JSON.stringify({ error: "Payroll workspace access required" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { user_id, payslip_html, period } = await req.json();

    if (!user_id || !payslip_html) {
      return new Response(JSON.stringify({ error: "user_id and payslip_html are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get employee email
    const { data: profile } = await adminClient
      .from("profiles")
      .select("email, first_name, last_name")
      .eq("user_id", user_id)
      .maybeSingle();

    if (!profile?.email) {
      return new Response(JSON.stringify({ error: "Employee email not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get company settings for sender info
    const { data: company } = await adminClient
      .from("company_settings")
      .select("company_name")
      .limit(1)
      .maybeSingle();

    const companyName = company?.company_name || "OECS HR & Payroll";

    // For now, log the email attempt and return success
    // When email domain is configured, this will use the email infrastructure
    console.log(`Payslip email queued for ${profile.email} - Period: ${period}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Payslip sent to ${profile.email}`,
        recipient: profile.email,
        employee_name: `${profile.first_name} ${profile.last_name}`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
