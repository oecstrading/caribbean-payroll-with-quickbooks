// Payroll-register levy rules per jurisdiction. Rates apply to gross pay for display in the
// register only; stored payslips remain the financial source of truth.
// OECS jurisdictions (LC, AG, KN, DM, GD, VC) have no separate payroll levy beyond NIC/SS and PAYE.
export interface LevyRule { name: string; employeeRate: number; employerRate: number }

export const STATUTORY_LEVIES: Record<string, LevyRule[]> = {
  LC: [], AG: [], KN: [], DM: [], GD: [], VC: [],
  TT: [{ name: "Health Surcharge", employeeRate: 0, employerRate: 0 }], // flat weekly amount; record as deduction
  JM: [
    { name: "Education Tax", employeeRate: 0.0225, employerRate: 0.035 },
    { name: "NHT", employeeRate: 0.02, employerRate: 0.03 },
    { name: "HEART/NSTA", employeeRate: 0, employerRate: 0.03 },
  ],
  BB: [{ name: "Training Levy", employeeRate: 0, employerRate: 0.005 }],
};

export function levyFor(jurisdiction: string | null | undefined, gross: number) {
  const rules = STATUTORY_LEVIES[(jurisdiction ?? "LC").toUpperCase()] ?? [];
  const r = (n: number) => Math.round(n * 100) / 100;
  return {
    employee: r(rules.reduce((s, l) => s + gross * l.employeeRate, 0)),
    employer: r(rules.reduce((s, l) => s + gross * l.employerRate, 0)),
    names: rules.map(l => l.name),
  };
}

export interface RegisterRow { gross: number; paye: number; nis: number; levy: number; other: number; net: number; employerNis: number; employerLevy: number }

/** Splits a stored payslip into register columns; voluntary deductions are whatever remains after statutory items. */
export function registerRow(p: { gross_pay: number; paye: number; employee_nic: number; employer_nic: number; total_deductions: number; net_pay: number }, jurisdiction?: string | null): RegisterRow {
  const gross = Number(p.gross_pay) || 0, paye = Number(p.paye) || 0, nis = Number(p.employee_nic) || 0;
  const lv = levyFor(jurisdiction, gross);
  const levy = Math.min(lv.employee, Math.max(0, (Number(p.total_deductions) || 0) - paye - nis));
  const other = Math.max(0, Math.round(((Number(p.total_deductions) || 0) - paye - nis - levy) * 100) / 100);
  return { gross, paye, nis, levy, other, net: Number(p.net_pay) || 0, employerNis: Number(p.employer_nic) || 0, employerLevy: lv.employer };
}
