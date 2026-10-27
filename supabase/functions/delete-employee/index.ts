import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { removalAllowed, validRemovalBody } from "./policy.ts";

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } });
Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const anon = Deno.env.get("SUPABASE_ANON_KEY");
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY");
    const authorization = req.headers.get("Authorization");
    if (!url || !anon || !service) return reply({ error: "Employee removal is temporarily unavailable" }, 503);
    if (!authorization) return reply({ error: "Sign in to continue" }, 401);
    const caller = createClient(url, anon, { global: { headers: { Authorization: authorization } } });
    const { data: { user }, error: authError } = await caller.auth.getUser();
    if (authError || !user) return reply({ error: "Sign in to continue" }, 401);
    const body: unknown = await req.json();
    if (!validRemovalBody(body)) return reply({ error: "Choose an employee and type DELETE to confirm" }, 400);
    const admin = createClient(url, service);
    const [actor, roles, hr, profile, record, targetRoles, platform, superAdmin, actorPlatform] = await Promise.all([
      admin.from("profiles").select("org_id,deleted_at").eq("user_id", user.id).maybeSingle(),
      admin.from("user_roles").select("role").eq("user_id", user.id),
      caller.rpc("has_workspace_access", { _user_id: user.id, _module: "hr" }),
      admin.from("profiles").select("org_id").eq("user_id", body.employee_id).maybeSingle(),
      admin.from("employee_records").select("org_id").eq("user_id", body.employee_id).maybeSingle(),
      admin.from("user_roles").select("role").eq("user_id", body.employee_id),
      admin.from("platform_administrators").select("user_id").eq("user_id", body.employee_id).maybeSingle(),
      admin.rpc("is_company_super_admin", { _user: user.id }),
      admin.from("platform_administrators").select("user_id").eq("user_id", user.id).maybeSingle(),
    ]);
    if ([actor, roles, hr, profile, record, targetRoles, platform, superAdmin, actorPlatform].some(r => r.error)) return reply({ error: "Unable to verify removal permissions" }, 503);
    if (actor.data?.deleted_at || !removalAllowed({ id: user.id, org_id: actor.data?.org_id ?? null, admin: Boolean(roles.data?.some(r => r.role === "admin")), hr: hr.data === true, superAdmin: superAdmin.data === true, platform: Boolean(actorPlatform.data) }, { id: body.employee_id, org_id: profile.data?.org_id ?? record.data?.org_id ?? null, admin: Boolean(targetRoles.data?.some(r => r.role === "admin")), platform: Boolean(platform.data) })) return reply({ error: "Company super administrator authority is required to remove administrators; you cannot delete yourself or another company's users" }, 403);
    const { data: job, error: prepareError } = await admin.rpc("prepare_employee_removal", { _actor: user.id, _employee: body.employee_id, _confirmation: body.confirmation });
    if (prepareError || !job) return reply({ error: prepareError?.message || "Unable to prepare removal" }, 400);
    if (job.status === "complete") return reply({ success: true, financial_history_retained: true });
    if (job.storage_paths.length) {
      const { error } = await admin.storage.from("employee-hr-docs").remove(job.storage_paths);
      if (error) return reply({ error: "Employee access is disabled and financial records are safe, but file cleanup failed. Click Delete permanently again to finish." }, 503);
    }
    if (job.account_linked) {
      const { error } = await admin.auth.admin.deleteUser(body.employee_id);
      if (error && error.code !== "user_not_found") return reply({ error: "Employee access is disabled and financial records are safe, but account removal could not finish. Click Delete permanently again to retry." }, 503);
    }
    const { error: finishError } = await admin.rpc("finish_employee_removal", { _actor: user.id, _job: job.id });
    if (finishError) return reply({ error: "Removal needs a final cleanup. Click Delete permanently again to finish." }, 503);
    return reply({ success: true, financial_history_retained: true });
  } catch {
    return reply({ error: "Unable to remove employee. Please try again." }, 400);
  }
});