import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

    const { audioUrl, siteId } = await req.json();
    if (!audioUrl) throw new Error("audioUrl is required");

    // Step 1: Download the audio file
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) throw new Error("Failed to fetch audio file");
    const audioBlob = await audioResponse.blob();

    // Step 2: Convert audio to base64 for the AI model
    const audioBuffer = await audioBlob.arrayBuffer();
    const audioBase64 = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)));

    // Step 3: Transcribe using Gemini's multimodal capabilities
    const mimeType = audioUrl.includes(".webm") ? "audio/webm" : "audio/mp4";

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
