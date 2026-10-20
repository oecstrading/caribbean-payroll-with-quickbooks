import { describe, expect, it } from "vitest";
import { departmentSummaries, payrollTotals, selectDepartments, payslipReportRow, type PayrollReportRow } from "@/lib/department-payroll";
const rows: PayrollReportRow[] = ["Tinting", "Administration", "Sales"].map((department, index) => ({
  id: String(index), name: `Employee ${index}`, department, basic: 1000, overtime: 0, gross: 1000,
  nic: 50, employerNIC: 50, paye: 100, deductions: 150, net: 850,
}));
describe("department payroll", () => {
  it("allows payroll for one department", () => expect(selectDepartments(rows, ["Tinting"]).map(r => r.id)).toEqual(["0"]));
  it("allows payroll for two departments", () => expect(selectDepartments(rows, ["Tinting", "Sales"]).map(r => r.id)).toEqual(["0", "2"]));
  it("allows any number of departments without duplicating employees", () => {
    const many = Array.from({ length: 25 }, (_, i) => ({ ...rows[0], id: String(i), department: `Dept ${i}` }));
    expect(selectDepartments(many, [...many.map(r => r.department), "Dept 0"])).toHaveLength(25);
  });
  it("does not treat an empty selection as all departments", () => expect(selectDepartments(rows, [])).toEqual([]));
  it("generates departmental totals", () => {
    expect(departmentSummaries([...rows, { ...rows[0], id: "extra" }]).find(s => s.department === "Tinting")).toMatchObject({ employees: 2, gross: 2000, deductions: 300, net: 1700, cost: 2100 });
  });
  it("consolidates only selected departments", () => {
    expect(payrollTotals(selectDepartments(rows, ["Tinting", "Sales"]))).toMatchObject({ employees: 2, gross: 2000, deductions: 300, net: 1700, employerNIC: 100, cost: 2100 });
  });
  it("retains the department at approval for historical reports", () => {
    expect(payslipReportRow({ id: "1", user_id: "user", department_snapshot: "Tinting", employee_name_snapshot: "Marcus Charles", basic_pay: 1000, overtime_pay: 0, gross_pay: 1000, employee_nic: 50, employer_nic: 50, paye: 100, total_deductions: 150, net_pay: 850 }).department).toBe("Tinting");
  });
});