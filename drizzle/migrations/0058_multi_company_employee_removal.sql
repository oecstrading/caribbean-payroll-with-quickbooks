CREATE OR REPLACE FUNCTION public.actor_manages_org(_actor uuid, _org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _org IS NOT NULL AND (
    EXISTS(SELECT 1 FROM public.profiles WHERE user_id=_actor AND org_id=_org AND deleted_at IS NULL)
    OR (EXISTS(SELECT 1 FROM public.profiles WHERE user_id=_actor AND deleted_at IS NULL) AND (
      EXISTS(SELECT 1 FROM public.platform_administrators WHERE user_id=_actor)
      OR EXISTS(SELECT 1 FROM public.company_admin_access WHERE user_id=_actor AND org_id=_org))))
$$;
REVOKE ALL ON FUNCTION public.actor_manages_org(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.actor_manages_org(uuid,uuid) TO service_role;

DO $do$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.prepare_employee_removal(uuid,uuid,text)'::regprocedure);
  d := replace(d,
    'SELECT org_id INTO org FROM public.profiles WHERE user_id=_actor AND deleted_at IS NULL;',
    'SELECT coalesce((SELECT org_id FROM public.profiles WHERE user_id=_employee AND deleted_at IS NULL),(SELECT org_id FROM public.employee_records WHERE user_id=_employee AND permanently_deleted_at IS NULL),(SELECT org_id FROM public.profiles WHERE user_id=_actor AND deleted_at IS NULL)) INTO org; IF NOT public.actor_manages_org(_actor, org) THEN org := NULL; END IF;');
  IF position('actor_manages_org' in d) = 0 THEN RAISE EXCEPTION 'prepare_employee_removal pattern not found'; END IF;
  EXECUTE d;
  d := pg_get_functiondef('public.finish_employee_removal(uuid,uuid)'::regprocedure);
  d := replace(d,
    'NOT EXISTS(SELECT 1 FROM public.profiles WHERE user_id=_actor AND org_id=j.org_id AND deleted_at IS NULL)',
    'NOT public.actor_manages_org(_actor, j.org_id)');
  IF position('actor_manages_org' in d) = 0 THEN RAISE EXCEPTION 'finish_employee_removal pattern not found'; END IF;
  EXECUTE d;
END $do$;