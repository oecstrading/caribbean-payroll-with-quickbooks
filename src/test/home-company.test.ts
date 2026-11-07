import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyHomeCompany, clearHomeCompanyFlag } from "@/lib/home-company";

const SMILEY = "11111111-1111-4111-8111-111111111111";
const SONRISA = "03c7c7f7-439a-4512-b2ae-62c6814bfd94";
const USER = "2d779817-5a6a-40e6-8140-45e5e0dfe126";

const rpc = vi.fn();
const assign = vi.fn();

beforeEach(() => {
  rpc.mockReset();
  assign.mockReset();
  sessionStorage.clear();
  Object.defineProperty(window, "location", { value: { assign }, configurable: true, writable: true });
});

afterEach(() => {
  vi.resetModules();
});

function stubRpc(home: string | null, current: string | null) {
  rpc.mockImplementation(async (name: string) => {
    if (name === "my_companies") return { data: [{ id: SMILEY, name: "Smileys Inc", is_home: home === SMILEY }, { id: SONRISA, name: "SONRISA", is_home: home === SONRISA }], error: null };
    if (name === "current_org_id") return { data: current, error: null };
    if (name === "switch_company") return { data: null, error: null };
    return { data: null, error: { message: `unexpected rpc ${name}` } };
  });
}

describe("Home company on sign-in", () => {
  it("opens the home company instead of the last company switched to", async () => {
    stubRpc(SMILEY, SONRISA);
    expect(await applyHomeCompany(USER)).toBe(true);
    expect(rpc).toHaveBeenCalledWith("switch_company", { _org: SMILEY });
    expect(assign).toHaveBeenCalledWith("/");
  });

  it("leaves the company alone when the user is already on their home company", async () => {
    stubRpc(SMILEY, SMILEY);
    expect(await applyHomeCompany(USER)).toBe(false);
    expect(rpc).not.toHaveBeenCalledWith("switch_company", expect.anything());
    expect(assign).not.toHaveBeenCalled();
  });

  it("does not undo a company switch made later in the same session", async () => {
    stubRpc(SMILEY, SONRISA);
    expect(await applyHomeCompany(USER)).toBe(true);
    stubRpc(SMILEY, SONRISA);
    expect(await applyHomeCompany(USER)).toBe(false);
    expect(rpc).toHaveBeenCalledTimes(4);
    expect(assign).toHaveBeenCalledTimes(1);
  });

  it("keeps the last company when the user has no home company assigned", async () => {
    stubRpc(null, SONRISA);
    expect(await applyHomeCompany(USER)).toBe(false);
    expect(rpc).not.toHaveBeenCalledWith("switch_company", expect.anything());
  });

  it("re-applies the home company after signing out", async () => {
    stubRpc(SMILEY, SONRISA);
    await applyHomeCompany(USER);
    clearHomeCompanyFlag();
    stubRpc(SMILEY, SONRISA);
    expect(await applyHomeCompany(USER)).toBe(true);
    expect(assign).toHaveBeenCalledTimes(2);
  });

  it("stays on the current company when the backend cannot be reached", async () => {
    rpc.mockImplementation(async () => ({ data: null, error: { message: "Service unavailable" } }));
    expect(await applyHomeCompany(USER)).toBe(false);
    expect(assign).not.toHaveBeenCalled();
  });
});
