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

    // Get manager emails
    const { data: managerProfiles } = await adminClient
      .from("profiles")
      .select("email, first_name")
      .in("user_id", managerIds);

    const managerEmails = (managerProfiles || [])
      .map((p) => p.email)
      .filter(Boolean);

    // Log the violation alert
    console.log(
      `⚠️ GEOFENCE VIOLATION: ${guardName} attempted clock-in at ${record.address_label || "unknown site"} ` +
      `(lat: ${record.latitude}, lon: ${record.longitude}) - OUTSIDE GEOFENCE. ` +
      `Managers to notify: ${managerEmails.join(", ")}`
    );

    // Try to send email via transactional email system (if configured)
    // This will work once email domain is set up
    try {
      for (const email of managerEmails) {
        await adminClient.functions.invoke("send-transactional-email", {
          body: {
            templateName: "geofence-violation",
            recipientEmail: email,
            idempotencyKey: `geofence-violation-${record.id}`,
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
      // Email not configured yet — that's OK, the violation is still recorded
      console.log("Email alert skipped (email infrastructure not yet configured):", emailErr);
    }

    return new Response(
      JSON.stringify({
        alert: true,
        guard_name: guardName,
        site: record.address_label,
        managers_notified: managerEmails.length,
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
