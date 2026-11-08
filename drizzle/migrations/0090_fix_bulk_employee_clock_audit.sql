CREATE OR REPLACE FUNCTION public.bulk_enable_employee_clocks(_items jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$ DECLARE n integer := 0; it jsonb; o uuid; e uuid; BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 IF jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) = 0 OR jsonb_array_length(_items) > 1000 THEN RAISE EXCEPTION 'Choose between 1 and 1000 employees'; END IF;
 FOR it IN SELECT * FROM jsonb_array_elements(_items) LOOP
  o := (it->>'org_id')::uuid; e := (it->>'employee_id')::uuid;
  IF NOT public.actor_manages_org(auth.uid(), o) THEN RAISE EXCEPTION 'Company administrator required for every selected employee'; END IF;
  UPDATE public.workforce_clock_credentials SET enabled=true, failed_attempts=0, locked_until=NULL WHERE org_id=o AND employee_id=e;
  IF FOUND THEN
    n := n + 1;
    UPDATE public.workforce_schedules SET enabled=true WHERE org_id=o AND employee_id=e;
    INSERT INTO public.audit_logs(org_id, employee_id, action, details) VALUES (o, e, 'employee_clock_enabled', jsonb_build_object('by', auth.uid(), 'bulk', true));
  END IF;
 END LOOP;
 RETURN n;
END $$;