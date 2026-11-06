ALTER TABLE public.user_workspace_access ADD COLUMN IF NOT EXISTS access_title text CHECK (access_title IS NULL OR access_title IN ('employee','paymaster','manager'));

CREATE OR REPLACE FUNCTION public.set_user_workspace_access_titled(_user_id uuid, _title text, _modules text[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _role app_role;
BEGIN
  IF NOT (public.is_company_super_admin(auth.uid()) OR public.is_platform_admin()) THEN
    RAISE EXCEPTION 'Only the Super Admin can assign roles and access';
  END IF;
  IF _title = 'admin' THEN _role := 'admin';
  ELSIF _title IN ('paymaster','manager') THEN _role := 'manager';
  ELSIF _title = 'employee' THEN _role := 'employee';
  ELSE RAISE EXCEPTION 'Invalid role'; END IF;
  IF _title = 'paymaster' AND EXISTS(SELECT 1 FROM unnest(_modules) m WHERE m NOT IN ('hr','payroll','reports','attendance','leave','quickbooks','training')) THEN
    RAISE EXCEPTION 'Pay Master access is limited to payroll management pages';
  END IF;
  PERFORM public.set_user_workspace_access(_user_id, _role, _modules);
  UPDATE public.user_workspace_access SET access_title = CASE WHEN _title='admin' THEN NULL ELSE _title END WHERE user_id=_user_id;
END $$;
REVOKE ALL ON FUNCTION public.set_user_workspace_access_titled(uuid,text,text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_user_workspace_access_titled(uuid,text,text[]) TO authenticated;

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
  SELECT modules, access_title INTO _mods, _title FROM public.user_workspace_access WHERE user_id=_uid AND org_id=_home;
  IF _org <> _home THEN
    IF EXISTS(SELECT 1 FROM public.platform_administrators WHERE user_id=_uid) THEN _roles := ARRAY['admin'];
    ELSIF NOT EXISTS(SELECT 1 FROM public.company_admin_access WHERE user_id=_uid AND org_id=_org) THEN _roles := ARRAY[]::text[];
    ELSE _roles := ARRAY(SELECT unnest(_roles) INTERSECT SELECT unnest(ARRAY['admin','manager'])); END IF;
  END IF;
  RETURN jsonb_build_object('roles',to_jsonb(coalesce(_roles,ARRAY[]::text[])),'modules',to_jsonb(_mods),'jurisdiction',_jur,'title',_title);
END $function$;