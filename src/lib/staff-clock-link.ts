// Staff links must always use the published address: preview addresses require a Lovable sign-in.
export const PUBLISHED_URL = "https://caribbean-payroll-with-quickbooks.lovable.app";

export function staffClockLink(org: string, employeeCode?: string) {
  const base = `${PUBLISHED_URL}/time-clock/${org}`;
  return employeeCode ? `${base}?code=${encodeURIComponent(employeeCode)}` : base;
}

const storageKey = (org: string) => `staff-clock-code:${org}`;
export function rememberedClockCode(org: string) {
  try { return localStorage.getItem(storageKey(org)) ?? ""; } catch { return ""; }
}
export function rememberClockCode(org: string, code: string) {
  try { localStorage.setItem(storageKey(org), code); } catch { /* private mode */ }
}
