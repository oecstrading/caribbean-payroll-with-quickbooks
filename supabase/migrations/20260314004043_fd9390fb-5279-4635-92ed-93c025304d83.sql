-- Allow managers to also update company settings
DROP POLICY "Admins can update company settings" ON public.company_settings;
CREATE POLICY "Admins and managers can update company settings" ON public.company_settings FOR UPDATE TO authenticated USING (public.is_admin_or_manager(auth.uid()));

DROP POLICY "Admins can insert company settings" ON public.company_settings;
CREATE POLICY "Admins and managers can insert company settings" ON public.company_settings FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_manager(auth.uid()));

-- PIN login table
CREATE TABLE public.user_pins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  pin_hash text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.user_pins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage pins" ON public.user_pins FOR ALL TO authenticated USING (public.is_admin_or_manager(auth.uid())) WITH CHECK (public.is_admin_or_manager(auth.uid()));
CREATE POLICY "Users can view own pin status" ON public.user_pins FOR SELECT TO authenticated USING (auth.uid() = user_id);