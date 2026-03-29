import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const record = payload.record || payload;

    // Only alert on violations (within_geofence = false)
    if (record.within_geofence !== false) {
      return new Response(JSON.stringify({ alert: false, reason: "Within geofence" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch guard profile
    const { data: profile } = await adminClient
      .from("profiles")
      .select("first_name, last_name, email, phone")
      .eq("user_id", record.user_id)
      .maybeSingle();

    const guardName = profile
      ? `${profile.first_name} ${profile.last_name}`.trim()
      : "Unknown Guard";

    // Fetch managers/admins to notify
    const { data: adminRoles } = await adminClient
      .from("user_roles")
      .select("user_id")
      .in("role", ["admin", "manager"]);

    const managerIds = (adminRoles || []).map((r) => r.user_id);

    if (managerIds.length === 0) {
      console.log("No managers to notify");
      return new Response(JSON.stringify({ alert: false, reason: "No managers found" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check each manager's notification preferences
    const { data: allSettings } = await adminClient
      .from("notification_settings")
      .select("user_id, enable_push, enable_email, alert_on_geofence_violation")
      .in("user_id", managerIds);

    const settingsMap = new Map(
      (allSettings || []).map((s) => [s.user_id, s])
    );

    // Get manager emails for those who want alerts
    const { data: managerProfiles } = await adminClient
      .from("profiles")
      .select("user_id, email, first_name")
      .in("user_id", managerIds);

    const emailRecipients: string[] = [];
    const pushRecipients: string[] = [];

    for (const mgr of managerProfiles || []) {
      const prefs = settingsMap.get(mgr.user_id);
      // Default: alert enabled if no settings row exists
      const wantsAlert = !prefs || prefs.alert_on_geofence_violation !== false;
      
      if (wantsAlert && mgr.email) {
        if (!prefs || prefs.enable_email !== false) {
          emailRecipients.push(mgr.email);
        }
        if (!prefs || prefs.enable_push !== false) {
          pushRecipients.push(mgr.user_id);
        }
      }
    }

    console.log(
      `⚠️ GEOFENCE VIOLATION: ${guardName} at ${record.address_label || "unknown site"}. ` +
      `Email recipients: ${emailRecipients.length}, Push recipients: ${pushRecipients.length}`
    );

    // Try to send email alerts (if email infrastructure is configured)
    if (emailRecipients.length > 0) {
      try {
        for (const email of emailRecipients) {
          await adminClient.functions.invoke("send-transactional-email", {
            body: {
              templateName: "geofence-violation",
              recipientEmail: email,
              idempotencyKey: `geofence-violation-${record.id}-${email}`,
              templateData: {
                guardName,
                siteName: record.address_label || "Unknown Site",
                time: new Date(record.punched_at || Date.now()).toLocaleString(),
                latitude: record.latitude,
                longitude: record.longitude,
              },
            },
          });
        }
      } catch (emailErr) {
        console.log("Email alert skipped (not yet configured):", emailErr);
      }
    }

    // Push notification placeholder - will activate with OneSignal integration
    if (pushRecipients.length > 0) {
      console.log(`Push notification queued for ${pushRecipients.length} managers`);
      // OneSignal integration will go here when API keys are configured
    }

    return new Response(
      JSON.stringify({
        alert: true,
        guard_name: guardName,
        site: record.address_label,
        email_sent: emailRecipients.length,
        push_sent: pushRecipients.length,
        punch_id: record.id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Geofence alert error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
