import { z } from "zod";
export { industryPacks, makeOnboardingPack, onboardingTemplates, ONBOARDING_COUNTRIES } from "../../supabase/functions/_shared/company-templates";
export const onboardingSchema = z.object({
  version: z.literal(1), industry: z.enum(["general", "construction", "security", "services", "hospitality"]),
  jurisdiction: z.enum(["LC", "AG", "KN", "DM", "GD"]), weekly_hours: z.number().min(1).max(80),
  pay_frequency: z.enum(["weekly", "semi_monthly", "monthly"]), departments: z.array(z.string().trim().min(1).max(80)).min(1).max(20),
  reviewed: z.boolean(), ai_notes: z.string().max(12000),
  work_days: z.array(z.number().int().min(0).max(6)).min(1, "Choose at least one working day").max(7).optional(),
  shift_start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a start time").optional(),
  shift_end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter an end time").optional(),
  break_minutes: z.number().int().min(0).max(240).optional(),
}).strict().refine(v => !v.shift_start || v.shift_start !== v.shift_end, "Start and end hours must differ");