
-- 1. Custom access token hook: embeds role & jurisdiction into JWT
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  claims jsonb;
  user_role text;
  user_jurisdiction text;
BEGIN
  -- Fetch role from user_roles table
  SELECT role::text INTO user_role
  FROM public.user_roles
  WHERE user_id = (event->>'user_id')::uuid
  LIMIT 1;

  -- Fetch jurisdiction from profiles
  SELECT jurisdiction INTO user_jurisdiction
  FROM public.profiles
  WHERE user_id = (event->>'user_id')::uuid
  LIMIT 1;

  -- Default to employee if no role found
  IF user_role IS NULL THEN
    user_role := 'employee';
  END IF;

  claims := event->'claims';
  
  -- Inject role and jurisdiction into JWT claims
  IF claims IS NULL THEN
    claims := '{}'::jsonb;
  END IF;
  
  claims := jsonb_set(claims, '{user_role}', to_jsonb(user_role));
  
  IF user_jurisdiction IS NOT NULL THEN
    claims := jsonb_set(claims, '{user_jurisdiction}', to_jsonb(user_jurisdiction));
  END IF;

  event := jsonb_set(event, '{claims}', claims);
  RETURN event;
END;
$$;

-- 2. Grant permissions for the auth system to execute the hook
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;

-- Ensure the hook can read the necessary tables
GRANT SELECT ON public.user_roles TO supabase_auth_admin;
GRANT SELECT ON public.profiles TO supabase_auth_admin;

-- 3. Performance indexes for 500+ staff operations
CREATE INDEX IF NOT EXISTS idx_clock_punches_user_id ON public.clock_punches(user_id);
CREATE INDEX IF NOT EXISTS idx_clock_punches_punched_at ON public.clock_punches(punched_at DESC);
CREATE INDEX IF NOT EXISTS idx_guard_assignments_user_id ON public.guard_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_guard_assignments_site_id ON public.guard_assignments(site_id);
CREATE INDEX IF NOT EXISTS idx_patrol_logs_user_id ON public.patrol_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_patrol_logs_site_id ON public.patrol_logs(site_id);
CREATE INDEX IF NOT EXISTS idx_patrol_logs_scanned_at ON public.patrol_logs(scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_incident_reports_site_id ON public.incident_reports(site_id);
CREATE INDEX IF NOT EXISTS idx_incident_reports_user_id ON public.incident_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_post_order_signoffs_site_id ON public.post_order_signoffs(site_id);
CREATE INDEX IF NOT EXISTS idx_post_order_signoffs_user_id ON public.post_order_signoffs(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_jurisdiction ON public.profiles(jurisdiction);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_payslips_user_id ON public.payslips(user_id);
CREATE INDEX IF NOT EXISTS idx_employee_deductions_user_id ON public.employee_deductions(user_id);
CREATE INDEX IF NOT EXISTS idx_employee_additions_user_id ON public.employee_additions(user_id);
CREATE INDEX IF NOT EXISTS idx_project_time_logs_user_id ON public.project_time_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_project_time_logs_project_id ON public.project_time_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_equipment_checkouts_user_id ON public.equipment_checkouts(user_id);
CREATE INDEX IF NOT EXISTS idx_client_sites_jurisdiction_id ON public.client_sites(jurisdiction_id);
