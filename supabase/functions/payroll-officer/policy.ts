export function mayReviewPayroll(roles: string[]): boolean {
  return roles.some(role => role === "admin" || role === "manager");
}

export const REVIEW_LIMITATIONS = "Advisory draft only. Payroll uses saved monthly-equivalent salaries and period factors, not actual attendance hours. Custom ranges count Monday-Friday without excluding public holidays. One-off additions are included in full based on the start month. Overtime is not automatically calculated in this run. No current statutory-rate certification, severance entitlement, banking transfer, email delivery or production QuickBooks posting is verified. AI cannot approve, save, change amounts or pay staff. Overlap validation runs only when the manager submits approval.";