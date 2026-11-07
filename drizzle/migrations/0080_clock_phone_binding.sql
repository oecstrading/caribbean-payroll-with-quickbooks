ALTER TABLE public.workforce_clock_credentials ADD COLUMN IF NOT EXISTS bound_device_hash text, ADD COLUMN IF NOT EXISTS bound_at timestamptz;

CREATE OR REPLACE FUNCTION public.claim_clock_device(_org uuid, _employee uuid, _device_hash text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE cur text;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Trusted clock service required'; END IF;
  IF _device_hash IS NULL OR length(_device_hash)<32 THEN RETURN false; END IF;
  SELECT bound_device_hash INTO cur FROM public.workforce_clock_credentials WHERE org_id=_org AND employee_id=_employee FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF cur IS NULL THEN
    UPDATE public.workforce_clock_credentials SET bound_device_hash=_device_hash, bound_at=now() WHERE org_id=_org AND employee_id=_employee;
    RETURN true;
  END IF;
  RETURN cur=_device_hash;
END $$;
REVOKE ALL ON FUNCTION public.claim_clock_device(uuid,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_clock_device(uuid,uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION public.clock_phone_bindings()
RETURNS TABLE(employee_id uuid, bound_at timestamptz) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT (public.is_admin_or_manager(auth.uid()) AND public.has_workspace_access(auth.uid(),'attendance')) THEN RAISE EXCEPTION 'Attendance management required'; END IF;
  RETURN QUERY SELECT c.employee_id, c.bound_at FROM public.workforce_clock_credentials c WHERE c.org_id=public.current_org_id() AND c.bound_device_hash IS NOT NULL;
END $$;
REVOKE ALL ON FUNCTION public.clock_phone_bindings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clock_phone_bindings() TO authenticated;

CREATE OR REPLACE FUNCTION public.reset_clock_phone(_employee uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o uuid := public.current_org_id();
BEGIN
  IF o IS NULL OR NOT (public.is_admin_or_manager(auth.uid()) AND public.has_workspace_access(auth.uid(),'attendance')) THEN RAISE EXCEPTION 'Attendance management required'; END IF;
  UPDATE public.workforce_clock_credentials SET bound_device_hash=NULL, bound_at=NULL WHERE org_id=o AND employee_id=_employee;
  INSERT INTO public.audit_logs(org_id,user_id,action,details) VALUES (o,auth.uid(),'clock_phone_reset',jsonb_build_object('employee',_employee));
END $$;
REVOKE ALL ON FUNCTION public.reset_clock_phone(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reset_clock_phone(uuid) TO authenticated;