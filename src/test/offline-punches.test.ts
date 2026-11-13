import { describe, it, expect, beforeEach, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: vi.fn() } } }));
import { queuePunch, queuedPunches } from "@/lib/offline-punches";

describe("offline punches", () => {
  beforeEach(() => localStorage.clear());
  it("never writes the PIN to phone storage", () => {
    queuePunch({ direction: "clock_in", latitude: 1, longitude: 2, mode: "pin", org_id: "o", employee_code: "E1", pin: "1234" });
    expect(localStorage.getItem("offline-clock-punches")).not.toContain("1234");
    expect(queuedPunches()[0].employee_code).toBe("E1");
  });
  it("reports failure when the punch cannot be stored", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("full"); });
    expect(() => queuePunch({ direction: "clock_in", latitude: 1, longitude: 2, mode: "gps" })).toThrow(/NOT saved/);
    spy.mockRestore();
  });
});
