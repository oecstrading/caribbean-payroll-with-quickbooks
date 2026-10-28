import { z } from "zod";

export const employeeLoginSchema = z.object({
  enabled: z.boolean(),
  email: z.union([z.literal(""), z.string().trim().email().max(255)]),
  username: z.union([z.literal(""), z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9_.-]{2,39}$/)]),
  pin: z.union([z.literal(""), z.string().regex(/^\d{4,6}$/)]),
}).superRefine((v, ctx) => {
  if (v.enabled && !v.email && (!v.username || !v.pin)) ctx.addIssue({ code: "custom", message: "Enter a login email or a username and 4–6 digit PIN" });
});
export type EmployeeLogin = z.infer<typeof employeeLoginSchema>;
export const emptyEmployeeLogin: EmployeeLogin = { enabled: false, email: "", username: "", pin: "" };