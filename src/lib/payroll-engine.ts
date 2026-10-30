// OECS Multi-Island Payroll Calculation Engine

export interface CountryTaxConfig {
  countryCode: string;
  countryName: string;
  currency: string;
  currencySymbol: string;
  nic: {
    employeeRate: number;
    employerRate: number;
    monthlyCeiling: number;
    maxContribution: number;
  };
  paye: {
    annualAllowance: number;
    brackets: { min: number; max: number; rate: number }[];
  };
  minimumWage: {
    hourly: number;
    daily: number;
    monthly: number;
  };
  overtime: {
    weeklyThreshold: number;
    standardMultiplier: number;
    nightMultiplier: number;
    nightStart: number;
    nightEnd: number;
    sundayMultiplier: number;
    holidayMultiplier: number;
    holidayOvertimeMultiplier: number;
  };
  taxIdLabels: {
    nicLabel: string;
    taxLabel: string;
  };
}

export const ST_LUCIA_CONFIG: CountryTaxConfig = {
  countryCode: "LC",
  countryName: "Saint Lucia",
  currency: "XCD",
  currencySymbol: "$",
  nic: {
    employeeRate: 0.05,
    employerRate: 0.05,
    monthlyCeiling: 5000,
    maxContribution: 250,
  },
  paye: {
    annualAllowance: 25000,
    brackets: [
      { min: 0, max: 15000, rate: 0.15 },
      { min: 15000, max: 30000, rate: 0.20 },
      { min: 30000, max: Infinity, rate: 0.30 },
    ],
  },
  minimumWage: {
    hourly: 6.52,
    daily: 52,
    monthly: 1131,
  },
  overtime: {
    weeklyThreshold: 40,
    standardMultiplier: 1.5,
    nightMultiplier: 1.25,
    nightStart: 22,
    nightEnd: 6,
    sundayMultiplier: 2.0,
    holidayMultiplier: 2.0,
    holidayOvertimeMultiplier: 2.5,
  },
  taxIdLabels: {
    nicLabel: "NIC Number",
    taxLabel: "TAN Number",
  },
};

export const ANTIGUA_CONFIG: CountryTaxConfig = {
  countryCode: "AG",
  countryName: "Antigua and Barbuda",
  currency: "XCD",
  currencySymbol: "$",
  nic: {
    employeeRate: 0.06,
    employerRate: 0.075,
    monthlyCeiling: 6500,
    maxContribution: 390,
  },
  paye: {
    annualAllowance: 42000,
    brackets: [
      { min: 0, max: Infinity, rate: 0.25 },
    ],
  },
  minimumWage: {
    hourly: 8.20,
    daily: 65,
    monthly: 1414,
  },
  overtime: {
    weeklyThreshold: 40,
    standardMultiplier: 1.5,
    nightMultiplier: 1.25,
    nightStart: 22,
    nightEnd: 6,
    sundayMultiplier: 2.0,
    holidayMultiplier: 2.0,
    holidayOvertimeMultiplier: 2.5,
  },
  taxIdLabels: {
    nicLabel: "Social Security Number",
    taxLabel: "Tax ID",
  },
};

export const ST_KITTS_CONFIG: CountryTaxConfig = {
  countryCode: "KN",
  countryName: "Saint Kitts and Nevis",
  currency: "XCD",
  currencySymbol: "$",
  nic: {
    employeeRate: 0.05,
    employerRate: 0.05,
    monthlyCeiling: 6000,
    maxContribution: 300,
  },
  paye: {
    annualAllowance: 40000,
    brackets: [
      { min: 0, max: 10000, rate: 0.15 },
      { min: 10000, max: 20000, rate: 0.20 },
      { min: 20000, max: Infinity, rate: 0.30 },
    ],
  },
  minimumWage: {
    hourly: 9.00,
    daily: 72,
    monthly: 1566,
  },
  overtime: {
    weeklyThreshold: 40,
    standardMultiplier: 1.5,
    nightMultiplier: 1.25,
    nightStart: 22,
    nightEnd: 6,
    sundayMultiplier: 2.0,
    holidayMultiplier: 2.0,
    holidayOvertimeMultiplier: 2.5,
  },
  taxIdLabels: {
    nicLabel: "Social Security Number",
    taxLabel: "Tax ID",
  },
};

