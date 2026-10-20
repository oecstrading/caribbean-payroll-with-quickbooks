import { describe, expect, it } from "vitest";
import { employeePermissions, employeeFolderSchema, emptyEmployee, folderUpdate, sampleToFolder } from "@/lib/employee-folder";
import { sampleEmployees } from "@/lib/sample-data";

describe("employee folder permissions", () => {
  it("gives administrators create, edit and deletion access", () => {
    expect(employeePermissions("admin")).toEqual({ edit: true, create: true, delete: true });
  });
  it("allows Payroll operational edits but not user creation or deletion", () => {
    expect(employeePermissions("manager")).toEqual({ edit: true, create: false, delete: false });
  });
  it("keeps employee HR fields read-only", () => {
    expect(employeePermissions("employee")).toEqual({ edit: false, create: false, delete: false });
  });
  it("keeps fictional employee identities separate from live payroll", () => {
    expect(sampleToFolder(sampleEmployees[0]).source).toBe("sample");
  });
});
describe("employee folder data", () => {
  const valid = { ...emptyEmployee, first_name: "Test", last_name: "Employee", email: "test@example.invalid" };
  it("allows an employee without an email", () => {
    expect(employeeFolderSchema.safeParse({ ...valid, email: "" }).success).toBe(true);
  });
  it("rejects a malformed optional email", () => {
    expect(employeeFolderSchema.safeParse({ ...valid, email: "not-email" }).success).toBe(false);
  });
  it("stores HR additions without changing the account email", () => {
    const update = folderUpdate({ ...valid, emergency_name: "Next of kin", employment_type: "Full-time" });
    expect(update.hr_details.emergency_name).toBe("Next of kin");
    expect(update.hr_details.employment_type).toBe("Full-time");
    expect(update).not.toHaveProperty("email");
  });
  it("rejects malformed dates without throwing", () => {
    expect(employeeFolderSchema.safeParse({ ...valid, date_of_birth: "2026-99-99" }).success).toBe(false);
  });
  it("rejects employment end dates before start", () => {
    expect(employeeFolderSchema.safeParse({ ...valid, start_date: "2026-01-05", contract_end: "2026-01-04" }).success).toBe(false);
  });
  it("rejects negative salary", () => {
    expect(employeeFolderSchema.safeParse({ ...valid, monthly_salary: -1 }).success).toBe(false);
  });
});