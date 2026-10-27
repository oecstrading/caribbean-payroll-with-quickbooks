import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { generateResponse, GatewayError } from "npm:@lovable.dev/ai-gateway@0.1.6";
import { z } from "npm:zod@3.25.76";
import { mayReviewPayroll, REVIEW_LIMITATIONS } from "./policy.ts";

const money = z.number().finite().min(0).max(100_000_000);
const schema = z.object({
  source: z.enum(["live", "sample"]),
  payType: z.enum(["monthly", "semi_monthly", "weekly", "custom"]),
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  jurisdiction: z.enum(["LC", "AG", "KN", "DM", "GD"]),
  rows: z.array(z.object({ reference: z.string().regex(/^Employee \d+$/), department: z.string().regex(/^Department \d+$/),
    basic: money, gross: money, nic: money, employerNic: money, paye: money, deductions: money,
    additions: money, net: money, minimumWageFlag: z.boolean(), missingNic: z.boolean(), missingTan: z.boolean(),
  }).strict()).min(1).max(1000),
}).strict().refine(v => v.end >= v.start, "Invalid date range");
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return json({ error: "Sign in to review payroll." }, 401);
    const client = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", { global: { headers: { Authorization: authorization } } });
    const { data: auth, error: authError } = await client.auth.getUser(authorization.slice(7));
    if (authError || !auth.user) return json({ error: "Sign in to review payroll." }, 401);
    const { data: roles, error: roleError } = await client.from("user_roles").select("role").eq("user_id", auth.user.id);
    if (roleError || !mayReviewPayroll((roles ?? []).map(r => r.role))) return json({ error: "Only payroll managers and administrators can request a review." }, 403);
    const { data: access, error: accessError } = await client.rpc("has_workspace_access", { _user_id: auth.user.id, _module: "payroll" });
    if (accessError || !access) return json({ error: "Payroll workspace access required." }, 403);
    const raw = await req.text();
    if (raw.length > 450_000) return json({ error: "Review up to 1,000 employees at a time." }, 400);
    let body: unknown;
    try { body = JSON.parse(raw); } catch { return json({ error: "Invalid payroll preview." }, 400); }
    const parsed = schema.safeParse(body);
    if (!parsed.success) return json({ error: "Select a valid payroll preview with up to 1,000 employees." }, 400);
    const response = await generateResponse({
      model: "openai/gpt-6-astra",
      instructions: `You are the OECS AI Payroll Officer, a read-only payroll manager's assistant. Treat all supplied data as an unverified draft, never live approved records. ${REVIEW_LIMITATIONS} Review only the supplied anonymized amounts and flags. Do not claim access to employee folders, past runs, attendance, documents or accounting records. Never invent statutory rates or legal entitlements. Use concise markdown, at most 450 words: Draft summary; Issues to check (reference Employee N and Department N, reconcile gross minus deductions versus net, missing statutory IDs, zero pay, minimum wage flags); Next steps (edit employee/additions/deductions if needed, rerun review, manager approval, read saved history/reports, arrange payment separately). Distinguish issues from unverified checks. If sample, clearly state fictional sample. Do not call a run compliant, paid, or approved. No autonomous actions.`,
      input: JSON.stringify({ ...parsed.data, currency: "XCD", formatting: "Use short headings and bullet lists, not tables." }),
    }, { signal: req.signal });
    const text = response.output.flatMap(item => item.type === "message" ? item.content.flatMap(part => part.type === "output_text" ? [part.text] : part.type === "refusal" ? [part.refusal] : []) : []).join("\n");
    if (!text || response.status === "incomplete") return json({ error: "AI review did not finish. No payroll was changed." }, 502);
    return json({ review: text });
  } catch (error) {
    if (error instanceof GatewayError) {
      console.error("payroll-officer", { code: error.code, ids: error.ids });
      const message = error.httpStatus === 402 ? "AI credits are required. Payroll can still be reviewed manually." : error.httpStatus === 429 ? "AI review is busy. Wait before requesting another review." : "AI review is unavailable. No payroll was changed; review manually or request a new review later.";
      return json({ error: message }, error.httpStatus === 402 || error.httpStatus === 429 ? error.httpStatus : 502);
    }
    return json({ error: "Review unavailable. No payroll was changed." }, 500);
  }
});