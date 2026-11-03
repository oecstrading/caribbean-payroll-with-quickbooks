import { describe, it, expect } from "vitest";
import { isRecurringFrequency, periodAmount } from "./recurring-items";
describe("recurring items", () => {
  it("treats one-time items (bonuses) as one-off", () => { expect(isRecurringFrequency("one-time")).toBe(false); expect(isRecurringFrequency("monthly")).toBe(true); });
  it("zero removes the item for this period", () => expect(periodAmount({ action: "zero" }, 150)).toBe(0));
  it("edit uses the entered amount", () => expect(periodAmount({ action: "edit", amount: 80 }, 150)).toBe(80));
  it("keep uses the standard amount", () => expect(periodAmount({ action: "keep" }, 150)).toBe(150));
});
