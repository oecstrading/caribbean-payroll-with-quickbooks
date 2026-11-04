import { describe, it, expect } from "vitest";
import { cleanListItems } from "@/hooks/useCompanyLists";
describe("company dropdown lists", () => {
  it("drops blanks and case-insensitive duplicates", () => {
    expect(cleanListItems([" Full-time ", "full-time", "", "Seasonal"])).toEqual(["Full-time", "Seasonal"]);
  });
});
