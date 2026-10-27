import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import bcrypt from "npm:bcryptjs@2.4.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !serviceRoleKey || !anonKey) throw new Error("Service unavailable");

    // Verify caller is admin/manager
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

    // Check caller role
    const { data: roleCheck } = await adminClient.from("user_roles").select("role").eq("user_id", caller.id).single();
    if (roleCheck?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: access, error: accessError } = await callerClient.rpc("has_workspace_access", { _user_id: caller.id, _module: "hr" });
    if (accessError || !access) return new Response(JSON.stringify({ error: "Employee management access required" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { user_id, pin } = await req.json();

    if (typeof user_id !== "string" || !/^[0-9a-f-]{36}$/i.test(user_id) || typeof pin !== "string") {
      return new Response(JSON.stringify({ error: "user_id and pin are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!/^\d{4,6}$/.test(pin)) {
      return new Response(JSON.stringify({ error: "PIN must be 4-6 digits" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: orgId, error: orgError } = await callerClient.rpc("current_org_id");
    const { data: targetOrg, error: targetError } = await callerClient.rpc("employee_org_id", { _employee: user_id });
    if (orgError || targetError || !orgId || targetOrg !== orgId) return new Response(JSON.stringify({ error: "Employee is not in your company" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const [{ data: targetRole }, { data: authority }, { data: targetAuthority }] = await Promise.all([
      adminClient.from("user_roles").select("role").eq("user_id", user_id).single(),
      callerClient.rpc("administrator_authority", { _user: caller.id }),
      callerClient.rpc("administrator_authority", { _user: user_id }),
    ]);
    if (user_id !== caller.id && ((targetRole?.role === "admin" && authority?.company_super_admin !== true) || (targetAuthority?.platform_super_admin === true && authority?.platform_super_admin !== true))) return new Response(JSON.stringify({ error: "Super administrator authority required" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const hashHex = await bcrypt.hash(pin, 12);

    // Upsert pin
    const { error } = await adminClient
      .from("user_pins")
      .upsert(
        { org_id: orgId, user_id, pin_hash: hashHex, is_enabled: true, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await adminClient.from("user_pin_attempts").delete().eq("user_id", user_id);
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
