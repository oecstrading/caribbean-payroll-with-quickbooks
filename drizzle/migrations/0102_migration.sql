CREATE OR REPLACE FUNCTION public.move_clock_device(_org uuid, _employee uuid, _device_hash text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE recent int;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Trusted clock service required'; END IF;
  IF _device_hash IS NULL OR length(_device_hash)<32 THEN RETURN 'invalid'; END IF;
  PERFORM 1 FROM public.workforce_clock_credentials WHERE org_id=_org AND employee_id=_employee FOR UPDATE;
  IF NOT FOUND THEN RETURN 'invalid'; END IF;
  -- A phone that already clocks for a colleague can never take over another employee's clock (anti buddy-punching).
  IF EXISTS (SELECT 1 FROM public.workforce_clock_credentials WHERE org_id=_org AND bound_device_hash=_device_hash AND employee_id<>_employee) THEN RETURN 'other_employee'; END IF;
  SELECT count(*) INTO recent FROM public.audit_logs WHERE org_id=_org AND employee_id=_employee AND action='clock_phone_moved' AND created_at > now() - interval '7 days';
  IF recent >= 3 THEN RETURN 'too_many'; END IF;
  UPDATE public.workforce_clock_credentials SET bound_device_hash=_device_hash, bound_at=now() WHERE org_id=_org AND employee_id=_employee;
  INSERT INTO public.audit_logs(org_id, employee_id, action, details) VALUES (_org, _employee, 'clock_phone_moved', jsonb_build_object('by','employee_code_and_pin','moves_last_7_days',recent+1));
  RETURN 'moved';
END $$;
REVOKE ALL ON FUNCTION public.move_clock_device(uuid,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.move_clock_device(uuid,uuid,text) TO service_role;