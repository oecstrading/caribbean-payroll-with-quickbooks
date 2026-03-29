import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ROUTES = {
  dashboard: "/dashboard",
  employees: "/employees",
  payroll: "/payroll",
  roster: "/roster",
  attendance: "/attendance",
  incidents: "/incidents",
  reports: "/reports",
  "daily-reports": "/daily-reports",
  "guard-tour": "/guard-tour",
  settings: "/settings",
  invoicing: "/invoicing",
  applicants: "/applicants",
  leave: "/leave",
  equipment: "/equipment",
  sites: "/sites",
  geofencing: "/geofencing",
  "command-center": "/command-center",
  contractors: "/contractors",
  projects: "/projects",
  compliance: "/compliance",
  "guard-performance": "/guard-performance",
  "late-clock-in-report": "/late-clock-in-report",
  violations: "/violations",
  deductions: "/deductions",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { command } = await req.json();
    if (!command) throw new Error("command is required");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        tools: [
          {
            type: "function",
            function: {
              name: "navigate",
              description: "Navigate to a page in the security management app",
              parameters: {
                type: "object",
                properties: {
                  route: {
                    type: "string",
                    enum: Object.values(ROUTES),
                    description: "The route to navigate to",
                  },
                  message: {
                    type: "string",
                    description: "A brief confirmation message for the user",
                  },
                },
                required: ["route", "message"],
                additionalProperties: false,
              },
            },
          },
          {
            type: "function",
            function: {
              name: "no_match",
              description: "When the command doesn't match any navigation intent",
              parameters: {
                type: "object",
                properties: {
                  message: {
                    type: "string",
                    description: "A helpful message suggesting valid commands",
                  },
                },
                required: ["message"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: "auto",
        messages: [
          {
            role: "system",
            content: `You are a voice command interpreter for a security workforce management app. The available pages are: ${Object.keys(ROUTES).join(", ")}. Interpret the user's spoken command and determine which page they want to navigate to. If unclear, use no_match.`,
          },
          { role: "user", content: command },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (toolCall) {
      const args = JSON.parse(toolCall.function.arguments);
      if (toolCall.function.name === "navigate") {
        return new Response(JSON.stringify({ route: args.route, message: args.message }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ route: null, message: args.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ route: null, message: "I didn't understand that command." }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("voice-command error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
