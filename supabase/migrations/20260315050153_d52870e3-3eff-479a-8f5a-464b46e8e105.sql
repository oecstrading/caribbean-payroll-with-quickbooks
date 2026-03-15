
-- Projects / Job Sites
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  client_name TEXT DEFAULT '',
  address TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  start_date DATE DEFAULT CURRENT_DATE,
  end_date DATE,
  budget NUMERIC DEFAULT 0,
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage projects" ON public.projects FOR ALL TO authenticated
  USING (is_admin_or_manager(auth.uid())) WITH CHECK (is_admin_or_manager(auth.uid()));
CREATE POLICY "Employees can view projects" ON public.projects FOR SELECT TO authenticated
  USING (true);

-- Project employee assignments
CREATE TABLE public.project_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT DEFAULT 'worker',
  hourly_rate NUMERIC DEFAULT 0,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);
ALTER TABLE public.project_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage assignments" ON public.project_assignments FOR ALL TO authenticated
  USING (is_admin_or_manager(auth.uid())) WITH CHECK (is_admin_or_manager(auth.uid()));
CREATE POLICY "Users can view their assignments" ON public.project_assignments FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Crews
CREATE TABLE public.crews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  lead_user_id UUID,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.crews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage crews" ON public.crews FOR ALL TO authenticated
  USING (is_admin_or_manager(auth.uid())) WITH CHECK (is_admin_or_manager(auth.uid()));
CREATE POLICY "Employees can view crews" ON public.crews FOR SELECT TO authenticated
  USING (true);

-- Crew members
CREATE TABLE public.crew_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id UUID NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(crew_id, user_id)
);
ALTER TABLE public.crew_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage crew members" ON public.crew_members FOR ALL TO authenticated
  USING (is_admin_or_manager(auth.uid())) WITH CHECK (is_admin_or_manager(auth.uid()));
CREATE POLICY "Users can view their crew membership" ON public.crew_members FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Equipment
CREATE TABLE public.equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT DEFAULT 'tool',
  serial_number TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'available',
  condition TEXT DEFAULT 'good',
  purchase_date DATE,
  purchase_cost NUMERIC DEFAULT 0,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage equipment" ON public.equipment FOR ALL TO authenticated
  USING (is_admin_or_manager(auth.uid())) WITH CHECK (is_admin_or_manager(auth.uid()));
CREATE POLICY "Employees can view equipment" ON public.equipment FOR SELECT TO authenticated
  USING (true);

-- Equipment checkouts
CREATE TABLE public.equipment_checkouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id UUID NOT NULL REFERENCES public.equipment(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  checked_out_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  returned_at TIMESTAMPTZ,
  condition_on_return TEXT DEFAULT '',
  notes TEXT DEFAULT ''
);
ALTER TABLE public.equipment_checkouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage checkouts" ON public.equipment_checkouts FOR ALL TO authenticated
  USING (is_admin_or_manager(auth.uid())) WITH CHECK (is_admin_or_manager(auth.uid()));
CREATE POLICY "Users can view their checkouts" ON public.equipment_checkouts FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Daily field reports
CREATE TABLE public.daily_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  submitted_by UUID NOT NULL,
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  weather TEXT DEFAULT 'clear',
  crew_size INTEGER DEFAULT 0,
  work_completed TEXT DEFAULT '',
  safety_notes TEXT DEFAULT '',
  issues TEXT DEFAULT '',
  materials_used TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage reports" ON public.daily_reports FOR ALL TO authenticated
  USING (is_admin_or_manager(auth.uid())) WITH CHECK (is_admin_or_manager(auth.uid()));
CREATE POLICY "Users can manage their own reports" ON public.daily_reports FOR ALL TO authenticated
  USING (auth.uid() = submitted_by) WITH CHECK (auth.uid() = submitted_by);

-- Contractors / Subcontractors
CREATE TABLE public.contractors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  contact_name TEXT DEFAULT '',
  email TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  trade TEXT DEFAULT '',
  tax_id TEXT DEFAULT '',
  bank_name TEXT DEFAULT '',
  account_number TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.contractors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage contractors" ON public.contractors FOR ALL TO authenticated
  USING (is_admin_or_manager(auth.uid())) WITH CHECK (is_admin_or_manager(auth.uid()));

-- Contractor payments
CREATE TABLE public.contractor_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID NOT NULL REFERENCES public.contractors(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  description TEXT DEFAULT '',
  payment_date DATE DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'pending',
  invoice_number TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.contractor_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage contractor payments" ON public.contractor_payments FOR ALL TO authenticated
  USING (is_admin_or_manager(auth.uid())) WITH CHECK (is_admin_or_manager(auth.uid()));