export const DOMINICA_CONFIG: CountryTaxConfig = {
  countryCode: "DM",
  countryName: "Commonwealth of Dominica",
  currency: "XCD",
  currencySymbol: "$",
  nic: {
    employeeRate: 0.0525,
    employerRate: 0.0725,
    monthlyCeiling: 5000,
    maxContribution: 262.50,
  },
  paye: {
    annualAllowance: 25000,
    brackets: [
      { min: 0, max: 20000, rate: 0.15 },
      { min: 20000, max: 30000, rate: 0.25 },
      { min: 30000, max: Infinity, rate: 0.35 },
    ],
  },
  minimumWage: {
    hourly: 5.50,
    daily: 44,
    monthly: 957,
  },
  overtime: {
    weeklyThreshold: 40,
    standardMultiplier: 1.5,
    nightMultiplier: 1.25,
    nightStart: 22,
    nightEnd: 6,
    sundayMultiplier: 2.0,
    holidayMultiplier: 2.0,
    holidayOvertimeMultiplier: 2.5,
  },
  taxIdLabels: {
    nicLabel: "Social Security Number",
    taxLabel: "Tax ID",
  },
};

export const GRENADA_CONFIG: CountryTaxConfig = {
  countryCode: "GD",
  countryName: "Grenada",
  currency: "XCD",
  currencySymbol: "$",
  nic: {
    employeeRate: 0.05,
    employerRate: 0.05,
    monthlyCeiling: 5000,
    maxContribution: 250,
  },
  paye: {
    annualAllowance: 36000,
    brackets: [
      { min: 0, max: 24000, rate: 0.15 },
      { min: 24000, max: Infinity, rate: 0.28 },
    ],
  },
  minimumWage: {
    hourly: 6.00,
    daily: 48,
    monthly: 1044,
  },
  overtime: {
    weeklyThreshold: 40,
    standardMultiplier: 1.5,
    nightMultiplier: 1.25,
    nightStart: 22,
    nightEnd: 6,
    sundayMultiplier: 2.0,
    holidayMultiplier: 2.0,
    holidayOvertimeMultiplier: 2.5,
  },
  taxIdLabels: {
    nicLabel: "NIS Number",
    taxLabel: "Tax ID",
  },
};

export const OECS_CONFIGS: Record<string, CountryTaxConfig> = {
  LC: ST_LUCIA_CONFIG,
  AG: ANTIGUA_CONFIG,
  KN: ST_KITTS_CONFIG,
  DM: DOMINICA_CONFIG,
  GD: GRENADA_CONFIG,
};

export function getConfigByJurisdiction(code: string): CountryTaxConfig {
  return OECS_CONFIGS[code] || ST_LUCIA_CONFIG;
}

export interface CreditorDeduction {
  creditorName: string;
  amount: number;
}

export interface PayrollAddition {
  type: string;
  description: string;
  amount: number;
}

export interface PayrollResult {
  grossMonthly: number;
  employeeNIC: number;
  employerNIC: number;
  paye: number;
  creditorDeductions: CreditorDeduction[];
  totalCreditorDeductions: number;
  additions: PayrollAddition[];
  totalAdditions: number;
  totalDeductions: number;
  netPay: number;
  overtimePay: number;
  basicPay: number;
  sundayPay: number;
  holidayPay: number;
}

