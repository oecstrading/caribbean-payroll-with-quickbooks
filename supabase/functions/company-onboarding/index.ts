import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const anon = Deno.env.get("SUPABASE_ANON_KEY");
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY");
    if (!url || !anon || !service) return reply({ error: "Company setup is temporarily unavailable" }, 503);
    const authorization = req.headers.get("Authorization");
    if (!authorization) return reply({ error: "Sign in to continue" }, 401);
    const caller = createClient(url, anon, { global: { headers: { Authorization: authorization } } });
    const { data: { user }, error: authError } = await caller.auth.getUser();
    if (authError || !user) return reply({ error: "Sign in to continue" }, 401);
    const admin = createClient(url, service);
    const body = await req.json();
    if (body.action === "update") {
      const { data: permitted } = await caller.rpc("is_platform_admin");
      if (!permitted) return reply({ error: "Platform administrator required" }, 403);
      const { error } = await admin.rpc("update_platform_company", { _actor: user.id, _org: body.org_id, _details: body.details });
      if (error) return reply({ error: error.message }, 400);
      return reply({ success: true });
    }
    const token = body.token;
    if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) return reply({ error: "Invalid invitation link" }, 400);
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))), b => b.toString(16).padStart(2, "0")).join("");
    const { data: invitation, error } = await admin.from("company_setup_invitations").select("email,defaults,expires_at,revoked_at,accepted_at").eq("token_hash", hash).maybeSingle();
    if (error || !invitation || invitation.revoked_at || invitation.accepted_at || Date.parse(invitation.expires_at) <= Date.now()) return reply({ error: "Invitation is invalid, expired or already used" }, 400);
    if (!user.email_confirmed_at || user.email?.toLowerCase() !== invitation.email) return reply({ error: "Sign in with the verified email this invitation was issued to" }, 403);
    if (body.action === "inspect") return reply({ details: invitation.defaults, expires_at: invitation.expires_at });
    if (body.action !== "complete") return reply({ error: "Unknown action" }, 400);
    const { data: orgId, error: completeError } = await admin.rpc("complete_company_setup", { _user: user.id, _token: token, _details: body.details });
    if (completeError) return reply({ error: completeError.message }, 400);
    return reply({ org_id: orgId });
  } catch {
    return reply({ error: "Unable to process company setup. Please try again." }, 400);
  }
});