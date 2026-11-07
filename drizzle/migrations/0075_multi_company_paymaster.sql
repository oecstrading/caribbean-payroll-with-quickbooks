CREATE OR REPLACE FUNCTION public.assign_paymaster_companies(_user uuid, _orgs uuid[], _modules text[]) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE home uuid; previous uuid;
BEGIN
 IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'Platform Super Admin required to assign multiple companies'; END IF;
 IF _user=auth.uid() OR public.has_role(_user,'admin') OR EXISTS(SELECT 1 FROM public.platform_administrators WHERE user_id=_user) THEN RAISE EXCEPTION 'Administrators retain their existing authority; open payroll in any authorized company'; END IF;
 SELECT org_id INTO home FROM public.profiles WHERE user_id=_user AND deleted_at IS NULL AND status='Active';
 IF home IS NULL THEN RAISE EXCEPTION 'Choose an active platform user with a home company'; END IF;
 IF _modules IS NULL OR NOT ('payroll'=ANY(_modules)) OR EXISTS(SELECT 1 FROM unnest(_modules) m WHERE m IS NULL OR m NOT IN ('hr','payroll','reports','attendance','leave','quickbooks','training')) THEN RAISE EXCEPTION 'Choose payroll management tabs'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(coalesce(_orgs,'{}')) x WHERE x IS NULL OR NOT EXISTS(SELECT 1 FROM public.organizations o WHERE o.id=x)) THEN RAISE EXCEPTION 'Invalid company'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('administrator-authority',0));
 PERFORM pg_advisory_xact_lock(hashtext(_user::text));
 SELECT org_id INTO previous FROM public.active_company_selection WHERE user_id=auth.uid();
 PERFORM public.switch_company(home);
 PERFORM public.set_user_workspace_access_titled(_user,'paymaster',_modules);
 PERFORM public.set_company_admin_access(_user,_orgs);
 IF previous IS NULL THEN DELETE FROM public.active_company_selection WHERE user_id=auth.uid(); ELSE PERFORM public.switch_company(previous); END IF;
END $$;
REVOKE ALL ON FUNCTION public.assign_paymaster_companies(uuid,uuid[],text[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.assign_paymaster_companies(uuid,uuid[],text[]) TO authenticated;
COMMENT ON FUNCTION public.assign_paymaster_companies(uuid,uuid[],text[]) IS 'Atomic platform-authorized payroll delegation using existing role and company-access boundaries; never changes employment or administrator authority.';

CREATE OR REPLACE FUNCTION public.has_workspace_access(_user_id uuid, _module text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT public.is_staff(_user_id) AND public.actor_manages_org(_user_id,public.current_org_id()) AND EXISTS(
 SELECT 1 FROM public.user_roles r JOIN public.profiles p ON p.user_id=r.user_id AND p.org_id=r.org_id JOIN public.organizations o ON o.id=public.current_org_id()
 WHERE r.user_id=_user_id AND p.deleted_at IS NULL AND p.status='Active' AND _module=ANY(o.enabled_modules)
 AND (r.role='admin' OR (_module IN ('hr','payroll','reports','attendance','leave','recruitment','field','security','billing','training','quickbooks','settings') AND (r.role='manager' OR _module IN ('attendance','field','security','training')) AND CASE WHEN EXISTS(SELECT 1 FROM public.user_workspace_access a WHERE a.user_id=_user_id AND a.org_id=p.org_id) THEN EXISTS(SELECT 1 FROM public.user_workspace_access a WHERE a.user_id=_user_id AND a.org_id=p.org_id AND _module=ANY(a.modules)) ELSE true END)))
$$;
REVOKE ALL ON FUNCTION public.has_workspace_access(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.has_workspace_access(uuid,text) TO authenticated,service_role;