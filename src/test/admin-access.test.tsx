import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RoleProvider, useRole } from "@/hooks/useRole";

const mocks = vi.hoisted(() => ({ role: "admin", user: { id: "google-user" } }));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: mocks.user, session: null }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: async (fn: string) => {
      if (fn === "my_workspace_access") return { data: { roles: [mocks.role], modules: null, jurisdiction: "LC" }, error: null };
      if (fn === "company_configuration") return { data: { modules: ["hr", "payroll", "attendance", "settings"], demo_mode: false }, error: null };
      if (fn === "administrator_authority") return { data: { company_super_admin: false, platform_super_admin: false }, error: null };
      if (fn === "has_employee_clock_access") return { data: false, error: null };
      return { data: null, error: null };
    },
  },
}));

function AccessProbe() {
  const access = useRole();
  return <output data-testid="access">{JSON.stringify(access)}</output>;
}
afterEach(cleanup);

describe("administrator access after Google authentication", () => {
  it("retains full administrator and manager access for a server-assigned admin", async () => {
    mocks.role = "admin";
    render(<RoleProvider><AccessProbe /></RoleProvider>);
    await waitFor(() => {
      const access = JSON.parse(screen.getByTestId("access").textContent || "{}");
      expect(access.loading).toBe(false);
      expect(access.isAdmin).toBe(true);
      expect(access.isAdminOrManager).toBe(true);
      expect(access.isGuard).toBe(false);
    });
  });
  it("does not grant administrator access to an ordinary Google user", async () => {
    mocks.role = "employee";
    render(<RoleProvider><AccessProbe /></RoleProvider>);
    await waitFor(() => {
      const access = JSON.parse(screen.getByTestId("access").textContent || "{}");
      expect(access.loading).toBe(false);
      expect(access.isAdmin).toBe(false);
      expect(access.isAdminOrManager).toBe(false);
    });
  });
});