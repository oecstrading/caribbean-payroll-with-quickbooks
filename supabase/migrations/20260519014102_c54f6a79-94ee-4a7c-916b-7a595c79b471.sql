
-- Extend account mappings with descriptive columns
ALTER TABLE public.qbo_account_mappings
  ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'payroll';

-- Update existing seeds with descriptions
UPDATE public.qbo_account_mappings SET description = CASE payroll_item
  WHEN 'gross_wages' THEN 'Expense account for regular wages and salaries.'
  WHEN 'overtime' THEN 'Expense account for overtime premium pay.'
  WHEN 'employer_nic' THEN 'Employer-side statutory social insurance expense.'
  WHEN 'employee_nic_payable' THEN 'Liability for employee + employer NIC owed to authority.'
  WHEN 'paye_payable' THEN 'Liability for PAYE income tax owed to authority.'
  WHEN 'net_pay_clearing' THEN 'Bank/clearing account from which net pay is disbursed.'
  WHEN 'creditor_deductions' THEN 'Liability for third-party deductions (loans, garnishments).'
  ELSE description
END,
category = CASE payroll_item
  WHEN 'gross_wages' THEN 'expense'
  WHEN 'overtime' THEN 'expense'
  WHEN 'employer_nic' THEN 'expense'
  WHEN 'employee_nic_payable' THEN 'liability'
  WHEN 'paye_payable' THEN 'liability'
  WHEN 'net_pay_clearing' THEN 'bank'
  WHEN 'creditor_deductions' THEN 'liability'
  ELSE category
END;

-- Insert Caribbean-typical default payroll items
INSERT INTO public.qbo_account_mappings (payroll_item, qbo_account_name, account_type, description, category) VALUES
  ('gratuity', 'Gratuity Expense', 'Expense', 'End-of-contract gratuity payments (common in Caribbean fixed-term contracts).', 'expense'),
  ('vacation_pay', 'Vacation Pay Expense', 'Expense', 'Paid leave accrual and disbursements.', 'expense'),
  ('sick_pay', 'Sick Pay Expense', 'Expense', 'Paid sick leave expense.', 'expense'),
  ('maternity_pay', 'Maternity Pay Expense', 'Expense', 'Maternity leave top-up beyond NIC benefit.', 'expense'),
  ('severance_pay', 'Severance Pay Expense', 'Expense', 'Statutory or contractual severance on termination.', 'expense'),
  ('holiday_pay', 'Holiday Pay Expense', 'Expense', 'Public holiday premium pay.', 'expense'),
  ('bonus_expense', 'Bonus & Incentive Expense', 'Expense', 'Discretionary and performance bonuses.', 'expense'),
  ('commission_expense', 'Commission Expense', 'Expense', 'Sales commission paid to employees.', 'expense'),
  ('tips_payable', 'Tips Payable', 'Liability', 'Service charge / tips held on behalf of staff.', 'liability'),
  ('health_insurance_employer', 'Health Insurance - Employer Share', 'Expense', 'Employer contribution to group medical (e.g. Sagicor, BCB).', 'expense'),
  ('health_insurance_payable', 'Health Insurance Payable', 'Liability', 'Combined employer + employee premium owed to insurer.', 'liability'),
  ('pension_employer', 'Pension - Employer Contribution', 'Expense', 'Employer share of pension/provident fund.', 'expense'),
  ('pension_payable', 'Pension Payable', 'Liability', 'Combined employer + employee pension owed to fund.', 'liability'),
  ('education_levy', 'Education Levy Payable', 'Liability', 'Education levy (Trinidad & Tobago, Barbados, etc.).', 'liability'),
  ('training_levy', 'Training Levy Payable', 'Liability', 'Training/skills development levy (e.g. St. Lucia NSDC, Barbados TVET).', 'liability'),
  ('housing_levy', 'Housing Levy Payable', 'Liability', 'Housing development levy where applicable.', 'liability'),
  ('catastrophe_fund', 'Catastrophe Fund Payable', 'Liability', 'Dominica/Antigua catastrophe contribution.', 'liability'),
  ('travel_allowance', 'Travel Allowance', 'Expense', 'Travel / mileage allowance paid to employees.', 'expense'),
  ('meal_allowance', 'Meal Allowance', 'Expense', 'Meal/subsistence allowance.', 'expense'),
  ('uniform_allowance', 'Uniform Allowance', 'Expense', 'Uniform / PPE allowance.', 'expense'),
  ('housing_allowance', 'Housing Allowance', 'Expense', 'Housing or accommodation allowance.', 'expense'),
  ('salary_advance', 'Salary Advances Receivable', 'Asset', 'Outstanding salary advances owed by employees.', 'asset'),
  ('union_dues', 'Union Dues Payable', 'Liability', 'Trade union dues withheld on behalf of unions.', 'liability'),
  ('garnishment_payable', 'Wage Garnishment Payable', 'Liability', 'Court-ordered garnishments (child support, etc.).', 'liability'),
  ('bank_fees', 'Bank Fees - Payroll', 'Expense', 'Wire/ACH fees for salary disbursement.', 'expense'),
  ('payroll_suspense', 'Payroll Suspense', 'Liability', 'Holding account for unresolved payroll items.', 'liability')
