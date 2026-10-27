import { describe, it, expect } from "vitest";
import { canOpenPath, roleModules } from "@/lib/workspace-access";

describe("role-based workspaces", () => {
  it("restricts even administrators to purchased company features", () => {
    const smiley = ["hr", "payroll", "reports", "leave", "attendance", "quickbooks", "settings"];
    expect(canOpenPath("admin", [], "/guard-tour", smiley)).toBe(false);
    expect(canOpenPath("admin", [], "/projects", smiley)).toBe(false);
    expect(canOpenPath("admin", [], "/quickbooks", smiley)).toBe(true);
    expect(canOpenPath("admin", [], "/users", smiley)).toBe(true);
  });
  it("keeps administrators fully enabled even with empty custom access", () => {
    expect(canOpenPath("admin", [], "/users")).toBe(true);
    expect(canOpenPath("admin", [], "/payroll")).toBe(true);
  });
  it("never lets operational managers create or delete users", () => {
    expect(canOpenPath("manager", roleModules("manager"), "/users")).toBe(false);
  });
  it("applies a manager's selected modules rather than broad role defaults", () => {
    expect(canOpenPath("manager", ["hr"], "/employees")).toBe(true);
    expect(canOpenPath("manager", ["hr"], "/payroll")).toBe(false);
    expect(canOpenPath("manager", ["hr"], "/reports")).toBe(false);
  });
  it("does not elevate employees through a management module override", () => {
    expect(canOpenPath("employee", ["payroll", "hr", "security"], "/payroll")).toBe(false);
    expect(canOpenPath("employee", ["payroll", "hr", "security"], "/employees")).toBe(false);
    expect(canOpenPath("employee", ["security"], "/command-center")).toBe(false);
    expect(canOpenPath("employee", ["security"], "/guard-tour")).toBe(true);
  });
  it("includes only applicable personal pages when all modules are off", () => {
    expect(canOpenPath("employee", [], "/")).toBe(true);
    expect(canOpenPath("employee", [], "/portal")).toBe(true);
    expect(canOpenPath("employee", [], "/attendance")).toBe(false);
  });
  it("fails closed for missing roles and unknown destinations", () => {
    expect(canOpenPath(null, ["payroll"], "/payroll")).toBe(false);
    expect(canOpenPath("admin", [], "/not-a-page")).toBe(false);
  });
});