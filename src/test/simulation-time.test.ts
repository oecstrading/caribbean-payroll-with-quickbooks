import { describe, expect, it } from "vitest";
import { simulationStartSchema, simulatedTime, nextSimulatedPunch } from "@/lib/simulation-time";
describe("simulated attendance clock", () => {
  it("starts on November 1 without changing the device clock", () => {
    const device = Date.parse("2026-10-20T17:00:00Z");
    expect(simulatedTime("2026-11-01T08:00:00Z", "2026-10-20T17:00:00Z", device).toISOString()).toBe("2026-11-01T08:00:00.000Z");
    expect(device).toBe(Date.parse("2026-10-20T17:00:00Z"));
  });
  it("advances simulated time at the device rate", () => {
    expect(simulatedTime("2026-11-01T08:00:00Z", "2026-10-20T17:00:00Z", Date.parse("2026-10-20T17:01:30Z")).toISOString()).toBe("2026-11-01T08:01:30.000Z");
  });
  it("alternates test clock in and out", () => {
    expect(nextSimulatedPunch()).toBe("clock_in");
    expect(nextSimulatedPunch("clock_in")).toBe("clock_out");
    expect(nextSimulatedPunch("clock_out")).toBe("clock_in");
  });
  it("validates reset dates", () => {
    expect(simulationStartSchema.safeParse(new Date("2026-11-01T08:00:00Z")).success).toBe(true);
    expect(simulationStartSchema.safeParse(new Date("invalid")).success).toBe(false);
  });
});