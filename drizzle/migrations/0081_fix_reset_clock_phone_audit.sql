CREATE OR REPLACE FUNCTION public.reset_clock_phone(_employee uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o uuid := public.current_org_id();
BEGIN
  IF o IS NULL OR NOT (public.is_admin_or_manager(auth.uid()) AND public.has_workspace_access(auth.uid(),'attendance')) THEN RAISE EXCEPTION 'Attendance management required'; END IF;
  UPDATE public.workforce_clock_credentials SET bound_device_hash=NULL, bound_at=NULL WHERE org_id=o AND employee_id=_employee;
  INSERT INTO public.audit_logs(org_id,action,details) VALUES (o,'clock_phone_reset',jsonb_build_object('employee',_employee,'by',auth.uid()));
END $$;