import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), canAccess: vi.fn(() => false) }));
vi.mock("@/hooks/useRole", () => ({ useRole: () => ({ canAccess: mocks.canAccess }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: mocks.rpc } }));
vi.mock("@/components/ClockActivityReport", () => ({ default: () => null }));
vi.mock("@/components/BulkClockActivation", () => ({ default: () => null }));
vi.mock("@/components/BulkEmployeeClockActivation", () => ({ default: () => null }));
vi.mock("@/components/ClockRepairDialog", () => ({ default: () => null }));
import ClockMonitoringCenter from "@/components/ClockMonitoringCenter";

describe("Monitoring Center authority", () => {
  it("does not render or request clock records without administrator/Pay Master clock access", () => {
    const view = render(<MemoryRouter><ClockMonitoringCenter /></MemoryRouter>);
    expect(view.container.textContent).toBe("");
    expect(mocks.canAccess).toHaveBeenCalledWith("/clock-devices");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});