// Sample employee data based on uploaded spreadsheet

export interface Employee {
  id: string;
  personId: string;
  firstName: string;
  lastName: string;
  department: string;
  jobTitle: string;
  email: string;
  phone: string;
  startDate: string;
  schedule: string;
  stdHoursPerDay: number;
  otRate: number;
  status: "Active" | "Inactive" | "On Leave";
  nicNumber: string;
  tanNumber: string;
  monthlySalary: number;
}

export const sampleEmployees: Employee[] = [
  { id: "1", personId: "01", firstName: "Jarrel", lastName: "John", department: "Engineering", jobTitle: "Senior Developer", email: "jarrel@company.com", phone: "758-555-0101", startDate: "2023-01-15", schedule: "9-to-5", stdHoursPerDay: 8, otRate: 1.5, status: "Active", nicNumber: "NIC-2023-0001", tanNumber: "TAN-0001", monthlySalary: 5500 },
  { id: "2", personId: "02", firstName: "Lydon", lastName: "Fagan", department: "Engineering", jobTitle: "Designer", email: "lydon@company.com", phone: "758-555-0102", startDate: "2023-03-01", schedule: "9-to-5", stdHoursPerDay: 8, otRate: 1.5, status: "Active", nicNumber: "NIC-2023-0002", tanNumber: "TAN-0002", monthlySalary: 4500 },
  { id: "3", personId: "03", firstName: "Maria", lastName: "Santos", department: "Human Resources", jobTitle: "HR Manager", email: "maria@company.com", phone: "758-555-0103", startDate: "2022-06-01", schedule: "9-to-5", stdHoursPerDay: 8, otRate: 1.75, status: "Active", nicNumber: "NIC-2022-0003", tanNumber: "TAN-0003", monthlySalary: 6000 },
  { id: "4", personId: "04", firstName: "David", lastName: "Chen", department: "Finance", jobTitle: "Accountant", email: "david@company.com", phone: "758-555-0104", startDate: "2024-01-10", schedule: "9-to-5", stdHoursPerDay: 8, otRate: 1.5, status: "Active", nicNumber: "NIC-2024-0004", tanNumber: "TAN-0004", monthlySalary: 4800 },
  { id: "5", personId: "07", firstName: "Tessa", lastName: "Jules", department: "Engineering", jobTitle: "QA Engineer", email: "tessa@company.com", phone: "758-555-0107", startDate: "2023-08-15", schedule: "9-to-5", stdHoursPerDay: 8, otRate: 1.5, status: "Active", nicNumber: "NIC-2023-0007", tanNumber: "TAN-0007", monthlySalary: 3800 },
  { id: "6", personId: "09", firstName: "Danna", lastName: "William", department: "Engineering", jobTitle: "Junior Developer", email: "danna@company.com", phone: "758-555-0109", startDate: "2024-02-01", schedule: "9-to-5", stdHoursPerDay: 8, otRate: 1.5, status: "Active", nicNumber: "NIC-2024-0009", tanNumber: "TAN-0009", monthlySalary: 3200 },
  { id: "7", personId: "15", firstName: "Vernon", lastName: "John", department: "Operations", jobTitle: "Operations Lead", email: "vernon@company.com", phone: "758-555-0115", startDate: "2022-11-01", schedule: "9-to-5", stdHoursPerDay: 8, otRate: 1.5, status: "Active", nicNumber: "NIC-2022-0015", tanNumber: "TAN-0015", monthlySalary: 4200 },
  { id: "8", personId: "16", firstName: "Annill", lastName: "Daniel", department: "Engineering", jobTitle: "DevOps Engineer", email: "annill@company.com", phone: "758-555-0116", startDate: "2024-05-01", schedule: "Flexible", stdHoursPerDay: 8, otRate: 1.5, status: "Active", nicNumber: "NIC-2024-0016", tanNumber: "TAN-0016", monthlySalary: 4000 },
  { id: "9", personId: "20", firstName: "Cecil", lastName: "Bertin", department: "Operations", jobTitle: "Warehouse Manager", email: "cecil@company.com", phone: "758-555-0120", startDate: "2022-03-15", schedule: "9-to-5", stdHoursPerDay: 8, otRate: 1.5, status: "Active", nicNumber: "NIC-2022-0020", tanNumber: "TAN-0020", monthlySalary: 3600 },
  { id: "10", personId: "21", firstName: "Seriah", lastName: "John Fulgence", department: "Marketing", jobTitle: "Content Creator", email: "seriah@company.com", phone: "758-555-0121", startDate: "2023-09-01", schedule: "9-to-5", stdHoursPerDay: 8, otRate: 1.5, status: "Active", nicNumber: "NIC-2023-0021", tanNumber: "TAN-0021", monthlySalary: 3400 },
  { id: "11", personId: "22", firstName: "Christal", lastName: "Henery", department: "Customer Service", jobTitle: "Support Lead", email: "christal@company.com", phone: "758-555-0122", startDate: "2023-04-01", schedule: "9-to-5", stdHoursPerDay: 8, otRate: 1.5, status: "Active", nicNumber: "NIC-2023-0022", tanNumber: "TAN-0022", monthlySalary: 3000 },
  { id: "12", personId: "25", firstName: "Dorna", lastName: "Taylor", department: "Operations", jobTitle: "Logistics Coordinator", email: "dorna@company.com", phone: "758-555-0125", startDate: "2023-07-01", schedule: "Early Shift", stdHoursPerDay: 8, otRate: 1.5, status: "Active", nicNumber: "NIC-2023-0025", tanNumber: "TAN-0025", monthlySalary: 2800 },
];

