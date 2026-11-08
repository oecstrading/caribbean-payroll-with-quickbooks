CREATE UNIQUE INDEX IF NOT EXISTS workforce_clock_credentials_one_phone_per_employee ON public.workforce_clock_credentials(org_id, bound_device_hash) WHERE bound_device_hash IS NOT NULL;

CREATE OR REPLACE FUNCTION public.claim_clock_device(_org uuid, _employee uuid, _device_hash text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE cur text;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Trusted clock service required'; END IF;
  IF _device_hash IS NULL OR length(_device_hash)<32 THEN RETURN false; END IF;
  SELECT bound_device_hash INTO cur FROM public.workforce_clock_credentials WHERE org_id=_org AND employee_id=_employee FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF cur IS NULL THEN
    -- A phone already registered to a colleague can never become a second employee's clock (prevents buddy punching).
    IF EXISTS (SELECT 1 FROM public.workforce_clock_credentials WHERE org_id=_org AND bound_device_hash=_device_hash AND employee_id<>_employee) THEN RETURN false; END IF;
    UPDATE public.workforce_clock_credentials SET bound_device_hash=_device_hash, bound_at=now() WHERE org_id=_org AND employee_id=_employee;
    RETURN true;
  END IF;
  RETURN cur=_device_hash;
END $$;
REVOKE ALL ON FUNCTION public.claim_clock_device(uuid,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_clock_device(uuid,uuid,text) TO service_role;