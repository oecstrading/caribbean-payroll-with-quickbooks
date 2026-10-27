import { z } from "npm:zod@3.25.76";
export const usernameSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9_.-]{2,39}$/, "Username must be 3–40 letters, digits, dots, underscores or hyphens");
export const accountSchema = z.object({
  action: z.enum(["create", "update", "resend"]).default("create"),
  user_id: z.string().uuid().optional(),
  email: z.union([z.literal(""), z.string().trim().toLowerCase().email().max(255)]).default(""),
  username: z.union([z.literal(""), usernameSchema]).default(""),
  pin: z.union([z.literal(""), z.string().regex(/^\d{4,6}$/)]).default(""),
  first_name: z.string().trim().max(100).default(""), last_name: z.string().trim().max(100).default(""),
  phone: z.string().trim().max(40).default(""), department: z.string().trim().max(100).default(""),
  job_title: z.string().trim().max(100).default(""), role: z.enum(["admin", "manager", "employee"]).default("employee"),
  is_employee: z.boolean().default(true),
}).superRefine((v, ctx) => {
  if (v.action === "create" && !v.email && (!v.username || !v.pin)) ctx.addIssue({ code: "custom", message: "Email or username and PIN are required" });
  if (v.action !== "create" && !v.user_id) ctx.addIssue({ code: "custom", message: "Select a user" });
});
export function mayManageAccount(callerRole: string, sameCompany: boolean, targetAdmin: boolean, companySuper: boolean, targetPlatform: boolean, platformSuper: boolean) {
  return callerRole === "admin" && sameCompany && (!targetAdmin || companySuper) && (!targetPlatform || platformSuper);
}
export const personalFields = ["date_of_birth", "gender", "marital_status", "nationality", "address", "city", "country", "personal_email", "emergency_name", "emergency_relationship", "emergency_phone"] as const;
export const personalSchema = z.object(Object.fromEntries(personalFields.map(k => [k, k === "date_of_birth" ? z.string().refine(v => !v || (/^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v && v <= new Date().toISOString().slice(0,10)), "Invalid birth date") : k === "personal_email" ? z.union([z.literal(""), z.string().email().max(100)]) : z.string().trim().max(k === "address" ? 500 : 100)]))).strict();