// Pairs clock punches into shifts across midnight. A shift belongs to the day and site of its clock-in.
export type RosterPunch = { user_id: string; punched_at: string; punch_type: string; site_id?: string | null };
export type RosterShift = { user_id: string; site_id: string | null; start: Date; end: Date; hours: number };

const MAX_SHIFT_H = 24;

export function pairShifts(punches: RosterPunch[]): RosterShift[] {
  const byUser = new Map<string, RosterPunch[]>();
  for (const p of punches) byUser.set(p.user_id, [...(byUser.get(p.user_id) ?? []), p]);
  const shifts: RosterShift[] = [];
  for (const [user, list] of byUser) {
    list.sort((a, b) => a.punched_at.localeCompare(b.punched_at));
    let open: RosterPunch | null = null;
    for (const p of list) {
      if (p.punch_type === "clock_in") open = p;
      else if (p.punch_type === "clock_out" && open) {
        const start = new Date(open.punched_at), end = new Date(p.punched_at);
        const hours = (end.getTime() - start.getTime()) / 3_600_000;
        if (hours > 0 && hours <= MAX_SHIFT_H) shifts.push({ user_id: user, site_id: open.site_id ?? p.site_id ?? null, start, end, hours });
        open = null;
      }
    }
  }
  return shifts;
}

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** Hours for one guard on one day. With a site, only shifts at that site (or with no site recorded) count. */
export function hoursOn(shifts: RosterShift[], userId: string, date: Date, siteId?: string) {
  return shifts
    .filter((s) => s.user_id === userId && sameDay(s.start, date) && (!siteId || s.site_id === siteId || s.site_id === null))
    .reduce((t, s) => t + s.hours, 0);
}
