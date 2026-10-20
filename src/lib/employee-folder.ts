import { z } from "zod";
import type { Employee } from "./sample-data";
import type { Database } from "@/integrations/supabase/types";

const text = z.string().trim().max(100);
const date = z.string().refine((value) => !value || (/^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(value).toISOString().slice(0, 10) === value), "Enter a valid date");
export const employeeFolderSchema = z.object({
  first_name: text.min(1, "First name is required"), last_name: text.min(1, "Last name is required"),
  email: z.string().trim().email("Enter a valid work email").max(255), phone: z.string().trim().max(40),
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
  termination_reason: z.string().trim().max(500), pay_frequency: z.enum(["", "Monthly", "Fortnightly", "Weekly"]),
  notes: z.string().trim().max(2000),
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
export type FolderProfile = Database["public"]["Tables"]["profiles"]["Row"];
export interface EmployeeFolder { id: string; source: "live" | "sample"; deletedAt: string | null; values: EmployeeForm }
export function employeePermissions(role: string | null) {
  return { edit: role === "admin" || role === "manager", create: role === "admin", delete: role === "admin" };
}
export const emptyEmployee: EmployeeForm = {
  first_name: "", last_name: "", email: "", phone: "", person_id: "", department: "", job_title: "", nic_number: "", tan_number: "",
  start_date: "", schedule: "", jurisdiction: "LC", monthly_salary: 0, std_hours_per_day: 8, ot_rate: 1.5, status: "Active",
  date_of_birth: "", gender: "", marital_status: "", nationality: "", address: "", city: "", country: "", personal_email: "",
  emergency_name: "", emergency_relationship: "", emergency_phone: "", employment_type: "", work_location: "", supervisor: "",
  probation_end: "", contract_end: "", termination_date: "", termination_reason: "", pay_frequency: "", notes: "",
};
export const hrKeys = ["date_of_birth", "gender", "marital_status", "nationality", "address", "city", "country", "personal_email", "emergency_name", "emergency_relationship", "emergency_phone", "employment_type", "work_location", "supervisor", "probation_end", "contract_end", "termination_date", "termination_reason", "pay_frequency", "notes"] as const;
export function profileToFolder(profile: FolderProfile): EmployeeFolder {
  const details = typeof profile.hr_details === "object" && profile.hr_details && !Array.isArray(profile.hr_details) ? profile.hr_details : {};
  const values = { ...emptyEmployee };
  for (const key of hrKeys) if (typeof details[key] === "string") values[key] = details[key];
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
    monthly_salary: values.monthly_salary, std_hours_per_day: values.std_hours_per_day, ot_rate: values.ot_rate, status: values.status, hr_details,
  };
}