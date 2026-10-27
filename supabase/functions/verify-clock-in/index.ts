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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = user.id;
    const checks = await Promise.all(["attendance", "security"].map(module => supabase.rpc("has_workspace_access", { _user_id: userId, _module: module })));
    if (!checks.some(check => !check.error && check.data)) return new Response(JSON.stringify({ error: "Attendance workspace access required" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { latitude, longitude, site_id, punch_type } = await req.json();

    if (!latitude || !longitude || !site_id || !punch_type) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: latitude, longitude, site_id, punch_type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: orgId, error: orgError } = await supabase.rpc("current_org_id");
    const { data: permittedSite } = await adminClient.from("client_sites").select("id").eq("id", site_id).eq("org_id", orgId).maybeSingle();
    if (orgError || !orgId || !permittedSite) return new Response(JSON.stringify({ error: "Site is not in your company" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    // Try PostGIS RPC first, fallback to Haversine
    let distance = 0;
    let withinGeofence = false;
    let siteName = "";
    let radiusMeters = 200;

    const { data: verifyResult, error: verifyError } = await adminClient.rpc("verify_guard_location", {
      _site_id: site_id,
      _lat: latitude,
      _lon: longitude,
    });

    if (verifyError) {
      // Fallback: Haversine
      const { data: site, error: siteError } = await adminClient
        .from("client_sites")
        .select("id, name, latitude, longitude, radius_meters")
        .eq("org_id", orgId).eq("id", site_id)
        .single();

      if (siteError || !site) {
        return new Response(JSON.stringify({ error: "Site not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!site.latitude || !site.longitude) {
        return new Response(JSON.stringify({ error: "Site has no coordinates configured" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const R = 6371e3;
      const dLat = ((site.latitude - latitude) * Math.PI) / 180;
      const dLon = ((site.longitude - longitude) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((latitude * Math.PI) / 180) *
          Math.cos((site.latitude * Math.PI) / 180) *
          Math.sin(dLon / 2) ** 2;
      distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      withinGeofence = distance <= site.radius_meters;
      siteName = site.name;
      radiusMeters = site.radius_meters;
    } else {
      // PostGIS succeeded
      const result = verifyResult;
      if (!result) {
        return new Response(JSON.stringify({ error: "Location verification failed" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      distance = result.distance_meters ?? 0;
      withinGeofence = result.within_geofence ?? false;
      siteName = result.site_name ?? "";
      radiusMeters = result.radius_meters ?? 200;
    }

    // ALWAYS record the punch — even violations (marked with within_geofence = false)
    const { data: punch, error: punchError } = await adminClient
      .from("clock_punches")
      .insert({
        org_id: orgId,
        user_id: userId,
        punch_type,
        latitude,
        longitude,
        within_geofence: withinGeofence,
        address_label: siteName,
      })
      .select()
      .single();

    if (punchError) {
      return new Response(JSON.stringify({ error: "Failed to save clock punch" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If outside geofence, return 403 but the punch IS recorded for auditing
    if (!withinGeofence) {
      return new Response(
        JSON.stringify({
          error: `You are ${Math.round(distance)}m from the site. Must be within ${radiusMeters}m. This attempt has been recorded.`,
          distance: Math.round(distance),
          within_geofence: false,
          punch_id: punch.id,
          site_name: siteName,
          recorded: true,
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        distance: Math.round(distance),
        within_geofence: true,
        punch_id: punch.id,
        site_name: siteName,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
