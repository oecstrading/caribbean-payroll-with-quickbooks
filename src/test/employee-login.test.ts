import { describe, expect, it } from "vitest";
import { employeeLoginSchema, emptyEmployeeLogin } from "@/lib/employee-login";
describe("employee login setup", () => {
  it("keeps employment possible without a login", () => expect(employeeLoginSchema.safeParse(emptyEmployeeLogin).success).toBe(true));
  it("requires credentials when login is enabled", () => expect(employeeLoginSchema.safeParse({ ...emptyEmployeeLogin, enabled: true }).success).toBe(false));
  it("allows email invitation with employee-chosen password", () => expect(employeeLoginSchema.safeParse({ ...emptyEmployeeLogin, enabled: true, email: "staff@example.com" }).success).toBe(true));
  it("allows username and PIN without email", () => expect(employeeLoginSchema.safeParse({ ...emptyEmployeeLogin, enabled: true, username: "technician.one", pin: "482931" }).success).toBe(true));
});