export interface AttendanceRecord {
  personId: string;
  name: string;
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  totalHours: number | null;
  status: "Complete" | "Missing Out" | "Missing In";
  late: boolean;
  lateMinutes: number;
  otHours: number;
}

export const sampleAttendance: AttendanceRecord[] = [
  { personId: "01", name: "Jarrel John", date: "2026-03-02", clockIn: "08:30", clockOut: "20:39", totalHours: 12.15, status: "Complete", late: false, lateMinutes: 0, otHours: 4.15 },
  { personId: "01", name: "Jarrel John", date: "2026-03-03", clockIn: "08:30", clockOut: "19:04", totalHours: 10.57, status: "Complete", late: false, lateMinutes: 0, otHours: 2.57 },
  { personId: "01", name: "Jarrel John", date: "2026-03-04", clockIn: "08:16", clockOut: null, totalHours: null, status: "Missing Out", late: false, lateMinutes: 0, otHours: 0 },
  { personId: "01", name: "Jarrel John", date: "2026-03-05", clockIn: "08:15", clockOut: "21:45", totalHours: 13.49, status: "Complete", late: false, lateMinutes: 0, otHours: 5.49 },
  { personId: "01", name: "Jarrel John", date: "2026-03-06", clockIn: "07:32", clockOut: "23:29", totalHours: 15.93, status: "Complete", late: false, lateMinutes: 0, otHours: 7.93 },
  { personId: "02", name: "Lydon Fagan", date: "2026-03-02", clockIn: "08:06", clockOut: "20:39", totalHours: 12.54, status: "Complete", late: false, lateMinutes: 0, otHours: 4.54 },
  { personId: "02", name: "Lydon Fagan", date: "2026-03-03", clockIn: "07:58", clockOut: "18:59", totalHours: 11.02, status: "Complete", late: false, lateMinutes: 0, otHours: 3.02 },
  { personId: "02", name: "Lydon Fagan", date: "2026-03-04", clockIn: "11:22", clockOut: "17:00", totalHours: 5.63, status: "Complete", late: true, lateMinutes: 143, otHours: 0 },
  { personId: "02", name: "Lydon Fagan", date: "2026-03-05", clockIn: "08:32", clockOut: "21:45", totalHours: 13.22, status: "Complete", late: false, lateMinutes: 0, otHours: 5.22 },
  { personId: "07", name: "Tessa Jules", date: "2026-03-04", clockIn: "07:57", clockOut: "17:04", totalHours: 9.12, status: "Complete", late: false, lateMinutes: 0, otHours: 1.12 },
  { personId: "07", name: "Tessa Jules", date: "2026-03-05", clockIn: "08:05", clockOut: "17:04", totalHours: 8.99, status: "Complete", late: false, lateMinutes: 0, otHours: 0.99 },
  { personId: "07", name: "Tessa Jules", date: "2026-03-06", clockIn: "07:56", clockOut: "17:11", totalHours: 9.25, status: "Complete", late: false, lateMinutes: 0, otHours: 1.25 },
  { personId: "20", name: "Cecil Bertin", date: "2026-03-02", clockIn: "07:55", clockOut: "18:36", totalHours: 10.68, status: "Complete", late: false, lateMinutes: 0, otHours: 2.68 },
  { personId: "20", name: "Cecil Bertin", date: "2026-03-03", clockIn: "08:14", clockOut: "19:34", totalHours: 11.32, status: "Complete", late: false, lateMinutes: 0, otHours: 3.32 },
  { personId: "20", name: "Cecil Bertin", date: "2026-03-04", clockIn: "07:58", clockOut: "18:37", totalHours: 10.66, status: "Complete", late: false, lateMinutes: 0, otHours: 2.66 },
  { personId: "21", name: "Seriah John Fulgence", date: "2026-03-02", clockIn: "08:44", clockOut: "18:28", totalHours: 9.73, status: "Complete", late: false, lateMinutes: 0, otHours: 1.73 },
  { personId: "21", name: "Seriah John Fulgence", date: "2026-03-03", clockIn: "08:54", clockOut: "18:42", totalHours: 9.79, status: "Complete", late: false, lateMinutes: 0, otHours: 1.79 },
  { personId: "22", name: "Christal Henery", date: "2026-03-02", clockIn: "07:49", clockOut: "18:31", totalHours: 10.7, status: "Complete", late: false, lateMinutes: 0, otHours: 2.7 },
  { personId: "22", name: "Christal Henery", date: "2026-03-04", clockIn: "08:40", clockOut: "18:38", totalHours: 9.97, status: "Complete", late: false, lateMinutes: 0, otHours: 1.97 },
  { personId: "25", name: "Dorna Taylor", date: "2026-03-02", clockIn: "06:59", clockOut: null, totalHours: null, status: "Missing Out", late: false, lateMinutes: 0, otHours: 0 },
  { personId: "25", name: "Dorna Taylor", date: "2026-03-03", clockIn: "07:04", clockOut: "18:20", totalHours: 11.27, status: "Complete", late: false, lateMinutes: 0, otHours: 3.27 },
  { personId: "25", name: "Dorna Taylor", date: "2026-03-04", clockIn: "07:05", clockOut: "17:49", totalHours: 10.73, status: "Complete", late: false, lateMinutes: 0, otHours: 2.73 },
];
