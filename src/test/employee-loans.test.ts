import { describe, expect, it } from "vitest";
import { loanDeduction, loanSchema } from "@/lib/employee-loans";
describe("employee loan repayments", () => {
  it("deducts Marcus's monthly 100 from the 500 balance", () => expect(loanDeduction(500, 100, 1)).toBe(100));
  it("deducts Kurt's monthly 200 from the 1200 balance", () => expect(loanDeduction(1200, 200, 1)).toBe(200));
  it("bounds final repayment by remaining balance", () => expect(loanDeduction(35, 100, 1)).toBe(35));
  it("prorates weekly repayments", () => expect(loanDeduction(500, 100, 12 / 52)).toBe(23.08));
  it("prorates semi-monthly repayments", () => expect(loanDeduction(500, 100, 0.5)).toBe(50));
  it("rejects a balance above principal", () => expect(loanSchema.safeParse({ employee: "11111111-1111-4111-8111-111111111111", creditor: "22222222-2222-4222-8222-222222222222", original: 800, balance: 801, monthly: 100, notes: "" }).success).toBe(false));
});