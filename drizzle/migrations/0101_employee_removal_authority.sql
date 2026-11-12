CREATE OR REPLACE FUNCTION public.can_remove_employees(_actor uuid, _org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT _actor IS NOT NULL AND _org IS NOT NULL AND public.actor_manages_org(_actor,_org) AND (
    public.has_role(_actor,'admin'::public.app_role)
    OR EXISTS(SELECT 1 FROM public.user_workspace_access WHERE user_id=_actor AND org_id=_org AND access_title='paymaster')
    OR EXISTS(SELECT 1 FROM public.platform_administrators WHERE user_id=_actor)
    OR EXISTS(SELECT 1 FROM public.company_super_administrators WHERE user_id=_actor AND org_id=_org))
$$;
REVOKE ALL ON FUNCTION public.can_remove_employees(uuid,uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.can_remove_employees(uuid,uuid) TO authenticated, service_role;

DO $do$ DECLARE src text; BEGIN
  SELECT pg_get_functiondef('public.prepare_employee_removal(uuid,uuid,text)'::regprocedure) INTO src;
  src := replace(src, $x$IF org IS NULL OR NOT public.has_role(_actor,'admin') OR NOT public.has_workspace_access(_actor,'hr') THEN RAISE EXCEPTION 'Company administrator with HR access required'$x$, $x$IF org IS NULL OR NOT public.can_remove_employees(_actor, org) THEN RAISE EXCEPTION 'Administrator or Pay Master for this company required'$x$);
  IF position('can_remove_employees' in src)=0 THEN RAISE EXCEPTION 'prepare patch failed'; END IF;
  EXECUTE src;
  SELECT pg_get_functiondef('public.finish_employee_removal(uuid,uuid)'::regprocedure) INTO src;
  src := replace(src, $x$NOT public.has_role(_actor,'admin') OR NOT public.has_workspace_access(_actor,'hr') OR NOT public.actor_manages_org(_actor, j.org_id)$x$, $x$NOT public.can_remove_employees(_actor, j.org_id)$x$);
  IF position('can_remove_employees' in src)=0 THEN RAISE EXCEPTION 'finish patch failed'; END IF;
  EXECUTE src;
END $do$;