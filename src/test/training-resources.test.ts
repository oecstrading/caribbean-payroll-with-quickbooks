import { describe, it, expect } from "vitest";
import { TRAINING_RESOURCES } from "@/lib/training-resources";

describe("Training Hub share link", () => {
  const discover = TRAINING_RESOURCES.find(r => r.id === "builtin-discover");

  it("lists the customer share page at the published discover URL", () => {
    expect(discover?.url).toBe("https://caribbean-payroll-with-quickbooks.lovable.app/discover");
    expect(discover?.kind).toBe("link");
    expect(discover?.category).toBe("marketing");
  });

  it("opens as a page instead of downloading, so only file resources are stored", () => {
    expect(discover?.kind).toBe("link");
    for (const doc of TRAINING_RESOURCES.filter(r => r.id !== "builtin-discover")) {
      expect(doc.kind ?? "file").toBe("file");
      expect(doc.url.startsWith("/")).toBe(true);
    }
  });
});
