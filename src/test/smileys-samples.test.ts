import { describe, expect, it } from "vitest";
import { sampleEmployees, sampleAttendance } from "@/lib/sample-data";

describe("Smiley's demonstration records", () => {
  it("includes the requested tinting company without replacing existing samples", () => {
    expect(sampleEmployees.some((employee) => employee.companyName === "Smiley's Tinting Services (Sample)")).toBe(true);
    expect(sampleEmployees.some((employee) => employee.id === "1" && employee.firstName === "Jarrel")).toBe(true);
  });
  it("keeps fictional staff distinct from authentication identities", () => {
    const employees = sampleEmployees.filter((employee) => employee.companyName);
    expect(employees.length).toBeGreaterThan(0);
    for (const employee of employees) {
      expect(employee.id).toMatch(/^smileys-demo-/);
      expect(employee.email).toMatch(/@example\.invalid$/);
      expect(sampleAttendance.some((record) => record.personId === employee.personId)).toBe(true);
    }
  });
});