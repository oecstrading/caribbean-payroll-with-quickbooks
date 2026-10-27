export function removalAllowed(actor: { id: string; org_id: string | null; admin: boolean; hr: boolean; superAdmin?: boolean; platform?: boolean }, target: { id: string; org_id: string | null; admin: boolean; platform: boolean }) {
  return Boolean(actor.admin && actor.hr && actor.org_id && actor.org_id === target.org_id && actor.id !== target.id && (!target.admin || actor.superAdmin) && (!target.platform || (actor.superAdmin && actor.platform)));
}
export function validRemovalBody(body: unknown): body is { employee_id: string; confirmation: "DELETE" } {
  if (!body || typeof body !== "object") return false;
  const value = body as Record<string, unknown>;
  return typeof value.employee_id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.employee_id) && value.confirmation === "DELETE";
}