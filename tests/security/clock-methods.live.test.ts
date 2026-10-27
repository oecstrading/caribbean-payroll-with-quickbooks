import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { randomInt } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, it } from "vitest";
const env = Object.fromEntries(readFileSync(resolve(".env"), "utf8").split("\n").filter(line => /^VITE_/.test(line)).map(line => { const i = line.indexOf("="); return [line.slice(0, i), line.slice(i + 1).trim().replace(/^['"]|['"]$/g, "")]; }));
const minted = JSON.parse(readFileSync(process.env.LOVABLE_TEST_SESSION_FILE || resolve(homedir(), ".cache/lovable-auth/session.json"), "utf8"));
const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${minted.session.access_token}` } } });
const employee = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbba8";
// Opt-in fixture provisioned through approved data tools; never use a real employee.
it("saves PIN-only clock access and rejects voice requests on the server", async () => {
  const pin = String(randomInt(100000, 1000000));
  const configured = await client.rpc("configure_employee_clock_methods", { _employee: employee, _code: "clock-verification", _pin: pin, _start: "08:00", _end: "16:00", _days: [1,2,3,4,5], _break: 0, _site: null, _enabled: true, _methods: ["pin"] });
  expect(configured.error).toBeNull();
  const saved = await client.rpc("employee_clock_configuration", { _employee: employee });
  expect(saved.error).toBeNull();
  expect(saved.data).toMatchObject({ employee_code: "clock-verification", pin_configured: true, allowed_methods: ["pin"] });
  const denied = await client.functions.invoke("workforce-clock", { body: { action: "status", mode: "voice", org_id: "11111111-1111-4111-8111-111111111111", employee_code: "clock-verification", pin } });
  expect(denied.error).not.toBeNull();
  const allowed = await client.functions.invoke("workforce-clock", { body: { action: "status", mode: "device", org_id: "11111111-1111-4111-8111-111111111111", employee_code: "clock-verification", pin } });
  expect(allowed.error).toBeNull(); expect(allowed.data?.allowed_methods).toEqual(["pin"]);
});