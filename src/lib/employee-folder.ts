import { z } from "zod";
import type { Employee } from "./sample-data";
import type { Database } from "@/integrations/supabase/types";

const text = z.string().trim().max(100);
const date = z.string().refine((value) => !value || (/^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(new Date(value).getTime()) && new Date(value).toISOString().slice(0, 10) === value), "Enter a valid date");
export const employeeFolderSchema = z.object({
  first_name: text.min(1, "First name is required"), last_name: text.min(1, "Last name is required"),
  email: z.string().trim().max(255).refine(v => !v || z.string().email().safeParse(v).success, "Enter a valid work email"), phone: z.string().trim().max(40),
  person_id: text, department: text, job_title: text, nic_number: text, tan_number: text,
  start_date: date, schedule: text, jurisdiction: text.min(1),
  monthly_salary: z.coerce.number().finite().min(0), std_hours_per_day: z.coerce.number().min(0).max(24),
  ot_rate: z.coerce.number().min(0).max(10), status: z.enum(["Active", "Inactive", "On Leave"]),
  date_of_birth: date, gender: text, marital_status: text, nationality: text,
  address: z.string().trim().max(500), city: text, country: text,
  personal_email: z.union([z.literal(""), z.string().trim().email().max(100)]),
  emergency_name: text, emergency_relationship: text, emergency_phone: z.string().trim().max(40),
  employment_type: z.enum(["", "Full-time", "Part-time", "Contract", "Temporary", "Intern"]),
  work_location: text, supervisor: text, probation_end: date, contract_end: date, termination_date: date,
  termination_reason: z.string().trim().max(500), pay_frequency: z.enum(["", "Monthly", "Semi-monthly", "Fortnightly", "Weekly", "Daily", "Hourly"]),
  pay_rate: z.string().trim().refine(v => !v || /^\d{1,9}(\.\d{1,2})?$/.test(v), "Enter a rate like 1250 or 18.50"),
  weekly_hours: z.string().trim().refine(v => !v || (/^\d{1,3}(\.\d{1,2})?$/.test(v) && Number(v) <= 168), "Enter hours like 40 or 37.5"),
  notes: z.string().trim().max(2000),
  tax_code: z.string().trim().max(12).refine(v => !v || /^[0-9]{1,4}[A-Z]{0,2}$/i.test(v), "Enter a tax code like 264M"),
  paye_method: z.enum(["", "Calculated", "Fixed amount"]),
  paye_fixed_amount: z.string().trim().refine(v => !v || /^\d{1,9}(\.\d{1,2})?$/.test(v), "Enter an amount like 133.13"),
  nic_basis: z.enum(["", "Total pay", "Basic pay"]),
  daily_rate_rule: z.enum(["", "Monthly × 12 ÷ 52 ÷ 5", "Fixed daily rate"]),
  fixed_daily_rate: z.string().trim().refine(v => !v || /^\d{1,7}(\.\d{1,2})?$/.test(v), "Enter a rate like 69.23"),
  staff_group: z.enum(["", "Staff", "Management", "Director", "Casual"]),
  cost_centre_code: z.string().trim().max(20),
  bank_name: z.string().trim().max(120),
  bank_branch: z.string().trim().max(120),
  bank_account_number: z.string().trim().max(40),
  bank_account_type: z.enum(["", "Savings", "Current", "Cheque"]),
}).superRefine((values, context) => {
  if (values.date_of_birth && values.date_of_birth > new Date().toISOString().slice(0, 10)) {
    context.addIssue({ code: "custom", path: ["date_of_birth"], message: "Date of birth cannot be in the future" });
  }
  for (const key of ["probation_end", "contract_end", "termination_date"] as const) {
    if (values.start_date && values[key] && values[key] < values.start_date) {
      context.addIssue({ code: "custom", path: [key], message: "Must be on or after the start date" });
    }
  }
});
export type EmployeeForm = z.infer<typeof employeeFolderSchema>;
export type FolderProfile = Omit<Database["public"]["Tables"]["profiles"]["Row"], "is_employee" | "login_username">;
export interface EmployeeFolder { id: string; source: "live" | "sample"; accountLinked?: boolean; loginUserId?: string | null; deletedAt: string | null; values: EmployeeForm }
export function employeePermissions(role: string | null) {
  return { edit: role === "admin" || role === "manager", create: role === "admin", delete: role === "admin" };
}
export const emptyEmployee: EmployeeForm = {
  first_name: "", last_name: "", email: "", phone: "", person_id: "", department: "", job_title: "", nic_number: "", tan_number: "",
  start_date: "", schedule: "", jurisdiction: "LC", monthly_salary: 0, std_hours_per_day: 8, ot_rate: 1.5, status: "Active",
  date_of_birth: "", gender: "", marital_status: "", nationality: "", address: "", city: "", country: "", personal_email: "",
  emergency_name: "", emergency_relationship: "", emergency_phone: "", employment_type: "", work_location: "", supervisor: "",
  probation_end: "", contract_end: "", termination_date: "", termination_reason: "", pay_frequency: "", pay_rate: "", weekly_hours: "", notes: "",
  tax_code: "", paye_method: "", paye_fixed_amount: "", nic_basis: "", daily_rate_rule: "", fixed_daily_rate: "", staff_group: "", cost_centre_code: "",
  bank_name: "", bank_branch: "", bank_account_number: "", bank_account_type: "",
};
export const hrKeys = ["date_of_birth", "gender", "marital_status", "nationality", "address", "city", "country", "personal_email", "emergency_name", "emergency_relationship", "emergency_phone", "employment_type", "work_location", "supervisor", "probation_end", "contract_end", "termination_date", "termination_reason", "pay_frequency", "pay_rate", "weekly_hours", "notes", "tax_code", "paye_method", "paye_fixed_amount", "nic_basis", "daily_rate_rule", "fixed_daily_rate", "staff_group", "cost_centre_code", "bank_name", "bank_branch", "bank_account_number", "bank_account_type"] as const;
export const payBases = ["Monthly", "Semi-monthly", "Weekly", "Daily", "Hourly"] as const;
export const rateLabels: Record<string, string> = { Monthly: "Monthly rate", "Semi-monthly": "Rate per semi-monthly pay", Fortnightly: "Rate per fortnight", Weekly: "Weekly rate", Daily: "Daily rate", Hourly: "Hourly rate" };
/** Monthly hours = weekly hours × 52 ÷ 12 (falls back to daily hours × 5 days). */
export function monthlyHours(weeklyHours: number, hoursPerDay: number): number {
  const week = weeklyHours > 0 ? weeklyHours : hoursPerDay * 5;
  return Math.round(week * 52 / 12 * 100) / 100;
}
/** Monthly equivalent over 52 weeks a year. Hourly pay uses the employee's weekly hours; daily pay uses days per week (weekly hours ÷ daily hours). */
export function monthlyEquivalent(basis: string, rate: number, hoursPerDay: number, weeklyHours = 0): number {
  const week = weeklyHours > 0 ? weeklyHours : hoursPerDay * 5;
  const daysPerWeek = weeklyHours > 0 && hoursPerDay > 0 ? weeklyHours / hoursPerDay : 5;
  const factor: Record<string, number> = { Monthly: 1, "Semi-monthly": 2, Fortnightly: 26 / 12, Weekly: 52 / 12, Daily: daysPerWeek * 52 / 12, Hourly: week * 52 / 12 };
  return factor[basis] === undefined || !Number.isFinite(rate) ? NaN : Math.round(rate * factor[basis] * 100) / 100;
}
export function effectiveMonthlySalary(values: EmployeeForm): number {
  const m = values.pay_frequency && values.pay_rate ? monthlyEquivalent(values.pay_frequency, Number(values.pay_rate), Number(values.std_hours_per_day) || 0, Number(values.weekly_hours) || 0) : NaN;
  return Number.isFinite(m) ? m : Number(values.monthly_salary) || 0;
}
export function profileToFolder(profile: FolderProfile): EmployeeFolder {
  const details = typeof profile.hr_details === "object" && profile.hr_details && !Array.isArray(profile.hr_details) ? profile.hr_details : {};
  const values = { ...emptyEmployee };
  for (const key of hrKeys) if (typeof details[key] === "string") Object.assign(values, { [key]: details[key] });
  return { id: profile.user_id, source: "live", deletedAt: profile.deleted_at, values: {
    ...values, first_name: profile.first_name, last_name: profile.last_name, email: profile.email,
    phone: profile.phone || "", person_id: profile.person_id || "", department: profile.department || "", job_title: profile.job_title || "",
    nic_number: profile.nic_number || "", tan_number: profile.tan_number || "", start_date: profile.start_date || "", schedule: profile.schedule || "",
    jurisdiction: profile.jurisdiction, monthly_salary: Number(profile.monthly_salary || 0), std_hours_per_day: Number(profile.std_hours_per_day ?? 8),
    ot_rate: Number(profile.ot_rate ?? 1.5), status: profile.status === "Inactive" || profile.status === "On Leave" ? profile.status : "Active",
  } };
}
export function sampleToFolder(employee: Employee): EmployeeFolder {
  return { id: employee.id, source: "sample", deletedAt: null, values: { ...emptyEmployee,
    first_name: employee.firstName, last_name: employee.lastName, email: employee.email, phone: employee.phone,
    person_id: employee.personId, department: employee.department, job_title: employee.jobTitle, nic_number: employee.nicNumber,
    tan_number: employee.tanNumber, monthly_salary: employee.monthlySalary, start_date: employee.startDate,
    schedule: employee.schedule, std_hours_per_day: employee.stdHoursPerDay, ot_rate: employee.otRate, status: employee.status,
  } };
}
export function folderUpdate(values: EmployeeForm) {
  const hr_details: Record<string, string> = {};
  for (const key of hrKeys) hr_details[key] = values[key];
  return {
    first_name: values.first_name, last_name: values.last_name, phone: values.phone, person_id: values.person_id,
    department: values.department, job_title: values.job_title, nic_number: values.nic_number, tan_number: values.tan_number,
    start_date: values.start_date || null, schedule: values.schedule, jurisdiction: values.jurisdiction,
    monthly_salary: effectiveMonthlySalary(values), std_hours_per_day: values.std_hours_per_day, ot_rate: values.ot_rate, status: values.status, hr_details,
  };
}
/** Per-employee payroll options read from saved HR details; blank values keep the standard platform behaviour. */
export function payrollOptions(details: unknown): { nicBasis: "gross" | "basic"; fixedPaye: number | null } {
  const hr = (details && typeof details === "object" && !Array.isArray(details) ? details : {}) as Record<string, unknown>;
  const fixed = hr.paye_method === "Fixed amount" && typeof hr.paye_fixed_amount === "string" && hr.paye_fixed_amount !== "" ? Number(hr.paye_fixed_amount) : NaN;
  return { nicBasis: hr.nic_basis === "Basic pay" ? "basic" : "gross", fixedPaye: Number.isFinite(fixed) ? fixed : null };
}
