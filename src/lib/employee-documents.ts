import { z } from "zod";

export const documentSchema = z.object({
  title: z.string().trim().min(1, "Document title is required").max(150),
  category: z.enum(["Contract", "Certification", "Other HR"]),
  expiry_date: z.string().refine(v => !v || (/^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(new Date(v).getTime()) && new Date(v).toISOString().slice(0, 10) === v), "Invalid expiry date"),
  employee_visible: z.boolean(),
});
export function documentExpiry(expiry: string | null, today = new Date().toISOString().slice(0, 10)) {
  if (!expiry) return "No expiry";
  if (expiry < today) return "Expired";
  const days = (Date.parse(expiry) - Date.parse(today)) / 86400000;
  return days <= 30 ? "Expiring soon" : "Valid";
}
export function canReadDocument(role: string | null, employee: string, viewer: string | undefined, shared: boolean) {
  return role === "admin" || role === "manager" || (shared && Boolean(viewer) && employee === viewer);
}
export function validateDocumentFile(file: File) {
  if (!file.size || file.size > 20 * 1024 * 1024) throw new Error("Choose a non-empty file up to 20 MB");
  if (file.name.length > 255 || !/\.(pdf|docx?|xlsx?|txt|png|jpe?g)$/i.test(file.name)) throw new Error("Choose PDF, Word, Excel, text, PNG or JPEG files");
}