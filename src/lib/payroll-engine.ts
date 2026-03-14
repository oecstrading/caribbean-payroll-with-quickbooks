// St. Lucia Payroll Calculation Engine
// Configurable for other OECS countries

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
    nightStart: number; // 22 = 10 PM
    nightEnd: number;   // 6 = 6 AM
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
  },
};

export interface CreditorDeduction {
  creditorName: string;
  amount: number;
}

export interface PayrollResult {
  grossMonthly: number;
  employeeNIC: number;
  employerNIC: number;
  paye: number;
  creditorDeductions: CreditorDeduction[];
  totalCreditorDeductions: number;
  totalDeductions: number;
  netPay: number;
  overtimePay: number;
  basicPay: number;
}

export function calculatePayroll(
  grossMonthly: number,
  config: CountryTaxConfig = ST_LUCIA_CONFIG,
  overtimePay: number = 0,
  creditorDeductions: CreditorDeduction[] = []
): PayrollResult {
  const totalGross = grossMonthly + overtimePay;

  // NIC Calculation
  const employeeNIC = Math.min(totalGross * config.nic.employeeRate, config.nic.maxContribution);
  const employerNIC = Math.min(totalGross * config.nic.employerRate, config.nic.maxContribution);

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

  const totalCreditorDeductions = creditorDeductions.reduce((sum, d) => sum + d.amount, 0);
  const totalDeductions = employeeNIC + paye + totalCreditorDeductions;
  const netPay = totalGross - totalDeductions;

  return {
    grossMonthly: totalGross,
    basicPay: grossMonthly,
    overtimePay,
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
