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
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceKey || req.headers.get("Authorization") !== `Bearer ${serviceKey}`) return new Response(JSON.stringify({ error: "Trusted alert service required" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const payload = await req.json();
    const eventId = (payload.record || payload)?.id;

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: record } = await adminClient.from("emergency_alerts").select("*").eq("id", eventId).maybeSingle();
    if (!record?.org_id) return new Response(JSON.stringify({ error: "Alert not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    // Fetch guard profile
    const { data: profile } = await adminClient
      .from("profiles")
      .select("first_name, last_name, email, phone, jurisdiction")
      .eq("org_id", record.org_id).eq("user_id", record.user_id)
      .maybeSingle();

    const guardName = profile
      ? `${profile.first_name} ${profile.last_name}`.trim()
      : "Unknown Guard";

    // Fetch site info if available
    let siteName = "Unknown Location";
    if (record.site_id) {
      const { data: site } = await adminClient
        .from("client_sites")
        .select("name")
        .eq("org_id", record.org_id).eq("id", record.site_id)
        .maybeSingle();
      if (site) siteName = site.name;
    }

    // Get ALL admins and managers — panic alerts bypass preferences
    const { data: adminRoles } = await adminClient
      .from("user_roles")
      .select("user_id")
      .eq("org_id", record.org_id).in("role", ["admin", "manager"]);

    const managerIds = (adminRoles || []).map((r) => r.user_id);

    // Check panic button preference (only this specific toggle can suppress it)
    const { data: allSettings } = await adminClient
      .from("notification_settings")
      .select("user_id, alert_on_panic_button, enable_email")
      .in("user_id", managerIds);

    const settingsMap = new Map(
      (allSettings || []).map((s) => [s.user_id, s])
    );

    const { data: managerProfiles } = await adminClient
      .from("profiles")
      .select("user_id, email, first_name")
      .in("user_id", managerIds);

    const emailRecipients: string[] = [];

    for (const mgr of managerProfiles || []) {
      const prefs = settingsMap.get(mgr.user_id);
      // Panic alerts default to ON — only suppressed if explicitly disabled
      const wantsPanic = !prefs || prefs.alert_on_panic_button !== false;
      if (wantsPanic && mgr.email) {
        emailRecipients.push(mgr.email);
      }
    }

    console.log(
      `🚨 PANIC ALERT: ${guardName} at ${siteName} (${record.latitude}, ${record.longitude}). ` +
      `Notifying ${emailRecipients.length} managers.`
    );

    // Try email alerts
    if (emailRecipients.length > 0) {
      try {
        for (const email of emailRecipients) {
          await adminClient.functions.invoke("send-transactional-email", {
            body: {
              templateName: "panic-alert",
              recipientEmail: email,
              idempotencyKey: `panic-alert-${record.id}-${email}`,
              templateData: {
                guardName,
                siteName,
                time: new Date(record.created_at || Date.now()).toLocaleString(),
                latitude: record.latitude,
                longitude: record.longitude,
                mapUrl: `https://www.google.com/maps?q=${record.latitude},${record.longitude}`,
              },
            },
          });
        }
      } catch (emailErr) {
        console.log("Email alert skipped (not yet configured):", emailErr);
      }
    }

    return new Response(
      JSON.stringify({
        alert: true,
        guard_name: guardName,
        site: siteName,
        managers_notified: emailRecipients.length,
        alert_id: record.id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Panic alert error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
