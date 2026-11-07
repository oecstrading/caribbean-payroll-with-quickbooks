import { describe, expect, it, vi } from 'vitest';
import { consolidateCompanies, loadCompanySummaries, type CompanySummary } from '@/lib/company-dashboard';
const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc } }));
const row = (id: string, values: Partial<CompanySummary> = {}): CompanySummary => ({
  id, name: id, employees: 4, active_employees: 4, monthly_salaries: 6166.67,
  gross: 0, net: 0, deductions: 0, period: null, period_start: null, period_end: null,
  currency: 'XCD', on_clock: 0, open_alerts: 0, late_arrivals: 0, pending_runs: 0, ...values,
});
describe('company dashboard totals', () => {
  it('combines two four-employee companies into eight employees', () => {
    expect(consolidateCompanies([row('Smiley'), row('Sonrisa')]).employees).toBe(8);
  });
  it('sums salary and saved payroll independently', () => {
    const total = consolidateCompanies([row('Smiley'), row('Sonrisa', { monthly_salaries: 6387.6, gross: 3335.58, net: 2978.08, deductions: 357.5 })]);
    expect(total.currencies[0].monthly).toBeCloseTo(12554.27, 2);
    expect(total.currencies[0].gross).toBe(3335.58);
    expect(total.currencies[0].net).toBe(2978.08);
  });
  it('never adds unlike currencies together', () => {
    const total = consolidateCompanies([row('LC'), row('JM', { currency: 'JMD', monthly_salaries: 100000 })]);
    expect(total.currencies).toHaveLength(2);
    expect(total.currencies.find(x => x.currency === 'XCD')?.monthly).toBe(6166.67);
  });
  it('requests only the current company by default', async () => {
    rpc.mockResolvedValueOnce({ data: [row('Smiley')], error: null });
    expect((await loadCompanySummaries())[0].employees).toBe(4);
    expect(rpc).toHaveBeenLastCalledWith('company_dashboard_summaries', { _all: false });
  });
  it('requests authorized companies for consolidation', async () => {
    rpc.mockResolvedValueOnce({ data: [row('Smiley')], error: null });
    await loadCompanySummaries(true);
    expect(rpc).toHaveBeenLastCalledWith('company_dashboard_summaries', { _all: true });
  });
  it('reports access errors rather than displaying false zero totals', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: new Error('Access unavailable') });
    await expect(loadCompanySummaries()).rejects.toThrow('Access unavailable');
  });
});