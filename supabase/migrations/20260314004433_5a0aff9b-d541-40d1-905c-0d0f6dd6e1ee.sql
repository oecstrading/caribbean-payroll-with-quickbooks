-- Creditors table (banks, credit unions, etc.)
CREATE TABLE public.creditors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL DEFAULT 'other',
  account_number text DEFAULT '',
  contact_info text DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.creditors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view creditors" ON public.creditors FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage creditors" ON public.creditors FOR ALL TO authenticated USING (public.is_admin_or_manager(auth.uid())) WITH CHECK (public.is_admin_or_manager(auth.uid()));

-- Employee deductions (links employees to creditors with amounts)
CREATE TABLE public.employee_deductions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  creditor_id uuid NOT NULL REFERENCES public.creditors(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  frequency text NOT NULL DEFAULT 'monthly',
  start_date date DEFAULT CURRENT_DATE,
  end_date date DEFAULT NULL,
  is_active boolean NOT NULL DEFAULT true,
  notes text DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.employee_deductions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own deductions" ON public.employee_deductions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all deductions" ON public.employee_deductions FOR SELECT TO authenticated USING (public.is_admin_or_manager(auth.uid()));
CREATE POLICY "Admins can manage deductions" ON public.employee_deductions FOR ALL TO authenticated USING (public.is_admin_or_manager(auth.uid())) WITH CHECK (public.is_admin_or_manager(auth.uid()));

-- Seed some common creditor types
INSERT INTO public.creditors (name, type) VALUES
  ('National Insurance Corporation', 'government'),
  ('Inland Revenue Department', 'government'),
  ('1st National Bank', 'bank'),
  ('Bank of Saint Lucia', 'bank'),
  ('St. Lucia Teachers Credit Union', 'credit_union'),
  ('Civil Service Credit Union', 'credit_union');