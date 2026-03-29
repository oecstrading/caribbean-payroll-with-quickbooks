
-- Applicant tracking tables
CREATE TABLE public.applicants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT DEFAULT '',
  address TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'applied',
  applied_date DATE NOT NULL DEFAULT CURRENT_DATE,
  desired_position TEXT DEFAULT 'security_guard',
  experience_years INTEGER DEFAULT 0,
  notes TEXT DEFAULT '',
  jurisdiction TEXT DEFAULT 'LC',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.applicants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage applicants" ON public.applicants
  FOR ALL TO authenticated
  USING (is_admin_or_manager(auth.uid()))
  WITH CHECK (is_admin_or_manager(auth.uid()));

-- Applicant documents (licenses, certificates uploaded during application)
CREATE TABLE public.applicant_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id UUID NOT NULL REFERENCES public.applicants(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL DEFAULT 'other',
  file_url TEXT NOT NULL DEFAULT '',
  file_name TEXT NOT NULL DEFAULT '',
  verified BOOLEAN NOT NULL DEFAULT false,
  expiry_date DATE,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.applicant_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage applicant documents" ON public.applicant_documents
  FOR ALL TO authenticated
  USING (is_admin_or_manager(auth.uid()))
  WITH CHECK (is_admin_or_manager(auth.uid()));

-- Client invoices
CREATE TABLE public.client_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL DEFAULT '',
  site_id UUID REFERENCES public.client_sites(id),
  client_name TEXT NOT NULL DEFAULT '',
  client_email TEXT DEFAULT '',
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
  period_start DATE NOT NULL DEFAULT CURRENT_DATE,
  period_end DATE NOT NULL DEFAULT CURRENT_DATE,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  tax_rate NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  notes TEXT DEFAULT '',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.client_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage invoices" ON public.client_invoices
  FOR ALL TO authenticated
  USING (is_admin_or_manager(auth.uid()))
  WITH CHECK (is_admin_or_manager(auth.uid()));

-- Invoice line items (individual shift entries)
CREATE TABLE public.invoice_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.client_invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL DEFAULT '',
  guard_name TEXT DEFAULT '',
  shift_date DATE,
  hours NUMERIC NOT NULL DEFAULT 0,
  rate NUMERIC NOT NULL DEFAULT 0,
  amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.invoice_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage line items" ON public.invoice_line_items
  FOR ALL TO authenticated
  USING (is_admin_or_manager(auth.uid()))
  WITH CHECK (is_admin_or_manager(auth.uid()));

-- Storage bucket for applicant documents
INSERT INTO storage.buckets (id, name, public) VALUES ('applicant-docs', 'applicant-docs', false);

CREATE POLICY "Admins can upload applicant docs" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'applicant-docs' AND is_admin_or_manager(auth.uid()));

CREATE POLICY "Admins can view applicant docs" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'applicant-docs' AND is_admin_or_manager(auth.uid()));

CREATE POLICY "Admins can delete applicant docs" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'applicant-docs' AND is_admin_or_manager(auth.uid()));
