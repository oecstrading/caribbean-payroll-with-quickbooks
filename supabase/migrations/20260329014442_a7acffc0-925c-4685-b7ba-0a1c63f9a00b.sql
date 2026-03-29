
CREATE TABLE public.guard_licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  license_type TEXT NOT NULL DEFAULT 'security_guard',
  license_number TEXT NOT NULL DEFAULT '',
  issued_date DATE,
  expiry_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.guard_licenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage licenses" ON public.guard_licenses
  FOR ALL TO authenticated
  USING (is_admin_or_manager(auth.uid()))
  WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE POLICY "Users can view own licenses" ON public.guard_licenses
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
