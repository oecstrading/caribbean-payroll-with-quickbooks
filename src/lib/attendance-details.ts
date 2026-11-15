export type AttendanceDetail = "all" | "on-clock" | "missing" | "late" | "review" | "complete";
export type Confirmation = { approved_hours?: number | null; reviewed_at?: string | null; review_status?: string | null };
export function attendanceConfirmed(s: Confirmation) {
  return s.approved_hours != null || s.reviewed_at != null || s.review_status === "reviewed";
}
export function unconfirmedMissingPunch(s: Confirmation & { clock_in: string | null; clock_out: string | null }) {
  return !attendanceConfirmed(s);
}
export function manuallyConfirmed(s: Confirmation) {
  return s.reviewed_at != null || s.review_status === "reviewed";
}
type DetailShift = Confirmation & { clock_in: string | null; clock_out: string | null; scheduled_start: string | null; scheduled_end: string | null; approved_hours: number | null };
export function matchesAttendanceDetail(s: DetailShift, filter: AttendanceDetail, now = Date.now()) {
  if (filter === "on-clock") return Boolean(s.clock_in && !s.clock_out && !attendanceConfirmed(s));
  if (filter === "complete") return attendanceConfirmed(s);
  if (filter === "missing") return Boolean(s.scheduled_end && Date.parse(s.scheduled_end) < now && unconfirmedMissingPunch(s));
  if (filter === "late") return Boolean(s.clock_in && s.scheduled_start && Date.parse(s.clock_in) > Date.parse(s.scheduled_start) + 300000);
  if (filter === "review") return !attendanceConfirmed(s) && (!s.scheduled_end || Date.parse(s.scheduled_end) < now);
  return true;
}