export type WorkspaceRole = "admin" | "manager" | "employee";
export const WORKSPACE_MODULES = [
  { id: "hr", label: "Employee folders", group: "People & payroll" },
  { id: "payroll", label: "Payroll, history & deductions", group: "People & payroll" },
  { id: "reports", label: "Payroll reports", group: "People & payroll" },
  { id: "attendance", label: "Time & attendance", group: "People & payroll" },
  { id: "leave", label: "Leave approvals", group: "People & payroll" },
  { id: "recruitment", label: "Applicant tracking", group: "People & payroll" },
  { id: "field", label: "Projects, crews & equipment", group: "Operations" },
  { id: "security", label: "Guard tours & security operations", group: "Operations" },
  { id: "billing", label: "Contractors & client invoicing", group: "Operations" },
  { id: "training", label: "Training Hub", group: "Workspace" },
  { id: "quickbooks", label: "QuickBooks & account mapping", group: "Workspace" },
  { id: "settings", label: "Company settings", group: "Workspace" },
] as const;
export type WorkspaceModule = typeof WORKSPACE_MODULES[number]["id"];
export const EMPLOYEE_MODULES: WorkspaceModule[] = ["attendance", "field", "security", "training"];
export function roleModules(role: WorkspaceRole | null): WorkspaceModule[] {
  if (!role) return [];
  return role === "employee" ? EMPLOYEE_MODULES : WORKSPACE_MODULES.map(m => m.id);
}
export const ROUTE_MODULES: Record<string, WorkspaceModule | "home" | "portal" | "users"> = {
  "/": "home", "/portal": "portal", "/payslips": "portal", "/users": "users",
  "/employees": "hr", "/payroll": "payroll", "/ai-paymaster": "payroll", "/payroll-history": "payroll", "/deductions": "payroll",
  "/reports": "reports", "/attendance": "attendance", "/geofencing": "security", "/leave-management": "leave",
  "/projects": "field", "/equipment": "field", "/daily-reports": "field", "/crews": "field",
  "/contractors": "billing", "/project-profitability": "billing", "/invoicing": "billing",
  "/sites": "security", "/guard-tour": "security", "/incidents": "security", "/command-center": "security",
  "/violations": "security", "/roster": "security", "/late-clockin-report": "security",
  "/compliance": "security", "/guard-performance": "security", "/applicants": "recruitment",
  "/training": "training", "/quickbooks": "quickbooks", "/payroll-settings": "quickbooks", "/settings": "settings",
};
const EMPLOYEE_ROUTES = new Set(["/", "/portal", "/payslips", "/attendance", "/projects", "/equipment", "/daily-reports", "/crews", "/guard-tour", "/incidents", "/training"]);
export function canOpenPath(role: WorkspaceRole | null, modules: readonly string[], path: string, companyModules: readonly string[] = WORKSPACE_MODULES.map(m => m.id), clockEnabled = false): boolean {
  const module = ROUTE_MODULES[path];
  if (!role || !module) return false;
  if (path === "/attendance" && clockEnabled && companyModules.includes("attendance")) return true;
  if (!["home", "portal", "users"].includes(module) && !companyModules.includes(module)) return false;
  if (role === "admin") return true;
  if (module === "users") return false;
  if (role === "employee" && !EMPLOYEE_ROUTES.has(path)) return false;
  return module === "home" || module === "portal" || modules.includes(module);
}