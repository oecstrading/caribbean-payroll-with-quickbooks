import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.25.76";

// Shared company tablet clock. A tablet is trusted only after an admin-issued, 15-minute activation code
// is exchanged for a long random token (stored hashed). Staff identify by name + PIN, or hands-free by
// voice + mandatory selfie; voice and offline punches always wait for a manager.
const dir = z.enum(["auto", "clock_in", "clock_out", "lunch_out", "lunch_in"]);
const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("activate"), code: z.string().trim().regex(/^[A-Za-z0-9]{6,12}$/) }),
  z.object({ action: z.literal("roster"), token: z.string().min(32).max(128) }),
  z.object({ action: z.literal("status"), token: z.string().min(32).max(128), employee_id: z.string().uuid().optional(), pin: z.string().regex(/^\d{4,6}$/).optional(), transcript: z.string().max(200).optional() }),
  z.object({
    action: z.literal("punch"), token: z.string().min(32).max(128),
    employee_id: z.string().uuid().optional(), pin: z.string().regex(/^\d{4,6}$/).optional(), transcript: z.string().max(200).optional(),
    direction: dir, latitude: z.number().finite().min(-90).max(90), longitude: z.number().finite().min(-180).max(180),
    photo: z.string().max(1_500_000).optional(), captured_at: z.string().datetime({ offset: true }).optional(), offline_id: z.string().uuid().optional(),
  }),
]);
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } });
const sha = async (s: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))).map((b) => b.toString(16).padStart(2, "0")).join("");
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);
  try {
    const parsed = body.safeParse(await req.json());
    if (!parsed.success) return reply({ error: "Invalid clock request" }, 400);
    const b = parsed.data;
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    if (b.action === "activate") {
      const { data: d } = await db.from("clock_devices").select("id,org_id,name,department,activation_expires_at,revoked_at").eq("activation_hash", await sha(b.code.toUpperCase())).maybeSingle();
      if (!d || !d.activation_expires_at || new Date(d.activation_expires_at) < new Date()) return reply({ error: "This activation code is wrong or expired. Ask your administrator for a new one." }, 403);
      const raw = new Uint8Array(32); crypto.getRandomValues(raw);
      const token = Array.from(raw).map((x) => x.toString(16).padStart(2, "0")).join("");
      const up = await db.from("clock_devices").update({ token_hash: await sha(token), activation_hash: null, activation_expires_at: null, activated_at: new Date().toISOString(), revoked_at: null, last_seen_at: new Date().toISOString() }).eq("id", d.id);
      if (up.error) return reply({ error: "Activation failed" }, 500);
      return reply({ token, name: d.name });
    }

    const { data: device } = await db.from("clock_devices").select("id,org_id,name,department,site_id,revoked_at").eq("token_hash", await sha(b.token)).maybeSingle();
    if (!device || device.revoked_at) return reply({ error: "This clock has been switched off. Ask your administrator to activate it again.", deactivated: true }, 401);
    const org = device.org_id;
    await db.from("clock_devices").update({ last_seen_at: new Date().toISOString() }).eq("id", device.id);
    const [company, settings, staff, scheds] = await Promise.all([
      db.from("company_settings").select("company_name").eq("org_id", org).maybeSingle(),
      db.from("workforce_clock_settings").select("selfie_policy").eq("org_id", org).maybeSingle(),
      db.from("payroll_employee_directory").select("user_id,first_name,last_name,department").eq("org_id", org).is("deleted_at", null).ilike("status", "active"),
      db.from("workforce_schedules").select("employee_id").eq("org_id", org).eq("enabled", true),
    ]);
    const enabled = new Set((scheds.data ?? []).map((s) => s.employee_id));
    const people = (staff.data ?? []).filter((p) => enabled.has(p.user_id)).map((p) => ({ id: p.user_id as string, name: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim(), first: (p.first_name ?? "") as string, department: p.department as string | null }))
      .sort((x, y) => x.name.localeCompare(y.name));
    const selfie = settings.data?.selfie_policy ?? "optional";
    if (b.action === "roster") return reply({ device: { name: device.name, department: device.department }, company: company.data?.company_name ?? "", selfie_policy: selfie, employees: people });

    // Identify the person: tapped name + PIN, or spoken name matched here on the server.
    let employee: string | null = null; let voice = false;
    if (b.pin && b.employee_id) {
      const cred = await db.from("workforce_clock_credentials").select("employee_code").eq("org_id", org).eq("employee_id", b.employee_id).maybeSingle();
      if (!cred.data) return reply({ error: "No PIN is set up for you yet. Ask your administrator." }, 403);
      const r = await db.rpc("workforce_pin_employee", { _org: org, _code: cred.data.employee_code, _pin: b.pin });
      if (r.error || r.data !== b.employee_id) return reply({ error: "PIN not accepted. Repeated failures temporarily lock your PIN." }, 403);
      employee = b.employee_id;
    } else if (b.transcript) {
      const said = ` ${norm(b.transcript)} `;
      const creds = await db.from("workforce_clock_credentials").select("employee_id,employee_code").eq("org_id", org);
      const codeOf = new Map((creds.data ?? []).map((c) => [c.employee_id, norm(c.employee_code)]));
      let hits = people.filter((p) => p.name && said.includes(` ${norm(p.name)} `));
      if (!hits.length) hits = people.filter((p) => { const c = codeOf.get(p.id); return c && said.includes(` ${c} `); });
      if (!hits.length) hits = people.filter((p) => p.first && said.includes(` ${norm(p.first)} `));
      if (hits.length !== 1) return reply({ error: hits.length ? "More than one person has that name. Say your full name." : "I didn't recognise that name. Say your full name as it is on your employee file." }, 404);
      employee = hits[0].id; voice = true;
    } else return reply({ error: "Choose your name and enter your PIN" }, 400);
    const person = people.find((p) => p.id === employee);
    if (!person) return reply({ error: "Your time clock is switched off. Ask your administrator." }, 403);

    const open = await db.from("workforce_shifts").select("id,lunch_out,lunch_in").eq("org_id", org).eq("employee_id", employee).not("clock_in", "is", null).is("clock_out", null).order("clock_in", { ascending: false }).limit(1).maybeSingle();
    const next = !open.data ? "clock_in" : open.data.lunch_out && !open.data.lunch_in ? "lunch_in" : "clock_out";
    if (b.action === "status") return reply({ employee_id: employee, name: person.name, next, lunch_taken: !!open.data?.lunch_out, voice, selfie_required: voice || selfie === "always" });

    if ((voice || selfie === "always") && !b.photo) return reply({ error: voice ? "A selfie is required for voice clock-ins." : "Your company requires a selfie with every punch." }, 400);
    const direction = b.direction === "auto" ? next : b.direction;
    const clientId = b.offline_id ?? crypto.randomUUID();
    let lat = b.latitude, lon = b.longitude;
    // A registered tablet is bolted to its job site: use the site's position when the tablet has no GPS fix.
    if ((lat == null || lon == null) && device.site_id) { const st = await db.from("client_sites").select("latitude,longitude").eq("id", device.site_id).maybeSingle(); lat = st.data?.latitude ?? lat; lon = st.data?.longitude ?? lon; }
    const r = await db.rpc("record_workforce_punch_at", { _employee: employee, _org: org, _direction: direction, _mode: voice ? "voice" : "pin", _lat: lat, _lon: lon, _at: b.captured_at ?? null, _client: clientId });
    if (r.error) return reply({ error: r.error.message }, 400);
    let photoPath: string | null = null;
    if (b.photo) {
      const bytes = Uint8Array.from(atob(b.photo.replace(/^data:image\/\w+;base64,/, "")), (c) => c.charCodeAt(0));
      photoPath = `${org}/${employee}/${clientId}.jpg`;
      const up = await db.storage.from("clock-selfies").upload(photoPath, bytes, { contentType: "image/jpeg", upsert: true });
      if (up.error) photoPath = null;
    }
    const punch = await db.from("workforce_punches").update({ device_id: device.id, photo_path: photoPath }).eq("client_punch_id", clientId).select("shift_id").maybeSingle();
    const hasVoice = punch.data?.shift_id ? voice || !!(await db.from("workforce_punches").select("id").eq("shift_id", punch.data.shift_id).eq("mode", "voice").limit(1).maybeSingle()).data : false;
    if (hasVoice && punch.data?.shift_id) {
      await db.from("workforce_shifts").update({ approved_hours: null, review_status: "pending", review_notes: "Voice punch on company tablet: check the selfie before approving." }).eq("id", punch.data.shift_id).is("reviewed_at", null);
    }
    return reply({ ...(r.data as Record<string, unknown>), name: person.name, voice });
  } catch {
    return reply({ error: "Clock request failed. Please try again." }, 400);
  }
});
