import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const authorization = req.headers.get("Authorization");
    const url = Deno.env.get("SUPABASE_URL"); const key = Deno.env.get("SUPABASE_ANON_KEY");
    if (!authorization || !url || !key) return new Response(JSON.stringify({ error: "Sign in required" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const client = createClient(url, key, { global: { headers: { Authorization: authorization } } });
    const { data: auth } = await client.auth.getUser();
    if (!auth.user) return new Response(JSON.stringify({ error: "Sign in required" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { audioPath, siteId } = await req.json();
    if (typeof audioPath !== "string" || audioPath.length > 500 || !audioPath.startsWith(`reports/${auth.user.id}/`) || audioPath.includes("..") || typeof siteId !== "string" || !/^[0-9a-f-]{36}$/i.test(siteId)) return new Response(JSON.stringify({ error: "Invalid recording or site" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { data: site } = await client.from("client_sites").select("id").eq("id", siteId).maybeSingle();
    if (!site) return new Response(JSON.stringify({ error: "Site access denied" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { data: audioBlob, error: fileError } = await client.storage.from("incident-audio").download(audioPath);
    if (fileError || !audioBlob || audioBlob.size > 20000000) throw new Error("Recording unavailable or too large");

    // Step 1: Download the audio file

    // Step 2: Convert audio to base64 for the AI model
    const audioBuffer = await audioBlob.arrayBuffer();
    const audioBase64 = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)));

    // Step 3: Transcribe using Gemini's multimodal capabilities
    const mimeType = audioPath.endsWith(".webm") ? "audio/webm" : "audio/mp4";

    const transcriptionResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content:
                "You are a transcription assistant. Transcribe the following audio recording exactly as spoken. Output ONLY the transcription, no commentary.",
            },
            {
              role: "user",
              content: [
                {
                  type: "input_audio",
                  input_audio: { data: audioBase64, format: mimeType.split("/")[1] },
                },
                { type: "text", text: "Transcribe this audio recording exactly as spoken." },
              ],
            },
          ],
        }),
      }
    );

    if (!transcriptionResponse.ok) {
      const errText = await transcriptionResponse.text();
      console.error("Transcription error:", transcriptionResponse.status, errText);
      throw new Error(`Transcription failed: ${transcriptionResponse.status}`);
    }

    const transcriptionData = await transcriptionResponse.json();
    const transcript =
      transcriptionData.choices?.[0]?.message?.content || "Unable to transcribe audio.";

    // Step 4: Generate professional report using AI
    const reportResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content: `You are a professional security supervisor for a leading OECS security firm. Transform the raw, spoken guard report below into a formal, structured incident report suitable for high-end residential and commercial clients.

Structure the report with these sections:
**SUMMARY**: A brief 2-3 sentence overview.
**OBSERVATIONS**: Detailed account of what was observed, using professional security terminology.
**ACTIONS TAKEN**: What the guard did in response.
**RECOMMENDED FOLLOW-UP**: Suggestions for management or client.

Rules:
- Use objective, professional language
- Convert slang or casual speech to formal security terminology
- Include approximate timestamps if mentioned
- Keep the factual accuracy of the original report
- Do NOT add information that was not in the original

Also generate a concise title (max 10 words) for this incident on the first line, prefixed with "TITLE: ".`,
            },
            {
              role: "user",
              content: `Raw guard voice report transcript:\n\n"${transcript}"`,
            },
          ],
        }),
      }
    );

    if (!reportResponse.ok) {
      const errText = await reportResponse.text();
      console.error("Report generation error:", reportResponse.status, errText);
      throw new Error(`Report generation failed: ${reportResponse.status}`);
    }

    const reportData = await reportResponse.json();
    const fullReport = reportData.choices?.[0]?.message?.content || transcript;

    // Extract title from the report
    let title = "Voice Incident Report";
    let report = fullReport;
    const titleMatch = fullReport.match(/^TITLE:\s*(.+)/m);
    if (titleMatch) {
      title = titleMatch[1].trim();
      report = fullReport.replace(/^TITLE:\s*.+\n*/m, "").trim();
    }

    return new Response(
      JSON.stringify({ transcript, report, title }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("process-incident-report error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
