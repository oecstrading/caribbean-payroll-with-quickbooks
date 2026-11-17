CREATE OR REPLACE FUNCTION public.has_workspace_access(_user_id uuid, _module text)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
 SELECT public.is_staff(_user_id) AND public.actor_manages_org(_user_id,public.current_org_id()) AND EXISTS(
 SELECT 1 FROM public.user_roles r JOIN public.profiles p ON p.user_id=r.user_id AND p.org_id=r.org_id JOIN public.organizations o ON o.id=public.current_org_id()
 WHERE r.user_id=_user_id AND p.deleted_at IS NULL AND p.status='Active' AND _module=ANY(o.enabled_modules)
 AND (r.role='admin' OR (_module IN ('hr','payroll','reports','attendance','leave','recruitment','field','security','billing','training','quickbooks','settings') AND (r.role='manager' OR _module IN ('attendance','field','security','training')) AND CASE WHEN EXISTS(SELECT 1 FROM public.user_workspace_access a WHERE a.user_id=_user_id AND a.org_id IN (p.org_id, public.current_org_id())) THEN EXISTS(SELECT 1 FROM public.user_workspace_access a WHERE a.user_id=_user_id AND a.org_id IN (p.org_id, public.current_org_id()) AND (_module=ANY(a.modules) OR (a.access_title='paymaster' AND r.role='manager' AND _module<>'settings'))) ELSE true END)))
$function$;

CREATE OR REPLACE FUNCTION public.my_workspace_access()
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); _org uuid := public.current_org_id(); _home uuid; _roles text[]; _mods text[]; _jur text; _title text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  SELECT org_id, jurisdiction INTO _home, _jur FROM public.profiles WHERE user_id=_uid AND deleted_at IS NULL ORDER BY (org_id=_org) DESC LIMIT 1;
  IF _home IS NULL OR NOT public.can_view_company(_org) THEN
    RETURN jsonb_build_object('roles','[]'::jsonb,'modules',NULL,'jurisdiction',NULL,'title',NULL);
  END IF;
  SELECT array_agg(role::text) INTO _roles FROM public.user_roles WHERE user_id=_uid AND org_id=_home;
  SELECT modules, access_title INTO _mods, _title FROM public.user_workspace_access WHERE user_id=_uid AND org_id=_org;
  IF _mods IS NULL THEN
    SELECT modules, access_title INTO _mods, _title FROM public.user_workspace_access WHERE user_id=_uid AND org_id=_home;
  END IF;
  -- Pay Masters get every company page except Company settings.
  IF _title='paymaster' THEN
    _mods := ARRAY['hr','payroll','reports','attendance','leave','recruitment','field','security','billing','training','quickbooks'];
  END IF;
  IF _org <> _home THEN
    IF EXISTS(SELECT 1 FROM public.platform_administrators WHERE user_id=_uid) THEN _roles := ARRAY['admin'];
    ELSIF NOT EXISTS(SELECT 1 FROM public.company_admin_access WHERE user_id=_uid AND org_id=_org) THEN _roles := ARRAY[]::text[];
    ELSE _roles := ARRAY(SELECT unnest(_roles) INTERSECT SELECT unnest(ARRAY['admin','manager'])); END IF;
  END IF;
  RETURN jsonb_build_object('roles',to_jsonb(coalesce(_roles,ARRAY[]::text[])),'modules',to_jsonb(_mods),'jurisdiction',_jur,'title',_title);
END $function$;

UPDATE public.user_workspace_access SET modules = ARRAY['hr','payroll','reports','attendance','leave','recruitment','field','security','billing','training','quickbooks'] WHERE access_title='paymaster';