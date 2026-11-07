export type AttendanceDetail = "all" | "on-clock" | "missing" | "late" | "review" | "complete";
type DetailShift = { clock_in: string | null; clock_out: string | null; scheduled_start: string | null; scheduled_end: string | null; approved_hours: number | null };
export function matchesAttendanceDetail(s: DetailShift, filter: AttendanceDetail, now = Date.now()) {
  if (filter === "on-clock") return Boolean(s.clock_in && !s.clock_out);
  if (filter === "complete") return Boolean(s.clock_in && s.clock_out);
  if (filter === "missing") return Boolean(s.scheduled_end && Date.parse(s.scheduled_end) < now && (!s.clock_in || !s.clock_out));
  if (filter === "late") return Boolean(s.clock_in && s.scheduled_start && Date.parse(s.clock_in) > Date.parse(s.scheduled_start) + 300000);
  if (filter === "review") return s.approved_hours === null && (!s.scheduled_end || Date.parse(s.scheduled_end) < now);
  return true;
}