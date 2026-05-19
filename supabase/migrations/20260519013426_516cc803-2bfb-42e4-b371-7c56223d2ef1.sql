
CREATE TABLE public.qbo_connection (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  environment text NOT NULL DEFAULT 'sandbox',
  company_name text DEFAULT '',
  status text NOT NULL DEFAULT 'disconnected',
  connected_by uuid,
  connected_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.qbo_account_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_item text NOT NULL UNIQUE,
  qbo_account_id text NOT NULL DEFAULT '',
  qbo_account_name text NOT NULL DEFAULT '',
  account_type text NOT NULL DEFAULT 'Expense',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

CREATE TABLE public.qbo_employee_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  qbo_employee_id text NOT NULL DEFAULT '',
  qbo_display_name text NOT NULL DEFAULT '',
  last_synced_at timestamptz,
  status text NOT NULL DEFAULT 'pending'
);

CREATE TABLE public.qbo_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id uuid,
  sync_type text NOT NULL DEFAULT 'journal_entry',
  qbo_entity_id text DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  payload jsonb,
  response jsonb,
  error_message text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.qbo_connection ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qbo_account_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qbo_employee_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qbo_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage qbo connection" ON public.qbo_connection FOR ALL TO authenticated
  USING (is_admin_or_manager(auth.uid())) WITH CHECK (is_admin_or_manager(auth.uid()));
CREATE POLICY "Admins manage qbo mappings" ON public.qbo_account_mappings FOR ALL TO authenticated
  USING (is_admin_or_manager(auth.uid())) WITH CHECK (is_admin_or_manager(auth.uid()));
CREATE POLICY "Admins manage qbo employee map" ON public.qbo_employee_map FOR ALL TO authenticated
  USING (is_admin_or_manager(auth.uid())) WITH CHECK (is_admin_or_manager(auth.uid()));
CREATE POLICY "Admins manage qbo sync log" ON public.qbo_sync_log FOR ALL TO authenticated
  USING (is_admin_or_manager(auth.uid())) WITH CHECK (is_admin_or_manager(auth.uid()));

INSERT INTO public.qbo_account_mappings (payroll_item, qbo_account_name, account_type) VALUES
  ('gross_wages', 'Wages & Salaries Expense', 'Expense'),
  ('overtime', 'Overtime Expense', 'Expense'),
  ('employer_nic', 'Employer NIC Expense', 'Expense'),
  ('employee_nic_payable', 'NIC Payable', 'Liability'),
  ('paye_payable', 'PAYE Tax Payable', 'Liability'),
  ('net_pay_clearing', 'Payroll Clearing', 'Bank'),
  ('creditor_deductions', 'Employee Deductions Payable', 'Liability')
ON CONFLICT (payroll_item) DO NOTHING;
