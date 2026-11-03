CREATE OR REPLACE FUNCTION public.my_workspace_access()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _org uuid := public.current_org_id(); _home uuid; _roles text[]; _mods text[]; _jur text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  SELECT org_id, jurisdiction INTO _home, _jur FROM public.profiles WHERE user_id=_uid AND deleted_at IS NULL ORDER BY (org_id=_org) DESC LIMIT 1;
  IF _home IS NULL OR NOT public.can_view_company(_org) THEN
    RETURN jsonb_build_object('roles','[]'::jsonb,'modules',NULL,'jurisdiction',NULL);
  END IF;
  SELECT array_agg(role::text) INTO _roles FROM public.user_roles WHERE user_id=_uid AND org_id=_home;
  SELECT modules INTO _mods FROM public.user_workspace_access WHERE user_id=_uid AND org_id=_home;
  IF _org <> _home THEN
    IF EXISTS(SELECT 1 FROM public.platform_administrators WHERE user_id=_uid) THEN _roles := ARRAY['admin'];
    ELSIF NOT EXISTS(SELECT 1 FROM public.company_admin_access WHERE user_id=_uid AND org_id=_org) THEN _roles := ARRAY[]::text[];
    ELSE _roles := ARRAY(SELECT unnest(_roles) INTERSECT SELECT unnest(ARRAY['admin','manager'])); END IF;
  END IF;
  RETURN jsonb_build_object('roles',to_jsonb(coalesce(_roles,ARRAY[]::text[])),'modules',to_jsonb(_mods),'jurisdiction',_jur);
END $$;
REVOKE ALL ON FUNCTION public.my_workspace_access() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_workspace_access() TO authenticated;