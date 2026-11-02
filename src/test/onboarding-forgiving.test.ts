import { describe, it, expect } from "vitest";
import { normalizeDate, isExampleName } from "@/lib/onboarding-sheet";

describe("onboarding sheet tolerance", () => {
  it("reads a year-month date as the first of the month", () => expect(normalizeDate("2026-02")).toBe("2026-02-01"));
  it("reads day-first dates", () => expect(normalizeDate("5/2/2026")).toBe("2026-02-05"));
  it("skips template example rows", () => {
    expect(isExampleName("Example Person One")).toBe(true);
    expect(isExampleName("Loriann Hope")).toBe(false);
  });
});
