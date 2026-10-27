import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import bcrypt from "npm:bcryptjs@2.4.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, pin } = await req.json();

    if (typeof email !== "string" || email.length > 255 || typeof pin !== "string") {
      return new Response(JSON.stringify({ error: "Email and PIN are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate PIN format (4-6 digits)
    if (!/^\d{4,6}$/.test(pin)) {
      return new Response(JSON.stringify({ error: "PIN must be 4-6 digits" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Service unavailable");
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Find user by email from profiles
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("user_id, status, email, deleted_at")
      .eq(email.includes("@") ? "email" : "login_username", email.trim().toLowerCase())
      .maybeSingle();

    if (profileErr || !profile) {
      return new Response(JSON.stringify({ error: "Invalid credentials" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (profile.status !== "Active" || profile.deleted_at) {
      return new Response(JSON.stringify({ error: "Account is inactive" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: allowed, error: attemptError } = await supabase.rpc("claim_user_pin_attempt", { _user: profile.user_id });
    if (attemptError || !allowed) return new Response(JSON.stringify({ error: "Too many attempts. Try again in 15 minutes." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    // Check PIN
    const { data: pinRecord, error: pinErr } = await supabase
      .from("user_pins")
      .select("*")
      .eq("user_id", profile.user_id)
      .eq("is_enabled", true)
      .maybeSingle();

    if (pinErr || !pinRecord) {
      return new Response(JSON.stringify({ error: "PIN login not enabled for this account" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Simple hash comparison (SHA-256)
    const encoder = new TextEncoder();
    const data = encoder.encode(pin + profile.user_id);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    const valid = pinRecord.pin_hash.startsWith("$2") ? await bcrypt.compare(pin, pinRecord.pin_hash) : hashHex === pinRecord.pin_hash;
    if (!valid) {
      return new Response(JSON.stringify({ error: "Invalid credentials" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: identity } = await supabase.auth.admin.getUserById(profile.user_id);
    if (!identity.user?.email_confirmed_at || identity.user.email !== profile.email) return new Response(JSON.stringify({ error: "Confirm your email invitation before signing in" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    // Generate a session for this user
    // We use the admin API to generate a magic link token
    const { data: authData, error: authError } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: profile.email,
    });

    if (authError || !authData) {
      return new Response(JSON.stringify({ error: "Authentication failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the token to get a session
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!anonKey) throw new Error("Service unavailable");
    const anonClient = createClient(supabaseUrl, anonKey);
    
    const tokenHash = authData.properties?.hashed_token;
    if (!tokenHash) {
      return new Response(JSON.stringify({ error: "Authentication failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: session, error: verifyErr } = await anonClient.auth.verifyOtp({
      token_hash: tokenHash,
      type: "magiclink",
    });

    if (verifyErr || !session.session) {
      return new Response(JSON.stringify({ error: "Session creation failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("user_pin_attempts").delete().eq("user_id", profile.user_id);
    return new Response(
      JSON.stringify({
        access_token: session.session.access_token,
        refresh_token: session.session.refresh_token,
        expires_in: session.session.expires_in,
        user: session.user,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
