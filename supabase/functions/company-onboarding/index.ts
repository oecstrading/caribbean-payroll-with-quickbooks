import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { generateResponse, GatewayError } from "npm:@lovable.dev/ai-gateway@0.1.6";
import { z } from "npm:zod@3.25.76";
import { industryPacks } from "../_shared/company-templates.ts";

const cors = corsHeaders;
const recommendationSchema = z.object({ action: z.literal("recommend"), token: z.string().regex(/^[a-f0-9]{64}$/).nullish(), industry: z.enum(["general", "construction", "security", "services"]), jurisdiction: z.enum(["LC", "AG", "KN", "DM", "GD"]), weekly_hours: z.number().min(1).max(80), pay_frequency: z.enum(["weekly", "semi_monthly", "monthly"]) }).strict();
async function recommendation(body: unknown, signal: AbortSignal) {
  const parsed = recommendationSchema.safeParse(body);
  if (!parsed.success) return reply({ error: "Select a valid industry, country, hours and pay cycle" }, 400);
  try {
    const response = await generateResponse({ model: "openai/gpt-6-astra", instructions: "You are a Caribbean company onboarding adviser. Give concise plain-text recommendations (under 350 words) for the supplied industry and country. Cover departments, pay-cycle checks, mobile site/geofence attendance, supervision, safety/certification documents, projects/cost codes where relevant, payroll deductions, accountant review and a first-payroll checklist. All suggestions require human review. Do not invent statutory tax rates, legal limits, certification validity periods, employee data or accounting connections. Proposed hours and pay cycle are configurable suggestions, not legal standards. State local legal and safety compliance remains unverified. Do not claim to create or modify records. Payroll approval always belongs to the administrator.", input: JSON.stringify({ industry: parsed.data.industry, jurisdiction: parsed.data.jurisdiction, weekly_hours: parsed.data.weekly_hours, pay_frequency: parsed.data.pay_frequency, pack: industryPacks[parsed.data.industry] }) }, { signal });
    const review = response.output.flatMap(item => item.type === "message" ? item.content.flatMap(part => part.type === "output_text" ? [part.text] : []) : []).join("\n");
    if (!review || response.status === "incomplete" || review.length>12000) return reply({ error: "AI review did not finish; your template is unchanged" }, 502);
    return reply({ review });
  } catch (error) {
    if (error instanceof GatewayError) console.error("onboarding-recommendation", { code: error.code, ids: error.ids });
    return reply({ error: "AI review unavailable. Keep the industry template and review it manually; no company settings changed." }, 502);
  }
}
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
    if (body.action === "recommend") {
      if (!recommendationSchema.safeParse(body).success) return reply({ error: "Invalid onboarding review request" }, 400);
      const { data: permitted, error } = await caller.rpc("is_platform_admin");
      if (error) return reply({ error: "Unable to verify company setup access" }, 503);
      if (permitted) return recommendation(body, req.signal);
    }
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
    if (body.action === "recommend") return recommendation(body, req.signal);
    if (body.action === "inspect") return reply({ details: invitation.defaults, expires_at: invitation.expires_at });
    if (body.action !== "complete") return reply({ error: "Unknown action" }, 400);
    const { data: orgId, error: completeError } = await admin.rpc("complete_company_setup", { _user: user.id, _token: token, _details: body.details });
    if (completeError) return reply({ error: completeError.message }, 400);
    return reply({ org_id: orgId });
  } catch {
    return reply({ error: "Unable to process company setup. Please try again." }, 400);
  }
});