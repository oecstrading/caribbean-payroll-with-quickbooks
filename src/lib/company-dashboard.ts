import { supabase } from '@/integrations/supabase/client';

export type CompanySummary = {
  id: string; name: string; employees: number | null; active_employees: number | null;
  monthly_salaries: number | null; gross: number | null; net: number | null; deductions: number | null;
  period: string | null; period_start: string | null; period_end: string | null; currency: string;
  on_clock: number | null; open_alerts: number | null; late_arrivals: number | null; pending_runs: number | null;
};

export async function loadCompanySummaries(all = false): Promise<CompanySummary[]> {
  const { data, error } = await supabase.rpc('company_dashboard_summaries', { _all: all });
  if (error) throw error;
  return (data ?? []) as unknown as CompanySummary[];
}

/** Monetary totals stay separated by currency; null means this metric is not authorized. */
export function consolidateCompanies(rows: CompanySummary[]) {
  const sum = (key: 'employees' | 'active_employees' | 'on_clock' | 'open_alerts' | 'pending_runs') =>
    rows.reduce((total, row) => total + Number(row[key] ?? 0), 0);
  const currencies = new Map<string, { currency: string; monthly: number; gross: number; net: number; deductions: number }>();
  for (const row of rows) {
    if (row.monthly_salaries === null && row.gross === null) continue;
    const group = currencies.get(row.currency) ?? { currency: row.currency, monthly: 0, gross: 0, net: 0, deductions: 0 };
    group.monthly += Number(row.monthly_salaries ?? 0);
    group.gross += Number(row.gross ?? 0); group.net += Number(row.net ?? 0); group.deductions += Number(row.deductions ?? 0);
    currencies.set(row.currency, group);
  }
  return { employees: sum('employees'), active: sum('active_employees'), onClock: sum('on_clock'), alerts: sum('open_alerts'), pending: sum('pending_runs'), currencies: [...currencies.values()] };
}

export function dashboardMoney(value: number | null, currency: string) {
  return value === null ? '—' : `${currency} ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}