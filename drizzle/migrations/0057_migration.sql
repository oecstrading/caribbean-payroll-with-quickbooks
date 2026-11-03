CREATE OR REPLACE FUNCTION public.link_employee_login(_actor uuid, _employee uuid, _user uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$ DECLARE company uuid; BEGIN
IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Trusted account service required'; END IF;
SELECT org_id INTO company FROM public.profiles WHERE user_id=_user AND deleted_at IS NULL AND is_employee=false;
IF company IS NULL THEN RAISE EXCEPTION 'Separate company login required'; END IF;
IF NOT public.has_role(_actor,'admin') OR NOT public.has_workspace_access(_actor,'hr') OR NOT (
  EXISTS(SELECT 1 FROM public.profiles WHERE user_id=_actor AND org_id=company AND deleted_at IS NULL)
  OR EXISTS(SELECT 1 FROM public.platform_administrators WHERE user_id=_actor)
  OR EXISTS(SELECT 1 FROM public.company_admin_access WHERE user_id=_actor AND org_id=company))
THEN RAISE EXCEPTION 'Company administrator with HR access required'; END IF;
PERFORM 1 FROM public.employee_records WHERE user_id=_employee AND org_id=company AND deleted_at IS NULL AND permanently_deleted_at IS NULL AND login_user_id IS NULL FOR UPDATE;
IF NOT FOUND THEN RAISE EXCEPTION 'Employee already linked or unavailable'; END IF;
UPDATE public.employee_records SET login_user_id=_user WHERE user_id=_employee AND org_id=company;
END $function$;