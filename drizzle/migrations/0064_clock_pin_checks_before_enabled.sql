CREATE OR REPLACE FUNCTION public.workforce_pin_employee(_org uuid, _code text, _pin text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$ DECLARE c public.workforce_clock_credentials; BEGIN
IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Trusted clock service required'; END IF;
SELECT * INTO c FROM public.workforce_clock_credentials WHERE org_id=_org AND lower(employee_code)=lower(btrim(_code)) LIMIT 1 FOR UPDATE;
IF c.employee_id IS NULL OR c.locked_until>now() OR c.pin_hash IS NULL THEN RETURN NULL; END IF;
IF crypt(btrim(_pin),c.pin_hash)<>c.pin_hash THEN UPDATE public.workforce_clock_credentials SET failed_attempts=failed_attempts+1,locked_until=CASE WHEN failed_attempts>=4 THEN now()+interval '15 minutes' ELSE NULL END WHERE org_id=_org AND employee_id=c.employee_id; RETURN NULL; END IF;
UPDATE public.workforce_clock_credentials SET failed_attempts=0,locked_until=NULL WHERE org_id=_org AND employee_id=c.employee_id;
-- Correct code+PIN: the clock service checks the employee's switched-on schedule and explains when it is off.
RETURN c.employee_id; END $function$;

UPDATE public.workforce_clock_credentials SET enabled=true, failed_attempts=0, locked_until=NULL
 WHERE org_id='03c7c7f7-439a-4512-b2ae-62c6814bfd94' AND employee_id='3ecb1e0f-5f0c-44bd-b064-480a786b38fb';
UPDATE public.workforce_schedules SET enabled=true
 WHERE org_id='03c7c7f7-439a-4512-b2ae-62c6814bfd94' AND employee_id='3ecb1e0f-5f0c-44bd-b064-480a786b38fb';