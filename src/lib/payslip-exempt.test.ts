import { describe, it, expect } from "vitest";
import { rebuildSlip, type ParsedSlip } from "./payslip-pdf";
const slip = { name: "A B", periodStart: "2026-10-16", periodEnd: "2026-10-31", earnings: [{ label: "Basic", kind: "basic", hours: null, rate: null, current: 1500 }], gross: 1500, taxes: 50, nicEE: 0, nicER: null, otherDeductions: [], totalAdjustments: 0, net: 1450 } as unknown as ParsedSlip;
describe("NIC/PAYE exemption", () => {
  it("charges no NIC when exempt", () => { const r = rebuildSlip(slip, { basis: "gross", paye: "as_slips", nicExempt: true }); expect(r.nicEE).toBe(0); expect(r.nicER).toBe(0); expect(r.net).toBe(1450); });
  it("charges NIC when not exempt", () => { expect(rebuildSlip(slip, { basis: "gross", paye: "as_slips" }).nicEE).toBeGreaterThan(0); });
  it("withholds no PAYE when exempt", () => { const r = rebuildSlip(slip, { basis: "gross", paye: "calculated", payeExempt: true }); expect(r.paye).toBe(0); });
});
