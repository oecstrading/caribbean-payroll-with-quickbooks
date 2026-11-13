// Labour cost from approved payroll: each payslip's gross + employer NIC is split across the
// projects the employee logged hours on during that payroll period, in proportion to the hours.
export type TimeLog = { project_id: string; user_id: string | null; log_date: string; hours: number };
export type ApprovedSlip = { user_id: string | null; gross_pay: number; employer_nic: number; period_start: string; period_end: string };

export function allocateLabor(logs: TimeLog[], slips: ApprovedSlip[]) {
  const cost: Record<string, number> = {};
  const unpaidHours: Record<string, number> = {};
  const slipFor = (l: TimeLog) => slips.find((s) => s.user_id === l.user_id && l.log_date >= s.period_start && l.log_date <= s.period_end);
  const totals = new Map<ApprovedSlip, number>();
  for (const l of logs) { const s = slipFor(l); if (s) totals.set(s, (totals.get(s) ?? 0) + Number(l.hours)); }
  for (const l of logs) {
    const s = slipFor(l), h = Number(l.hours);
    const total = s ? totals.get(s) ?? 0 : 0;
    if (!s || total <= 0) { unpaidHours[l.project_id] = (unpaidHours[l.project_id] ?? 0) + h; continue; }
    cost[l.project_id] = (cost[l.project_id] ?? 0) + (Number(s.gross_pay) + Number(s.employer_nic || 0)) * (h / total);
  }
  return { cost, unpaidHours };
}
