CREATE OR REPLACE FUNCTION public.list_activatable_employee_clocks()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('employee_id',e.user_id,'org_id',e.org_id,'company',o.name,
   'name',trim(concat(e.first_name,' ',e.last_name)),'code',c.employee_code,'has_credential',c.employee_id IS NOT NULL,
   'enabled',coalesce(c.enabled,false),'bound',c.bound_device_hash IS NOT NULL,'last_seen_at',c.last_seen_at) ORDER BY o.name,e.first_name,e.last_name)
  FROM public.payroll_employee_directory e JOIN public.organizations o ON o.id=e.org_id
  LEFT JOIN public.workforce_clock_credentials c ON c.org_id=e.org_id AND c.employee_id=e.user_id
  WHERE public.actor_manages_org(auth.uid(), e.org_id)),'[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.bulk_enable_employee_clocks(_items jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$ DECLARE n integer := 0; it jsonb; o uuid; e uuid; BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 IF jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) = 0 OR jsonb_array_length(_items) > 1000 THEN RAISE EXCEPTION 'Choose between 1 and 1000 employees'; END IF;
 FOR it IN SELECT * FROM jsonb_array_elements(_items) LOOP
  o := (it->>'org_id')::uuid; e := (it->>'employee_id')::uuid;
  IF NOT public.actor_manages_org(auth.uid(), o) THEN RAISE EXCEPTION 'Company administrator required for every selected employee'; END IF;
  UPDATE public.workforce_clock_credentials SET enabled=true, failed_attempts=0, locked_until=NULL WHERE org_id=o AND employee_id=e;
  IF FOUND THEN n := n + 1; UPDATE public.workforce_schedules SET enabled=true WHERE org_id=o AND employee_id=e; END IF;
 END LOOP;
 INSERT INTO public.audit_logs(user_id, action, details) SELECT auth.uid(), 'bulk_enable_employee_clocks', jsonb_build_object('count', n) WHERE EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='audit_logs' AND column_name='details');
 RETURN n;
END $$;

REVOKE ALL ON FUNCTION public.list_activatable_employee_clocks() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.bulk_enable_employee_clocks(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_activatable_employee_clocks() TO authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_enable_employee_clocks(jsonb) TO authenticated;