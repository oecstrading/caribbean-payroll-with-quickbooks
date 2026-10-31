import { describe, it, expect } from "vitest";
import { estimateDraftPay } from "@/lib/staff-pay-preview";

const base = { hours: 0, regular: 0, overtime: 0, pending: 0, shifts: 0, multiplier: 1.5, pay_frequency: "", pay_rate: 0, monthly_salary: 0 };

describe("staff draft pay preview", () => {
  it("pays hourly overtime at the company multiplier", () => {
    expect(estimateDraftPay({ ...base, pay_frequency: "Hourly", pay_rate: 10, regular: 40, overtime: 4 }, "2026-10-01", "2026-10-31")).toBe(460);
  });
  it("pays daily staff per worked shift", () => {
    expect(estimateDraftPay({ ...base, pay_frequency: "Daily", pay_rate: 120, shifts: 5 }, "2026-10-01", "2026-10-31")).toBe(600);
  });
  it("shows full monthly salary for a whole month", () => {
    expect(estimateDraftPay({ ...base, monthly_salary: 3000 }, "2026-10-01", "2026-10-31")).toBe(3000);
  });
});