ON CONFLICT (payroll_item) DO NOTHING;

-- Chart of Accounts catalogue (what the dropdowns offer)
CREATE TABLE IF NOT EXISTS public.qbo_chart_of_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qbo_account_id text NOT NULL DEFAULT '',
  account_name text NOT NULL,
  account_type text NOT NULL DEFAULT 'Expense',
  account_subtype text DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  source text NOT NULL DEFAULT 'default',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.qbo_chart_of_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage qbo coa" ON public.qbo_chart_of_accounts FOR ALL TO authenticated
  USING (is_admin_or_manager(auth.uid())) WITH CHECK (is_admin_or_manager(auth.uid()));

INSERT INTO public.qbo_chart_of_accounts (qbo_account_id, account_name, account_type, account_subtype) VALUES
  ('60100', 'Wages & Salaries Expense', 'Expense', 'PayrollExpenses'),
  ('60110', 'Overtime Expense', 'Expense', 'PayrollExpenses'),
  ('60120', 'Holiday Pay Expense', 'Expense', 'PayrollExpenses'),
  ('60130', 'Vacation Pay Expense', 'Expense', 'PayrollExpenses'),
  ('60140', 'Sick Pay Expense', 'Expense', 'PayrollExpenses'),
  ('60150', 'Maternity Pay Expense', 'Expense', 'PayrollExpenses'),
  ('60160', 'Bonus & Incentive Expense', 'Expense', 'PayrollExpenses'),
  ('60170', 'Commission Expense', 'Expense', 'PayrollExpenses'),
  ('60180', 'Gratuity Expense', 'Expense', 'PayrollExpenses'),
  ('60190', 'Severance Pay Expense', 'Expense', 'PayrollExpenses'),
  ('60200', 'Employer NIC Expense', 'Expense', 'PayrollTaxExpenses'),
  ('60210', 'Pension - Employer Contribution', 'Expense', 'PayrollExpenses'),
  ('60220', 'Health Insurance - Employer Share', 'Expense', 'PayrollExpenses'),
  ('60230', 'Travel Allowance', 'Expense', 'PayrollExpenses'),
  ('60240', 'Meal Allowance', 'Expense', 'PayrollExpenses'),
  ('60250', 'Uniform Allowance', 'Expense', 'PayrollExpenses'),
  ('60260', 'Housing Allowance', 'Expense', 'PayrollExpenses'),
  ('60900', 'Bank Fees - Payroll', 'Expense', 'BankCharges'),
  ('21010', 'NIC Payable', 'Liability', 'PayrollTaxPayable'),
  ('21020', 'PAYE Tax Payable', 'Liability', 'PayrollTaxPayable'),
  ('21030', 'Education Levy Payable', 'Liability', 'PayrollTaxPayable'),
  ('21040', 'Training Levy Payable', 'Liability', 'PayrollTaxPayable'),
  ('21050', 'Housing Levy Payable', 'Liability', 'PayrollTaxPayable'),
  ('21060', 'Catastrophe Fund Payable', 'Liability', 'PayrollTaxPayable'),
  ('21100', 'Pension Payable', 'Liability', 'OtherCurrentLiabilities'),
  ('21110', 'Health Insurance Payable', 'Liability', 'OtherCurrentLiabilities'),
  ('21200', 'Employee Deductions Payable', 'Liability', 'OtherCurrentLiabilities'),
  ('21210', 'Union Dues Payable', 'Liability', 'OtherCurrentLiabilities'),
  ('21220', 'Wage Garnishment Payable', 'Liability', 'OtherCurrentLiabilities'),
  ('21230', 'Tips Payable', 'Liability', 'OtherCurrentLiabilities'),
  ('21900', 'Payroll Suspense', 'Liability', 'OtherCurrentLiabilities'),
  ('13010', 'Salary Advances Receivable', 'Asset', 'OtherCurrentAssets'),
  ('10100', 'Payroll Clearing', 'Bank', 'CashOnHand'),
  ('10110', 'Operating Bank Account', 'Bank', 'Checking')
ON CONFLICT DO NOTHING;