export function calculatePayroll(
  grossMonthly: number,
  config: CountryTaxConfig = ST_LUCIA_CONFIG,
  overtimePay: number = 0,
  creditorDeductions: CreditorDeduction[] = [],
  additions: PayrollAddition[] = [],
  sundayPay: number = 0,
  holidayPay: number = 0,
  options: { nicBasis?: "gross" | "basic"; fixedPaye?: number | null } = {}
): PayrollResult {
  const totalAdditions = additions.reduce((sum, a) => sum + a.amount, 0);
  const totalGross = grossMonthly + overtimePay + totalAdditions + sundayPay + holidayPay;

  // NIC Calculation
  const nicBase = options.nicBasis === "basic" ? grossMonthly : totalGross;
  const employeeNIC = Math.min(nicBase * config.nic.employeeRate, config.nic.maxContribution);
  const employerNIC = Math.min(nicBase * config.nic.employerRate, config.nic.maxContribution);

  // PAYE Calculation (monthly basis)
  const monthlyAllowance = config.paye.annualAllowance / 12;
  const taxableIncome = Math.max(0, totalGross - monthlyAllowance);

  let paye = 0;
  const monthlyBrackets = config.paye.brackets.map(b => ({
    min: b.min / 12,
    max: b.max === Infinity ? Infinity : b.max / 12,
    rate: b.rate,
  }));

  let remaining = taxableIncome;
  for (const bracket of monthlyBrackets) {
    const bracketSize = bracket.max === Infinity ? remaining : bracket.max - bracket.min;
    const taxable = Math.min(remaining, bracketSize);
    if (taxable <= 0) break;
    paye += taxable * bracket.rate;
    remaining -= taxable;
  }

  if (options.fixedPaye !== undefined && options.fixedPaye !== null && Number.isFinite(options.fixedPaye)) paye = Math.max(0, options.fixedPaye);

  const totalCreditorDeductions = creditorDeductions.reduce((sum, d) => sum + d.amount, 0);
  const totalDeductions = employeeNIC + paye + totalCreditorDeductions;
  const netPay = totalGross - totalDeductions;

  return {
    grossMonthly: totalGross,
    basicPay: grossMonthly,
    overtimePay,
    sundayPay: Math.round(sundayPay * 100) / 100,
    holidayPay: Math.round(holidayPay * 100) / 100,
    additions,
    totalAdditions: Math.round(totalAdditions * 100) / 100,
    employeeNIC: Math.round(employeeNIC * 100) / 100,
    employerNIC: Math.round(employerNIC * 100) / 100,
    paye: Math.round(paye * 100) / 100,
    creditorDeductions,
    totalCreditorDeductions: Math.round(totalCreditorDeductions * 100) / 100,
    totalDeductions: Math.round(totalDeductions * 100) / 100,
    netPay: Math.round(netPay * 100) / 100,
  };
}

export function checkMinimumWageCompliance(
  hourlyRate: number,
  config: CountryTaxConfig = ST_LUCIA_CONFIG
): { compliant: boolean; message: string } {
  if (hourlyRate < config.minimumWage.hourly) {
    return {
      compliant: false,
      message: `Rate $${hourlyRate}/hr is below minimum wage of $${config.minimumWage.hourly}/hr`,
    };
  }
  return { compliant: true, message: "Compliant" };
}

export function formatCurrency(amount: number, symbol: string = "$"): string {
  return `${symbol}${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Calculate overtime pay for different shift types
export function calculateShiftPay(
  hourlyRate: number,
  hours: number,
  shiftType: 'standard' | 'night' | 'sunday' | 'holiday' | 'holiday_overtime',
  config: CountryTaxConfig = ST_LUCIA_CONFIG
): number {
  const multipliers: Record<string, number> = {
    standard: config.overtime.standardMultiplier,
    night: config.overtime.nightMultiplier,
    sunday: config.overtime.sundayMultiplier,
    holiday: config.overtime.holidayMultiplier,
    holiday_overtime: config.overtime.holidayOvertimeMultiplier,
  };
  return Math.round(hourlyRate * hours * (multipliers[shiftType] || 1) * 100) / 100;
}
