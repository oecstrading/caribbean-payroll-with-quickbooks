import type { PayrollResult } from "@/lib/payroll-engine";

export const departmentName = (department?: string | null) => department?.trim() || "Unassigned";
export function selectDepartments<T extends { department?: string | null }>(rows: T[], departments: string[]) {
  return rows.filter(row => departments.includes(departmentName(row.department)));
}
export interface PayrollReportRow {
  id: string; name: string; department: string; basic: number; overtime: number; gross: number;
  nic: number; employerNIC: number; paye: number; deductions: number; net: number;
}
export function reportRow(id: string, name: string, department: string, payroll: PayrollResult): PayrollReportRow {
  return { id, name, department: departmentName(department), basic: payroll.basicPay, overtime: payroll.overtimePay,
    gross: payroll.grossMonthly, nic: payroll.employeeNIC, employerNIC: payroll.employerNIC,
    paye: payroll.paye, deductions: payroll.totalDeductions, net: payroll.netPay };
}
export function payrollTotals(rows: PayrollReportRow[]) {
  const total = { employees: rows.length, basic: 0, overtime: 0, gross: 0, nic: 0, employerNIC: 0, paye: 0, deductions: 0, net: 0, cost: 0 };
  for (const row of rows) {
    for (const key of ["basic", "overtime", "gross", "nic", "employerNIC", "paye", "deductions", "net"] as const) {
      total[key] = Math.round((total[key] + row[key]) * 100) / 100;
    }
  }
  total.cost = Math.round((total.gross + total.employerNIC) * 100) / 100;
  return total;
}
export function departmentSummaries(rows: PayrollReportRow[]) {
  return [...new Set(rows.map(row => departmentName(row.department)))].sort().map(department => ({
    department, ...payrollTotals(rows.filter(row => departmentName(row.department) === department)),
  }));
}
export function payslipReportRow(slip: {
  id: string; user_id: string; department_snapshot: string | null; employee_name_snapshot: string | null;
  basic_pay: number; overtime_pay: number; gross_pay: number; employee_nic: number; employer_nic: number;
  paye: number; total_deductions: number; net_pay: number;
}): PayrollReportRow {
  return { id: slip.id, name: slip.employee_name_snapshot || slip.user_id.slice(0, 8),
    department: slip.department_snapshot ?? "Not recorded (legacy)", basic: Number(slip.basic_pay), overtime: Number(slip.overtime_pay),
    gross: Number(slip.gross_pay), nic: Number(slip.employee_nic), employerNIC: Number(slip.employer_nic),
    paye: Number(slip.paye), deductions: Number(slip.total_deductions), net: Number(slip.net_pay) };
}