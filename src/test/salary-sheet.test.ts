import { describe, expect, it } from "vitest";
import { parseSalarySheet, compareSheet, defaultRules, importQuestions, platformPay, dailyFromMonthly } from "@/lib/salary-sheet";
import { calculatePayroll, ST_LUCIA_CONFIG } from "@/lib/payroll-engine";
import { payrollOptions } from "@/lib/employee-folder";

// Fictional two-row-header sheet in the Caribbean layout (name row + NIC row, sub-total sections).
const values = [
  ["Salaries for the August"],
  ["NAME", "BASIC", null, "DAILY ", null, null, null, "OVERTIME", null, "TRAVEL", "ON CALL", "TOTAL", "LESS", "TAX", "LESS", "LESS", "NET"],
  [null, "SALARY", "DAYS", "RATE", "TOTAL", "HOURLY RATE", "HOURS", "RATE", "TOTAL", "ALLOW", null, "SALARY", "5% NIC", "CODE", "PAYE", "OTHER", "SALARY"],
  ["Ann Sample", 3000, null, 138.46, 0, 17.31, null, 25.96, 0, null, 250, 3250, 162.5, "264M", 133.13, null, 2954.37],
  [431944],
  ["Ben Sample", 2000, -5.5, 92.31, -507.69, null, null, null, 0, 0, 0, 1492.31, 74.62, "194M", null, null, 1417.69],
  ["Cara Sample", 5500, null, 253.85, 0, null, null, null, 0, 500, null, 6000, 300, "254M", 777.5, null, 4922.5],
  ["Sub-Total"],
  ["Dan Director", 15000, null, 692.31, 0, null, null, null, 0, null, null, 0, 250, "360M", 3212.5, 0, -3462.5],
  ["Sub-Total"],
  ["Grand Total"],
];

describe("salary sheet import", () => {
  const sheet = parseSalarySheet(values);

  it("reads every employee, pairs the NIC row and stops at the grand total", () => {
    expect(sheet.employees.map(e => e.name)).toEqual(["Ann Sample", "Ben Sample", "Cara Sample", "Dan Director"]);
    expect(sheet.employees[0].employeeId).toBe("431944");
    expect(sheet.employees[3].group).toBe(1);
  });

  it("uses the daily rate monthly × 12 ÷ 52 ÷ 5 and deducts days not worked", () => {
    expect(dailyFromMonthly(3000)).toBeCloseTo(138.4615, 3);
    const ben = platformPay(sheet.employees[1], defaultRules);
    expect(ben.dayAdjustment).toBe(-507.69);
    expect(ben.net).toBe(1417.69);
  });

  it("matches rows that follow the rules and flags the NIC maximum and the zero total", () => {
    const { differences } = compareSheet(sheet, defaultRules);
    expect(differences.some(d => d.name === "Ann Sample")).toBe(false);
    expect(differences.find(d => d.name === "Cara Sample" && d.field === "NIC")).toMatchObject({ sheet: 300, platform: 250 });
    expect(differences.find(d => d.name === "Dan Director" && d.field === "Gross")).toMatchObject({ sheet: 0, platform: 15000 });
  });

  it("asks about the NIC maximum, the zero total and the second section", () => {
    const ids = importQuestions(sheet).map(q => q.id);
    expect(ids).toEqual(expect.arrayContaining(["nicCap", "zeroTotal", "groups", "payeMethod"]));
  });
});

describe("new employee payroll options", () => {
  it("keeps a fixed PAYE amount instead of the tax bands", () => {
    expect(calculatePayroll(3250, ST_LUCIA_CONFIG, 0, [], [], 0, 0, { fixedPaye: 133.13 }).paye).toBe(133.13);
  });
  it("charges NIC on basic pay only when chosen", () => {
    const r = calculatePayroll(2000, ST_LUCIA_CONFIG, 0, [], [{ type: "allowance", description: "Travel", amount: 500 }], 0, 0, { nicBasis: "basic" });
    expect(r.employeeNIC).toBe(100);
  });
  it("leaves standard behaviour when the new fields are blank", () => {
    expect(payrollOptions({})).toEqual({ nicBasis: "gross", fixedPaye: null });
    expect(payrollOptions({ paye_method: "Fixed amount", paye_fixed_amount: "54.95", nic_basis: "Basic pay" })).toEqual({ nicBasis: "basic", fixedPaye: 54.95 });
  });
});
