
-- Add jurisdiction and multi-island tax ID fields to profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS jurisdiction text NOT NULL DEFAULT 'LC',
  ADD COLUMN IF NOT EXISTS social_security_number text DEFAULT '',
  ADD COLUMN IF NOT EXISTS tax_id_number text DEFAULT '';

-- Client Sites table for security guard management
CREATE TABLE public.client_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text DEFAULT '',
  latitude double precision,
  longitude double precision,
  radius_meters integer NOT NULL DEFAULT 200,
  post_orders text DEFAULT '',
  client_name text DEFAULT '',
  client_email text DEFAULT '',
  client_phone text DEFAULT '',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_sites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage client sites" ON public.client_sites
  FOR ALL TO authenticated
  USING (is_admin_or_manager(auth.uid()))
  WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE POLICY "Employees can view client sites" ON public.client_sites
  FOR SELECT TO authenticated
  USING (true);

-- Guard site assignments
CREATE TABLE public.guard_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  site_id uuid NOT NULL REFERENCES public.client_sites(id) ON DELETE CASCADE,
  shift_start time,
  shift_end time,
  days_of_week text[] DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  assigned_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.guard_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage guard assignments" ON public.guard_assignments
  FOR ALL TO authenticated
  USING (is_admin_or_manager(auth.uid()))
  WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE POLICY "Users can view their assignments" ON public.guard_assignments
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Post order sign-offs
CREATE TABLE public.post_order_signoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  site_id uuid NOT NULL REFERENCES public.client_sites(id) ON DELETE CASCADE,
  signed_at timestamptz NOT NULL DEFAULT now(),
  post_orders_text text DEFAULT ''
);

ALTER TABLE public.post_order_signoffs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all signoffs" ON public.post_order_signoffs
  FOR SELECT TO authenticated
  USING (is_admin_or_manager(auth.uid()));

CREATE POLICY "Users can manage their own signoffs" ON public.post_order_signoffs
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Guard patrol logs (checkpoint scans)
CREATE TABLE public.patrol_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  site_id uuid NOT NULL REFERENCES public.client_sites(id) ON DELETE CASCADE,
  checkpoint_name text DEFAULT '',
  latitude double precision,
  longitude double precision,
  scanned_at timestamptz NOT NULL DEFAULT now(),
  notes text DEFAULT ''
);

ALTER TABLE public.patrol_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all patrol logs" ON public.patrol_logs
  FOR SELECT TO authenticated
  USING (is_admin_or_manager(auth.uid()));

CREATE POLICY "Users can manage their own patrol logs" ON public.patrol_logs
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Incident reports
CREATE TABLE public.incident_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  site_id uuid NOT NULL REFERENCES public.client_sites(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  severity text NOT NULL DEFAULT 'low',
  photo_urls text[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'open',
  reported_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

ALTER TABLE public.incident_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage incidents" ON public.incident_reports
  FOR ALL TO authenticated
  USING (is_admin_or_manager(auth.uid()))
  WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE POLICY "Users can manage their own incidents" ON public.incident_reports
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Client portal access tokens
CREATE TABLE public.client_portal_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.client_sites(id) ON DELETE CASCADE,
  access_code text NOT NULL UNIQUE,
  client_name text NOT NULL,
  client_email text DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_accessed_at timestamptz
);

ALTER TABLE public.client_portal_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage client access" ON public.client_portal_access
  FOR ALL TO authenticated
  USING (is_admin_or_manager(auth.uid()))
  WITH CHECK (is_admin_or_manager(auth.uid()));
