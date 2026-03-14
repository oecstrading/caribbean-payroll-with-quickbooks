CREATE TABLE public.company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL DEFAULT '',
  employer_nic_number text DEFAULT '',
  tax_id text DEFAULT '',
  vat_number text DEFAULT '',
  telephone text DEFAULT '',
  website text DEFAULT '',
  address text DEFAULT '',
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid DEFAULT NULL
);

ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view company settings" ON public.company_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert company settings" ON public.company_settings FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update company settings" ON public.company_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.company_settings (company_name, employer_nic_number, tax_id) VALUES ('Promotech Solutions Ltd.', 'EMP-NIC-2022-001', 'TID-LC-00123');