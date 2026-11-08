import { describe, expect, it } from "vitest";
import { clockIsWorking, clockNeedsAttention, filterMonitoredClocks, type MonitoredClock } from "@/lib/clock-monitoring";

const clock = (status: MonitoredClock["status"], type: MonitoredClock["type"] = "personal"): MonitoredClock => ({
  id: `${type}-${status}`, type, name: status, department: null, site_id: null, site_name: null,
  latitude: null, longitude: null, status, last_seen_at: null, last_activity_at: null,
  current_activity: null, punches_today: 0,
});

describe("clock monitoring status rules", () => {
  it("flags a shared tablet offline for attention", () => {
    expect(clockNeedsAttention(clock("offline", "shared"))).toBe(true);
  });

  it("does not call a personal phone offline merely because its app is closed", () => {
    const phone = clock("ready");
    expect(clockNeedsAttention(phone)).toBe(false);
    expect(phone.status).not.toBe("offline");
  });

  it("treats synced offline punches as needing manager review", () => {
    expect(clockNeedsAttention(clock("sync_review"))).toBe(true);
  });

  it("counts clocked-in and lunch states as working", () => {
    expect(clockIsWorking(clock("clocked_in"))).toBe(true);
    expect(clockIsWorking(clock("on_lunch"))).toBe(true);
    expect(clockIsWorking(clock("ready"))).toBe(false);
  });

  it("filters the center without mixing personal and shared clocks", () => {
    const clocks = [clock("online", "shared"), clock("clocked_in"), clock("offline", "shared")];
    expect(filterMonitoredClocks(clocks, "personal").map((c) => c.id)).toEqual(["personal-clocked_in"]);
    expect(filterMonitoredClocks(clocks, "attention").map((c) => c.id)).toEqual(["shared-offline"]);
    expect(filterMonitoredClocks(clocks, "working").map((c) => c.id)).toEqual(["personal-clocked_in"]);
  });
});
