// AI Paymaster: monitors each company's payroll inputs, keeps an up-to-date draft,
// writes an AI briefing and reminds the admin until a human approves on the Payroll page.
// It never approves, pays or posts payroll.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { generateResponse, GatewayError } from "npm:@lovable.dev/ai-gateway@0.1.6";

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const MAX_ORGS_PER_RUN = 10;
const iso = (d: Date) => d.toISOString().slice(0, 10);

type Flag = { severity: "high" | "medium" | "low"; title: string; detail: string };

async function processOrg(admin: ReturnType<typeof createClient>, orgId: string, force: boolean) {
  const now = new Date();
  // settings + single-flight lease
  await admin.from("paymaster_settings").upsert({ org_id: orgId }, { onConflict: "org_id", ignoreDuplicates: true });
  const { data: settings } = await admin.from("paymaster_settings").select("*").eq("org_id", orgId).single();
  if (!settings?.enabled) return { orgId, skipped: "disabled" };
  if (settings.paused_reason && !force) return { orgId, skipped: "paused" };
  if (!force && settings.last_run_at && now.getTime() - new Date(settings.last_run_at).getTime() < 6 * 3600_000) return { orgId, skipped: "recent" };
  const lease = new Date(now.getTime() + 5 * 60_000).toISOString();
  const { data: locked } = await admin.from("paymaster_settings").update({ lock_until: lease })
    .eq("org_id", orgId).or(`lock_until.is.null,lock_until.lt.${now.toISOString()}`).select("org_id");
  if (!locked?.length) return { orgId, skipped: "running" };

  try {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
    const payDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), settings.pay_day));
    const [profiles, records, runs, alerts, shifts, loans] = await Promise.all([
      admin.from("profiles").select("id, monthly_salary, nic_number, tan_number, status, department").eq("org_id", orgId).is("deleted_at", null),
      admin.from("employee_records").select("id, monthly_salary, nic_number, tan_number, status, department").eq("org_id", orgId).is("deleted_at", null).is("permanently_deleted_at", null),
      admin.from("payroll_runs").select("id, total_gross, period_start, period_end, created_at").eq("org_id", orgId).order("created_at", { ascending: false }).limit(12),
      admin.from("workforce_alerts").select("id", { count: "exact", head: true }).eq("org_id", orgId).is("resolved_at", null),
      admin.from("workforce_shifts").select("id", { count: "exact", head: true }).eq("org_id", orgId).gte("shift_date", iso(start)).neq("review_status", "approved"),
      admin.from("employee_loans").select("id, monthly_repayment, balance").eq("org_id", orgId).eq("is_active", true),
    ]);
    const staff = [...(profiles.data ?? []), ...(records.data ?? [])].filter(e => (e.status ?? "active") === "active");
    const gross = staff.reduce((s, e) => s + Number(e.monthly_salary ?? 0), 0);
    const covering = (runs.data ?? []).find(r => r.period_start && r.period_end && r.period_start <= iso(end) && r.period_end >= iso(start));
    const previous = (runs.data ?? []).find(r => r.id !== covering?.id && (!r.period_end || r.period_end < iso(start)));
    const lastGross = previous ? Number(previous.total_gross ?? 0) : null;
    const changePct = lastGross ? Math.round(((gross - lastGross) / lastGross) * 1000) / 10 : null;
    const loanTotal = (loans.data ?? []).reduce((s, l) => s + Math.min(Number(l.monthly_repayment ?? 0), Number(l.balance ?? 0)), 0);
    const missingIds = staff.filter(e => !e.nic_number || !e.tan_number).length;
    const zeroPay = staff.filter(e => !Number(e.monthly_salary)).length;
    const missing = alerts.count ?? 0, pending = shifts.count ?? 0;

    const flags: Flag[] = [];
    if (changePct !== null && Math.abs(changePct) >= 10) flags.push({ severity: Math.abs(changePct) >= 25 ? "high" : "medium", title: `Payroll cost ${changePct > 0 ? "up" : "down"} ${Math.abs(changePct)}%`, detail: `Projected gross differs from the last saved run (${lastGross?.toFixed(2)} XCD).` });
    if (missing) flags.push({ severity: "high", title: `${missing} missing punch${missing === 1 ? "" : "es"}`, detail: "Staff forgot to clock in or out. Confirm or correct before paying hours." });
    if (pending) flags.push({ severity: "medium", title: `${pending} shift${pending === 1 ? "" : "s"} awaiting review`, detail: "Approve worked hours on the Attendance page so they count toward pay." });
    if (missingIds) flags.push({ severity: "medium", title: `${missingIds} employee${missingIds === 1 ? "" : "s"} missing NIC or tax number`, detail: "Statutory reports need these numbers." });
    if (zeroPay) flags.push({ severity: "high", title: `${zeroPay} employee${zeroPay === 1 ? "" : "s"} with no pay rate`, detail: "They would be paid nothing this period." });
    const suggestions = [
      ...(missing ? [{ action: "Resolve missing punches", path: "/attendance" }] : []),
      ...(pending ? [{ action: "Approve worked hours", path: "/attendance" }] : []),
      ...(missingIds || zeroPay ? [{ action: "Complete employee details", path: "/employees" }] : []),
      { action: "Review, run the AI check and approve payroll", path: "/payroll" },
    ];

    let summary: string | null = null;
    try {
      const res = await generateResponse({
        model: "openai/gpt-6-astra",
        instructions: "You are the AI Paymaster for a Caribbean (OECS) payroll service. Write a short plain-language briefing (max 140 words, no tables) for the company admin about this period's draft payroll: the cost forecast versus last period, the issues to fix, and what to do next. Amounts are XCD. You cannot approve or pay payroll; always end by asking the admin to review and approve on the Payroll page. Never invent figures beyond those supplied.",
        input: JSON.stringify({ periodStart: iso(start), periodEnd: iso(end), payDate: iso(payDate), employees: staff.length, projectedGross: gross, lastGross, changePct, missingPunches: missing, pendingShifts: pending, activeLoans: loans.data?.length ?? 0, loanRepayments: loanTotal, missingStatutoryIds: missingIds, zeroPay, alreadyApproved: !!covering }),
      });
      summary = res.output.flatMap(i => i.type === "message" ? i.content.flatMap(p => p.type === "output_text" ? [p.text] : []) : []).join("\n") || null;
    } catch (e) {
      if (e instanceof GatewayError && (e.httpStatus === 402 || e.httpStatus === 403)) {
        await admin.from("paymaster_settings").update({ paused_reason: e.httpStatus === 402 ? "AI credits required" : "AI access denied" }).eq("org_id", orgId);
      }
      console.error("ai-paymaster summary", e instanceof GatewayError ? { code: e.code, ids: e.ids } : String(e));
    }

    const { data: existing } = await admin.from("paymaster_drafts").select("id, reminder_count, last_reminded_at, summary").eq("org_id", orgId).eq("period_start", iso(start)).eq("period_end", iso(end)).maybeSingle();
    const reminderDue = !covering && now >= new Date(payDate.getTime() - settings.lead_days * 86400_000) &&
      (!existing?.last_reminded_at || iso(new Date(existing.last_reminded_at)) < iso(now));
    const row = {
      org_id: orgId, period_start: iso(start), period_end: iso(end), pay_date: iso(payDate),
      status: covering ? "approved" : "awaiting_review", approved_run_id: covering?.id ?? null,
      employee_count: staff.length, projected_gross: gross, last_gross: lastGross, change_pct: changePct,
      missing_punches: missing, pending_shifts: pending, active_loans: loans.data?.length ?? 0, loan_repayments: loanTotal,
      flags, suggestions, summary: summary ?? existing?.summary ?? null, updated_at: now.toISOString(),
      ...(reminderDue ? { reminder_count: (existing?.reminder_count ?? 0) + 1, last_reminded_at: now.toISOString(), acknowledged_at: null } : {}),
    };
    await admin.from("paymaster_drafts").upsert(row, { onConflict: "org_id,period_start,period_end" });
    await admin.from("paymaster_settings").update({ last_run_at: now.toISOString(), lock_until: null, ...(summary ? { paused_reason: null } : {}) }).eq("org_id", orgId);
    return { orgId, status: row.status, flags: flags.length };
  } catch (e) {
    await admin.from("paymaster_settings").update({ lock_until: null }).eq("org_id", orgId);
    throw e;
  }
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const authorization = req.headers.get("Authorization");
    const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
    const { data: auth } = token ? await admin.auth.getUser(token) : { data: { user: null } };
    if (auth?.user) {
      // Manual "Run now" by a payroll manager for their own company
      const user = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authorization! } } });
      const [{ data: orgId }, { data: access }, { data: staff }] = await Promise.all([
        user.rpc("current_org_id"), user.rpc("has_workspace_access", { _user_id: auth.user.id, _module: "payroll" }), user.rpc("is_admin_or_manager", { _user_id: auth.user.id }),
      ]);
      if (!orgId || !access || !staff) return json({ error: "Payroll manager access required." }, 403);
      return json(await processOrg(admin, orgId as string, true));
    }
    // Scheduled monitoring: bounded batch, each org rate-limited to once per 6h
    const { data: orgs } = await admin.from("organizations").select("id, enabled_modules").eq("onboarding_status", "active");
    const eligible = (orgs ?? []).filter(o => (o.enabled_modules ?? []).includes("payroll"));
    const { data: states } = await admin.from("paymaster_settings").select("org_id, last_run_at");
    const last = new Map((states ?? []).map(s => [s.org_id, s.last_run_at ?? ""]));
    eligible.sort((a, b) => String(last.get(a.id) ?? "").localeCompare(String(last.get(b.id) ?? "")));
    const results = [];
    for (const org of eligible.slice(0, MAX_ORGS_PER_RUN)) {
      try { results.push(await processOrg(admin, org.id, false)); } catch (e) { results.push({ orgId: org.id, error: String(e) }); }
    }
    return json({ processed: results });
  } catch (e) {
    console.error("ai-paymaster", String(e));
    return json({ error: "AI Paymaster unavailable. No payroll was changed." }, 500);
  }
});
