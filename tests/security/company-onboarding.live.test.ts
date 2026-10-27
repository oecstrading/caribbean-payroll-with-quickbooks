import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { describe, it, expect } from "vitest";

// Opt-in, requesting-user checks only; no privileged credentials or automatic live writes.
const enabled = process.env.RUN_COMPANY_ONBOARDING_SECURITY === "1";
describe.skipIf(!enabled)("company onboarding security", () => {
  const env = enabled ? Object.fromEntries(readFileSync(resolve(".env"), "utf8").split("\n").filter(l => /^VITE_/.test(l)).map(l => { const i = l.indexOf("="); return [l.slice(0,i), l.slice(i+1).trim().replace(/^['"]|['"]$/g, "")]; })) : {};
  const minted = enabled ? JSON.parse(readFileSync(resolve(homedir(), ".cache/lovable-auth/session.json"), "utf8")) : null;
  const client = enabled ? createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${minted.session.access_token}` } } }) : null;
  it("denies direct company creation even to the platform owner", async () => {
    if (!client) throw new Error("Session required");
    const result = await client.from("organizations").insert({ name: "Must never be created directly" });
    expect(result.error).not.toBeNull();
  });
  it("denies direct customer assignment RPC", async () => {
    if (!client) throw new Error("Session required");
    const result = await client.rpc("complete_company_setup", { _user: minted.user_id, _token: "a".repeat(64), _details: { company_name: "Invalid assignment" } });
    expect(result.error).not.toBeNull();
  });
  it("denies direct cross-company metadata RPC", async () => {
    if (!client) throw new Error("Session required");
    const result = await client.rpc("update_platform_company", { _actor: minted.user_id, _org: "11111111-1111-4111-8111-111111111111", _details: { company_name: "Invalid edit" } });
    expect(result.error).not.toBeNull();
  });
  it("rejects assigning an existing company member to a new company", async () => {
    if (!client) throw new Error("Session required");
    const result = await client.rpc("issue_company_setup", { _details: { company_name: "Must not exist", email: minted.email }, _create_now: true });
    expect(result.error?.message).toContain("already belongs to a company");
  });
  it("rejects unauthenticated company listing and link generation", async () => {
    const anonymous = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
    expect((await anonymous.rpc("platform_companies")).error).not.toBeNull();
    expect((await anonymous.rpc("issue_company_setup", { _details: { company_name: "Must not exist", email: "fixture@example.com" } })).error).not.toBeNull();
  });
});