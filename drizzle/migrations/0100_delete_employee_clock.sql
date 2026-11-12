CREATE OR REPLACE FUNCTION public.delete_employee_clock(_employee uuid, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE o uuid := public.current_org_id(); BEGIN
 IF NOT public.can_admin_clocks(o) THEN RAISE EXCEPTION 'Administrator or Pay Master required'; END IF;
 DELETE FROM public.workforce_clock_credentials WHERE org_id=o AND employee_id=_employee;
 IF NOT FOUND THEN RAISE EXCEPTION 'This employee has no clock to delete.'; END IF;
 UPDATE public.workforce_schedules SET enabled=false WHERE org_id=o AND employee_id=_employee;
 INSERT INTO public.audit_logs(org_id,action,details) VALUES (o,'employee_clock_deleted',jsonb_build_object('employee',_employee,'by',auth.uid(),'reason',left(coalesce(_reason,''),200)));
END $$;
REVOKE ALL ON FUNCTION public.delete_employee_clock(uuid,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.delete_employee_clock(uuid,text) TO authenticated;