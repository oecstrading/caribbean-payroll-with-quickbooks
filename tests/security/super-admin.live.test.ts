import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

// Opt-in checks use only the requesting user's session; never remove a real account.
const env = Object.fromEntries(readFileSync(resolve(".env"), "utf8").split("\n").filter(line => /^VITE_/.test(line)).map(line => { const i = line.indexOf("="); return [line.slice(0, i), line.slice(i + 1).trim().replace(/^['"]|['"]$/g, "")]; }));
const minted = JSON.parse(readFileSync(process.env.LOVABLE_TEST_SESSION_FILE || resolve(homedir(), ".cache/lovable-auth/session.json"), "utf8"));
const id = minted.session.user.id;
const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${minted.session.access_token}` } } });
describe.sequential("owner super administrator safeguards", () => {
  it("gives the requesting owner both company and platform authority", async () => {
    const result = await client.rpc("administrator_authority", { _user: id });
    expect(result.error).toBeNull();
    expect(result.data).toEqual({ company_super_admin: true, platform_super_admin: true });
  });
  it("rejects removing the owner's own super-admin authority", async () => {
    const result = await client.rpc("set_administrator_authority", { _user: id, _company: false, _platform: false });
    expect(result.error?.message).toContain("cannot remove your own");
  });
  it("rejects deleting the owner's own account", async () => {
    const result = await client.functions.invoke("delete-employee", { body: { employee_id: id, confirmation: "DELETE" } });
    expect(result.error).not.toBeNull();
    const profile = await client.from("profiles").select("deleted_at").eq("user_id", id).single();
    expect(profile.error).toBeNull(); expect(profile.data?.deleted_at).toBeNull();
  });
  it("blocks browser writes to company super administrator authority", async () => {
    const result = await client.from("company_super_administrators").update({ user_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1" }).eq("user_id", id).select("user_id");
    expect(result.data ?? []).toEqual([]);
    const retained = await client.from("company_super_administrators").select("user_id").eq("user_id", id).single();
    expect(retained.error).toBeNull(); expect(retained.data?.user_id).toBe(id);
  });
  it("rejects assigning platform authority to a missing or foreign-company account", async () => {
    const result = await client.rpc("set_administrator_authority", { _user: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1", _company: true, _platform: true });
    expect(result.error?.message).toContain("active administrator in your company");
  });
});