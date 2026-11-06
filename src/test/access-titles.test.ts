import { describe, it, expect } from "vitest";
import { canOpenPath, titleAllowedModules, titleDefaultModules } from "@/lib/workspace-access";

describe("job roles", () => {
  it("employee gets the clock but no payroll pages", () => {
    const m = titleDefaultModules("employee");
    expect(canOpenPath("employee", m, "/attendance")).toBe(true);
    expect(canOpenPath("employee", m, "/payroll")).toBe(false);
  });
  it("pay master defaults open payroll pages but not user management", () => {
    const m = titleDefaultModules("paymaster");
    expect(canOpenPath("manager", m, "/payroll")).toBe(true);
    expect(canOpenPath("manager", m, "/reports")).toBe(true);
    expect(canOpenPath("manager", m, "/users")).toBe(false);
  });
  it("pay master cannot be given security operations", () => {
    expect(titleAllowedModules("paymaster")).not.toContain("security");
  });
  it("manager starts with no assigned tabs", () => {
    expect(canOpenPath("manager", titleDefaultModules("manager"), "/payroll")).toBe(false);
  });
});
