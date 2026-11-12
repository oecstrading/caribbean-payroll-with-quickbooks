import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import StaffDashboard from "@/components/StaffDashboard";

// The employee clock must show hours only: pay belongs on the payslip, never on the clock.
const summary = {
  name: "Loriann Hope", job_title: "Installer", department: "Tinting",
  month_hours: 88.5, days_worked: 12, times_late: 1, missing_punches: 0,
  company: "Smileys Inc", company_phone: "+17581234567", company_email: "admin@smileysincslu.com",
};

afterEach(cleanup);

describe("employee clock shows hours only", () => {
  it("renders worked hours without any earnings amount", () => {
    const { container } = render(<StaffDashboard summary={{ ...summary, estimated_earnings: 4425, hourly_rate: 50 } as never} />);
    expect(screen.getByText("88.50")).toBeTruthy();
    expect(screen.getByText("Hours worked")).toBeTruthy();
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/earn/i);
    expect(text).not.toMatch(/[$]\s?\d/);
    expect(text).not.toMatch(/\d+\s*(XCD|EC\$|\/hr)/i);
  });
});
