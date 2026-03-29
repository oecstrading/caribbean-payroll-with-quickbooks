import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const todayDay = dayNames[now.getDay()];

    // Fetch today's active guard assignments
    const { data: assignments, error: assignErr } = await adminClient
      .from("guard_assignments")
      .select("user_id, site_id, shift_start, days_of_week")
      .eq("is_active", true);

    if (assignErr) {
      console.error("Failed to fetch assignments:", assignErr);
      throw assignErr;
    }

    // Filter to today's scheduled assignments
    const todayAssignments = (assignments || []).filter((a: any) => {
      if (!a.shift_start) return false;
      if (!a.days_of_week || a.days_of_week.length === 0) return true;
      return a.days_of_week.includes(todayDay);
    });

    if (todayAssignments.length === 0) {
      return new Response(JSON.stringify({ checked: 0, alerts_sent: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch today's clock-in punches
    const { data: clockIns } = await adminClient
      .from("clock_punches")
      .select("user_id, punched_at")
      .eq("punch_type", "clock_in")
      .gte("punched_at", todayStr + "T00:00:00")
      .lte("punched_at", todayStr + "T23:59:59");

    const clockInMap = new Map<string, string>();
    for (const p of clockIns || []) {
      if (!clockInMap.has(p.user_id)) {
        clockInMap.set(p.user_id, p.punched_at);
      }
    }

    // Fetch already-sent alerts for today to avoid duplicates
    const { data: sentAlerts } = await adminClient
      .from("late_clock_in_alerts")
      .select("user_id, site_id")
      .eq("shift_date", todayStr);

    const sentSet = new Set(
      (sentAlerts || []).map((a: any) => `${a.user_id}-${a.site_id}`)
    );

    // Determine who is late (15+ min past shift_start, no clock-in or late clock-in)
    const lateGuards: Array<{
      user_id: string;
      site_id: string;
      shift_start: string;
      late_minutes: number;
      clock_in_at: string | null;
    }> = [];

    for (const a of todayAssignments) {
      const key = `${a.user_id}-${a.site_id}`;
      if (sentSet.has(key)) continue; // Already alerted today

      const [h, m] = (a.shift_start as string).split(":").map(Number);
      const shiftTime = new Date(now);
      shiftTime.setHours(h, m, 0, 0);

      const lateThresholdMs = 15 * 60 * 1000; // 15 minutes
      const clockInTime = clockInMap.get(a.user_id);

      if (clockInTime) {
        // Guard clocked in — check if late by 15+ min
        const diffMs = new Date(clockInTime).getTime() - shiftTime.getTime();
        if (diffMs >= lateThresholdMs) {
          lateGuards.push({
            user_id: a.user_id,
            site_id: a.site_id,
            shift_start: a.shift_start,
            late_minutes: Math.floor(diffMs / 60000),
            clock_in_at: clockInTime,
          });
        }
      } else {
        // Guard hasn't clocked in yet — check if 15+ min past shift start
        const diffMs = now.getTime() - shiftTime.getTime();
        if (diffMs >= lateThresholdMs) {
          lateGuards.push({
            user_id: a.user_id,
            site_id: a.site_id,
            shift_start: a.shift_start,
            late_minutes: Math.floor(diffMs / 60000),
            clock_in_at: null,
          });
        }
      }
    }

    if (lateGuards.length === 0) {
      return new Response(JSON.stringify({ checked: todayAssignments.length, alerts_sent: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch profiles for late guards
    const lateUserIds = [...new Set(lateGuards.map((g) => g.user_id))];
    const lateSiteIds = [...new Set(lateGuards.map((g) => g.site_id))];

    const [{ data: guardProfiles }, { data: siteData }] = await Promise.all([
      adminClient.from("profiles").select("user_id, first_name, last_name").in("user_id", lateUserIds),
      adminClient.from("client_sites").select("id, name").in("id", lateSiteIds),
    ]);

    const profileMap = new Map(
      (guardProfiles || []).map((p: any) => [p.user_id, `${p.first_name} ${p.last_name}`.trim()])
    );
    const siteMap = new Map(
      (siteData || []).map((s: any) => [s.id, s.name])
    );

    // Fetch managers to notify
    const { data: adminRoles } = await adminClient
      .from("user_roles")
      .select("user_id")
      .in("role", ["admin", "manager"]);

    const managerIds = (adminRoles || []).map((r: any) => r.user_id);

    if (managerIds.length === 0) {
      console.log("No managers to notify");
      return new Response(JSON.stringify({ checked: todayAssignments.length, alerts_sent: 0, reason: "No managers" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check notification preferences
    const { data: allSettings } = await adminClient
      .from("notification_settings")
      .select("user_id, enable_email, enable_push, alert_on_late_clock_in")
      .in("user_id", managerIds);

    const settingsMap = new Map(
      (allSettings || []).map((s: any) => [s.user_id, s])
    );

    const { data: managerProfiles } = await adminClient
      .from("profiles")
      .select("user_id, email, first_name")
      .in("user_id", managerIds);

    const emailRecipients: string[] = [];
    for (const mgr of managerProfiles || []) {
      const prefs = settingsMap.get(mgr.user_id);
      const wantsLateAlert = !prefs || prefs.alert_on_late_clock_in !== false;
      const wantsEmail = !prefs || prefs.enable_email !== false;
      if (wantsLateAlert && wantsEmail && mgr.email) {
        emailRecipients.push(mgr.email);
      }
    }

    // Build alert summary
    const alertSummary = lateGuards.map((g) => ({
      guardName: profileMap.get(g.user_id) || "Unknown",
      siteName: siteMap.get(g.site_id) || "Unknown",
      shiftStart: g.shift_start,
      lateMinutes: g.late_minutes,
      status: g.clock_in_at ? "Arrived late" : "No show",
    }));

    console.log(`⏰ LATE CLOCK-IN ALERT: ${lateGuards.length} guard(s) late. Notifying ${emailRecipients.length} manager(s).`);
    console.log("Late guards:", JSON.stringify(alertSummary));

    // Send email alerts
    if (emailRecipients.length > 0) {
      const alertId = crypto.randomUUID();
      const emailBody = alertSummary
        .map((a) => `• ${a.guardName} at ${a.siteName} — ${a.lateMinutes}m late (shift: ${a.shiftStart}) [${a.status}]`)
        .join("\n");

      for (const email of emailRecipients) {
        try {
          await adminClient.functions.invoke("send-transactional-email", {
            body: {
              templateName: "late-clock-in",
              recipientEmail: email,
              idempotencyKey: `late-clock-in-${todayStr}-${alertId}-${email}`,
              templateData: {
                date: todayStr,
                lateCount: lateGuards.length,
                alerts: alertSummary,
                summaryText: emailBody,
              },
            },
          });
        } catch (emailErr) {
          console.log(`Email to ${email} skipped (not yet configured):`, emailErr);
        }
      }
    }

    // Record sent alerts to prevent duplicates
    const alertRecords = lateGuards.map((g) => ({
      user_id: g.user_id,
      site_id: g.site_id,
      shift_date: todayStr,
      shift_start: g.shift_start,
      late_minutes: g.late_minutes,
      clock_in_at: g.clock_in_at,
    }));

    const { error: insertErr } = await adminClient
      .from("late_clock_in_alerts")
      .upsert(alertRecords, { onConflict: "user_id,site_id,shift_date" });

    if (insertErr) {
      console.error("Failed to record alerts:", insertErr);
    }

    return new Response(
      JSON.stringify({
        checked: todayAssignments.length,
        late_guards: lateGuards.length,
        alerts_sent: emailRecipients.length,
        details: alertSummary,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Late clock-in alert error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
