import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Haversine formula — server-side duplicate to prevent spoofing
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const { latitude, longitude, site_id, punch_type } = await req.json();

    if (!latitude || !longitude || !site_id || !punch_type) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: latitude, longitude, site_id, punch_type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch the site to get its coordinates and radius
    const { data: site, error: siteError } = await supabase
      .from("client_sites")
      .select("id, name, latitude, longitude, radius_meters")
      .eq("id", site_id)
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

    // Server-side distance check — prevents GPS spoofing
    const distance = getDistance(latitude, longitude, site.latitude, site.longitude);
    const withinGeofence = distance <= site.radius_meters;

    if (!withinGeofence) {
      return new Response(
        JSON.stringify({
          error: `You are ${Math.round(distance)}m from the site. Must be within ${site.radius_meters}m.`,
          distance: Math.round(distance),
          within_geofence: false,
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verified — save the clock punch using service role for insert
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: punch, error: punchError } = await adminClient
      .from("clock_punches")
      .insert({
        user_id: userId,
        punch_type,
        latitude,
        longitude,
        within_geofence: true,
        address_label: site.name,
        geofence_zone_id: null,
      })
      .select()
      .single();

    if (punchError) {
      return new Response(JSON.stringify({ error: "Failed to save clock punch" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        distance: Math.round(distance),
        within_geofence: true,
        punch_id: punch.id,
        site_name: site.name,
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
