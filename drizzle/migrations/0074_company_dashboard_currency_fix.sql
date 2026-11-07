CREATE OR REPLACE FUNCTION public.company_dashboard_summaries(_all boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $fn$
DECLARE _uid uuid := auth.uid(); _home uuid; _roles text[]; _mods text[]; _platform boolean; _out jsonb;
BEGIN
 IF _uid IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 SELECT org_id INTO _home FROM public.profiles WHERE user_id=_uid AND deleted_at IS NULL LIMIT 1;
 SELECT array_agg(role::text) INTO _roles FROM public.user_roles WHERE user_id=_uid AND org_id=_home;
 SELECT modules INTO _mods FROM public.user_workspace_access WHERE user_id=_uid AND org_id=_home;
 _platform := public.is_platform_admin();
 IF NOT (_platform OR coalesce(_roles && ARRAY['admin','manager'],false)) THEN RETURN '[]'::jsonb; END IF;
 WITH allowed AS (
 SELECT o.*, ARRAY(SELECT unnest(o.enabled_modules) INTERSECT SELECT unnest(CASE WHEN _platform OR 'admin'=ANY(_roles) THEN o.enabled_modules ELSE coalesce(_mods,ARRAY['hr','payroll','reports','attendance','leave','recruitment','field','security','billing','training','quickbooks','settings']) END)) AS mods
 FROM public.organizations o WHERE public.can_view_company(o.id) AND (_all OR o.id=public.current_org_id())
 ), summaries AS (
 SELECT o.id,o.name,
 CASE WHEN o.mods && ARRAY['hr','payroll','reports'] THEN e.employees END AS employees,
 CASE WHEN o.mods && ARRAY['hr','payroll','reports'] THEN e.active_employees END AS active_employees,
 CASE WHEN o.mods && ARRAY['hr','payroll','reports'] THEN e.monthly_salaries END AS monthly_salaries,
 CASE WHEN o.mods && ARRAY['payroll','reports'] THEN coalesce(p.gross,0) END AS gross,
 CASE WHEN o.mods && ARRAY['payroll','reports'] THEN coalesce(p.net,0) END AS net,
 CASE WHEN o.mods && ARRAY['payroll','reports'] THEN coalesce(p.deductions,0) END AS deductions,
 CASE WHEN o.mods && ARRAY['payroll','reports'] THEN latest.period END AS period,
 CASE WHEN o.mods && ARRAY['payroll','reports'] THEN latest.period_start END AS period_start,
 CASE WHEN o.mods && ARRAY['payroll','reports'] THEN latest.period_end END AS period_end,
 coalesce(latest.currency_code,(SELECT j.currency_code FROM public.jurisdictions j WHERE j.code=o.onboarding_config->>'jurisdiction'), 'XCD') AS currency,
 CASE WHEN 'attendance'=ANY(o.mods) THEN (SELECT count(DISTINCT s.employee_id) FROM public.workforce_shifts s WHERE s.org_id=o.id AND s.shift_date=current_date AND s.clock_in IS NOT NULL AND s.clock_out IS NULL AND EXISTS(SELECT 1 FROM public.payroll_employee_directory d WHERE d.org_id=o.id AND d.user_id=s.employee_id AND d.deleted_at IS NULL)) END AS on_clock,
 CASE WHEN 'attendance'=ANY(o.mods) THEN (SELECT count(*) FROM public.workforce_alerts a WHERE a.org_id=o.id AND a.resolved_at IS NULL) END AS open_alerts,
 CASE WHEN 'attendance'=ANY(o.mods) THEN (SELECT count(*) FROM public.workforce_shifts s WHERE s.org_id=o.id AND s.shift_date BETWEEN current_date-6 AND current_date AND s.clock_in > s.scheduled_start + interval '5 minutes') END AS late_arrivals,
 CASE WHEN o.mods && ARRAY['payroll','reports'] THEN (SELECT count(*) FROM public.payroll_runs r WHERE r.org_id=o.id AND lower(r.status) IN ('draft','pending')) END AS pending_runs
 FROM allowed o
 CROSS JOIN LATERAL (SELECT count(*) AS employees,count(*) FILTER(WHERE lower(d.status)='active') AS active_employees,coalesce(sum(d.monthly_salary) FILTER(WHERE lower(d.status)='active'),0) AS monthly_salaries FROM public.payroll_employee_directory d WHERE d.org_id=o.id AND d.deleted_at IS NULL) e
 LEFT JOIN LATERAL (SELECT r.* FROM public.payroll_runs r WHERE r.org_id=o.id AND lower(r.status) IN ('approved','completed','paid') ORDER BY coalesce(r.period_end,r.run_date) DESC,r.created_at DESC LIMIT 1) latest ON true
 LEFT JOIN LATERAL (SELECT sum(r.total_gross) gross,sum(r.total_net) net,sum(r.total_deductions) deductions FROM public.payroll_runs r WHERE r.org_id=o.id AND lower(r.status) IN ('approved','completed','paid') AND r.period_start IS NOT DISTINCT FROM latest.period_start AND r.period_end IS NOT DISTINCT FROM latest.period_end AND r.period=latest.period AND r.pay_type IS NOT DISTINCT FROM latest.pay_type AND r.currency_code IS NOT DISTINCT FROM latest.currency_code) p ON true
 ) SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.name),'[]'::jsonb) INTO _out FROM summaries s;
 RETURN _out;
END $fn$;
REVOKE ALL ON FUNCTION public.company_dashboard_summaries(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.company_dashboard_summaries(boolean) TO authenticated,service_role;