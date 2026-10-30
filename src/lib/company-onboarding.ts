import { z } from "zod";
export { industryPacks, makeOnboardingPack, onboardingTemplates, ONBOARDING_COUNTRIES } from "../../supabase/functions/_shared/company-templates";
export const onboardingSchema = z.object({
  version: z.literal(1), industry: z.enum(["general", "construction", "security", "services"]),
  jurisdiction: z.enum(["LC", "AG", "KN", "DM", "GD"]), weekly_hours: z.number().min(1).max(80),
  pay_frequency: z.enum(["weekly", "semi_monthly", "monthly"]), departments: z.array(z.string().trim().min(1).max(80)).min(1).max(20),
  reviewed: z.boolean(), ai_notes: z.string().max(12000),
}).strict();