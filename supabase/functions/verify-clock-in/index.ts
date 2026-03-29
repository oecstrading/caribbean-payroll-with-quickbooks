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

    // Use service role for PostGIS queries (anon role can't call ST_DWithin)
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify the JWT to get user id
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

    const { latitude, longitude, site_id, punch_type } = await req.json();

    if (!latitude || !longitude || !site_id || !punch_type) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: latitude, longitude, site_id, punch_type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use PostGIS ST_DWithin for server-side geofence check
    const { data: verifyResult, error: verifyError } = await adminClient.rpc("verify_guard_location", {
      _site_id: site_id,
      _lat: latitude,
      _lon: longitude,
    });

    // Fallback: if the RPC doesn't exist yet, do a manual check
    if (verifyError) {
      // Fetch site and do Haversine fallback
      const { data: site, error: siteError } = await adminClient
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

      // Haversine fallback
      const R = 6371e3;
      const dLat = ((site.latitude - latitude) * Math.PI) / 180;
      const dLon = ((site.longitude - longitude) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((latitude * Math.PI) / 180) *
          Math.cos((site.latitude * Math.PI) / 180) *
          Math.sin(dLon / 2) ** 2;
      const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

      if (distance > site.radius_meters) {
        return new Response(
          JSON.stringify({
            error: `You are ${Math.round(distance)}m from the site. Must be within ${site.radius_meters}m.`,
            distance: Math.round(distance),
            within_geofence: false,
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Insert punch
      const { data: punch, error: punchError } = await adminClient
        .from("clock_punches")
        .insert({
          user_id: userId,
          punch_type,
          latitude,
          longitude,
          within_geofence: true,
          address_label: site.name,
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
    }

    // PostGIS RPC succeeded
    const result = verifyResult;
    if (!result || !result.within_geofence) {
      const dist = result?.distance_meters ?? 0;
      const radius = result?.radius_meters ?? 200;
      return new Response(
        JSON.stringify({
          error: `You are ${Math.round(dist)}m from the site. Must be within ${radius}m.`,
          distance: Math.round(dist),
          within_geofence: false,
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verified — save the clock punch
    const { data: punch, error: punchError } = await adminClient
      .from("clock_punches")
      .insert({
        user_id: userId,
        punch_type,
        latitude,
        longitude,
        within_geofence: true,
        address_label: result.site_name,
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
        distance: Math.round(result.distance_meters),
        within_geofence: true,
        punch_id: punch.id,
        site_name: result.site_name,
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
