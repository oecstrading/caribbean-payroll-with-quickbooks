CREATE TABLE public.company_admin_access (
  user_id uuid NOT NULL,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  granted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, org_id)
);
GRANT SELECT ON public.company_admin_access TO authenticated;
GRANT ALL ON public.company_admin_access TO service_role;
ALTER TABLE public.company_admin_access ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.active_company_selection (
  user_id uuid PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.active_company_selection TO authenticated;
GRANT ALL ON public.active_company_selection TO service_role;
ALTER TABLE public.active_company_selection ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_view_company(_org uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT _org IS NOT NULL AND (
    EXISTS(SELECT 1 FROM public.platform_administrators WHERE user_id=auth.uid())
    OR EXISTS(SELECT 1 FROM public.profiles WHERE user_id=auth.uid() AND org_id=_org)
    OR EXISTS(SELECT 1 FROM public.company_admin_access a WHERE a.user_id=auth.uid() AND a.org_id=_org
              AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')))
  ) $$;

CREATE POLICY "Own or platform reads access" ON public.company_admin_access FOR SELECT TO authenticated
  USING (user_id=auth.uid() OR public.is_platform_admin());
CREATE POLICY "Own selection" ON public.active_company_selection FOR SELECT TO authenticated
  USING (user_id=auth.uid());

CREATE OR REPLACE FUNCTION public.current_org_id() RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE result uuid; chosen uuid;
BEGIN
  SELECT org_id INTO chosen FROM public.active_company_selection WHERE user_id=auth.uid();
  IF chosen IS NOT NULL AND public.can_view_company(chosen) THEN RETURN chosen; END IF;
  SELECT org_id INTO result FROM public.profiles WHERE user_id=auth.uid() LIMIT 1;
  RETURN result;
END $function$;

CREATE OR REPLACE FUNCTION public.my_companies() RETURNS TABLE(id uuid, name text, is_home boolean, is_current boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT o.id, o.name,
    o.id = (SELECT org_id FROM public.profiles WHERE user_id=auth.uid() LIMIT 1),
    o.id = public.current_org_id()
  FROM public.organizations o WHERE public.can_view_company(o.id) ORDER BY o.name $$;

CREATE OR REPLACE FUNCTION public.switch_company(_org uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_view_company(_org) THEN RAISE EXCEPTION 'You do not have access to that company'; END IF;
  INSERT INTO public.active_company_selection(user_id, org_id) VALUES (auth.uid(), _org)
  ON CONFLICT (user_id) DO UPDATE SET org_id=EXCLUDED.org_id, updated_at=now();
END $$;

CREATE OR REPLACE FUNCTION public.set_company_admin_access(_user uuid, _orgs uuid[]) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'Only a platform super administrator can assign companies'; END IF;
  IF NOT (public.has_role(_user,'admin') OR public.has_role(_user,'manager')) THEN RAISE EXCEPTION 'Only administrators or managers can be given multi-company access'; END IF;
  DELETE FROM public.company_admin_access WHERE user_id=_user AND NOT (org_id = ANY(coalesce(_orgs,'{}')));
  INSERT INTO public.company_admin_access(user_id, org_id, granted_by)
  SELECT _user, o, auth.uid() FROM unnest(coalesce(_orgs,'{}')) o ON CONFLICT DO NOTHING;
  DELETE FROM public.active_company_selection s WHERE s.user_id=_user
    AND s.org_id NOT IN (SELECT org_id FROM public.company_admin_access WHERE user_id=_user)
    AND s.org_id IS DISTINCT FROM (SELECT org_id FROM public.profiles WHERE user_id=_user LIMIT 1);
END $$;

CREATE OR REPLACE FUNCTION public.multi_company_admins() RETURNS TABLE(user_id uuid, name text, email text, home_company text, org_ids uuid[])
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'Platform super administrator required'; END IF;
  RETURN QUERY SELECT p.user_id, trim(coalesce(p.first_name,'')||' '||coalesce(p.last_name,'')), p.email, o.name,
    coalesce((SELECT array_agg(a.org_id) FROM public.company_admin_access a WHERE a.user_id=p.user_id), '{}')
  FROM public.profiles p LEFT JOIN public.organizations o ON o.id=p.org_id
  WHERE p.user_id IS NOT NULL AND p.deleted_at IS NULL
    AND EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=p.user_id AND r.role IN ('admin','manager'))
    AND NOT EXISTS(SELECT 1 FROM public.platform_administrators pa WHERE pa.user_id=p.user_id)
  ORDER BY 2;
END $$;

CREATE OR REPLACE FUNCTION public.companies_overview() RETURNS TABLE(id uuid, name text, active_employees bigint, last_period text, last_net numeric, open_alerts bigint, pending_runs bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT o.id, o.name,
    (SELECT count(*) FROM public.payroll_employee_directory d WHERE d.org_id=o.id AND d.deleted_at IS NULL AND lower(coalesce(d.status,''))='active'),
    (SELECT r.period FROM public.payroll_runs r WHERE r.org_id=o.id ORDER BY coalesce(r.period_end, r.run_date::date) DESC NULLS LAST, r.created_at DESC LIMIT 1),
    (SELECT r.total_net FROM public.payroll_runs r WHERE r.org_id=o.id ORDER BY coalesce(r.period_end, r.run_date::date) DESC NULLS LAST, r.created_at DESC LIMIT 1),
    (SELECT count(*) FROM public.workforce_alerts w WHERE w.org_id=o.id AND w.resolved_at IS NULL),
    (SELECT count(*) FROM public.payroll_runs r WHERE r.org_id=o.id AND lower(coalesce(r.status,'')) IN ('draft','pending'))
  FROM public.organizations o
  WHERE public.can_view_company(o.id) AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.is_platform_admin())
  ORDER BY o.name $$;

REVOKE EXECUTE ON FUNCTION public.my_companies(), public.switch_company(uuid), public.set_company_admin_access(uuid, uuid[]), public.multi_company_admins(), public.companies_overview(), public.can_view_company(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.my_companies(), public.switch_company(uuid), public.set_company_admin_access(uuid, uuid[]), public.multi_company_admins(), public.companies_overview(), public.can_view_company(uuid) TO authenticated;