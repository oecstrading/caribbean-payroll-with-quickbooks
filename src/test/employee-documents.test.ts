import { describe, it, expect } from "vitest";
import { canReadDocument, documentExpiry, documentSchema, validateDocumentFile } from "@/lib/employee-documents";
describe("employee documents", () => {
  it("keeps HR-only files hidden from employees", () => { expect(canReadDocument("employee", "one", "one", false)).toBe(false); });
  it("lets HR read private files", () => { expect(canReadDocument("manager", "one", "two", false)).toBe(true); });
  it("only shares with the owning employee", () => { expect(canReadDocument("employee", "one", "one", true)).toBe(true); expect(canReadDocument("employee", "one", "two", true)).toBe(false); });
  it("identifies expired certificates", () => { expect(documentExpiry("2026-10-19", "2026-10-20")).toBe("Expired"); });
  it("flags the 30-day expiry boundary", () => { expect(documentExpiry("2026-11-19", "2026-10-20")).toBe("Expiring soon"); expect(documentExpiry("2026-11-20", "2026-10-20")).toBe("Valid"); });
  it("accepts documents without expiry", () => { expect(documentSchema.safeParse({ title: "Contract", category: "Contract", expiry_date: "", employee_visible: false }).success).toBe(true); });
  it("rejects impossible expiry dates", () => { expect(documentSchema.safeParse({ title: "License", category: "Certification", expiry_date: "2026-02-30", employee_visible: false }).success).toBe(false); });
  it("rejects executable attachments", () => { expect(() => validateDocumentFile(new File(["x"], "test.exe"))).toThrow(); });
});