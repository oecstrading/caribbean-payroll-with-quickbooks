import { describe, it, expect } from "vitest";
import { estimatePayroll, runFactor } from "./payroll-forecast";

const yanita = { name: "Yanita", gross: 1150, employeeNic: 57.5, employerNic: 57.5, paye: 0, otherDeductions: 300, net: 792.5 };

describe("payroll forecast", () => {
  it("semi-monthly to semi-monthly keeps the last figures", () => {
    expect(estimatePayroll([yanita], 0.5, 0.5)[0].net).toBe(792.5);
  });
  it("semi-monthly to monthly doubles amounts", () => {
    expect(estimatePayroll([yanita], 0.5, 1)[0]).toMatchObject({ gross: 2300, employeeNic: 115, net: 1585 });
  });
  it("reads a semi-monthly run as half a month", () => {
    expect(runFactor("semi_monthly", "2026-10-16", "2026-10-31")).toBe(0.5);
  });
});
