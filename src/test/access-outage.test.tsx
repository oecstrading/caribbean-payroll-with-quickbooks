import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { RoleProvider, useRole } from "@/hooks/useRole";

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "test-user" } }) }));
vi.mock("@/integrations/supabase/client", () => {
  const result = { data: null, error: { message: "Service unavailable" } };
  const chain = { select: () => chain, eq: () => chain, maybeSingle: async () => result, then: (resolve: (value: typeof result) => void) => Promise.resolve(result).then(resolve) };
  return { supabase: { from: () => chain, rpc: async () => result } };
});

function Probe() {
  const access = useRole();
  return <div data-testid="access">{JSON.stringify({ error: access.accessError, loading: access.loading, role: access.role, allowed: access.canAccess("/payroll") })}</div>;
}

describe("Company access during a Cloud outage", () => {
  it("reports failed verification and denies payroll instead of treating errors as missing membership", async () => {
    render(<RoleProvider><Probe /></RoleProvider>);
    await waitFor(() => expect(JSON.parse(screen.getByTestId("access").textContent ?? "{}")).toEqual({ error: true, loading: false, role: null, allowed: false }));
  });
});