// Local tax-form nomenclature for the Statutory Remittance Report. Labels only; amounts come from payslips.
export interface RemittanceTerms { name: string; form: string; gross: string; paye: string; eeNis: string; erNis: string; levies: string; authority: string }

export const REMITTANCE_TERMS: Record<string, RemittanceTerms> = {
  LC: { name: "Saint Lucia", form: "NIC C3 / PAYE monthly return", gross: "Gross Taxable Emoluments", paye: "PAYE (Income Tax) Withheld", eeNis: "Employee NIC", erNis: "Employer NIC", levies: "Other Levies", authority: "Inland Revenue Department & NIC" },
  JM: { name: "Jamaica", form: "S01 Monthly Remittance", gross: "Gross Emoluments", paye: "Income Tax (PAYE)", eeNis: "NIS (Employee)", erNis: "NIS (Employer)", levies: "NHT / Ed. Tax / HEART-NSTA", authority: "Tax Administration Jamaica" },
  TT: { name: "Trinidad & Tobago", form: "NIS RS1 / PAYE TD4", gross: "Gross Taxable Earnings", paye: "PAYE Deducted", eeNis: "NIS Employee Share", erNis: "NIS Employer Share", levies: "Health Surcharge", authority: "Board of Inland Revenue & NIBTT" },
  BB: { name: "Barbados", form: "NIS C-Form / PAYE Monthly Return", gross: "Insurable / Taxable Earnings", paye: "PAYE Income Tax", eeNis: "NIS Employee", erNis: "NIS Employer", levies: "Training & Resilience Levies", authority: "BRA & National Insurance Dept." },
  GY: { name: "Guyana", form: "Form 2 / NIS CS3", gross: "Gross Chargeable Emoluments", paye: "PAYE Withheld", eeNis: "NIS Employee (5.6%)", erNis: "NIS Employer (8.4%)", levies: "Other Levies", authority: "Guyana Revenue Authority & NIS" },
};

export const termsFor = (code: string) => REMITTANCE_TERMS[code] ?? REMITTANCE_TERMS.LC;
