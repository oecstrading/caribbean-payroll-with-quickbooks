interface ReviewEmployee {
  department: string; nicNumber: string; tanNumber: string;
  compliance: { compliant: boolean };
  payroll: { basicPay: number; grossMonthly: number; employeeNIC: number; employerNIC: number; paye: number; totalDeductions: number; totalAdditions: number; netPay: number };
}
/** Only amounts and anonymous row references leave the browser; no personal identifiers. */
export function anonymousReviewRows(employees: ReviewEmployee[]) {
  const departments = [...new Set(employees.map(e => e.department))];
  return employees.map((e, index) => ({ reference: `Employee ${index + 1}`, department: `Department ${departments.indexOf(e.department) + 1}`,
    basic: e.payroll.basicPay, gross: e.payroll.grossMonthly, nic: e.payroll.employeeNIC, employerNic: e.payroll.employerNIC,
    paye: e.payroll.paye, deductions: e.payroll.totalDeductions, additions: e.payroll.totalAdditions, net: e.payroll.netPay,
    minimumWageFlag: !e.compliance.compliant, missingNic: !e.nicNumber.trim(), missingTan: !e.tanNumber.trim(),
  }));
}