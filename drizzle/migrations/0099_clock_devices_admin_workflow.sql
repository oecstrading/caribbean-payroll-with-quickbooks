ALTER TABLE public.clock_devices ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE OR REPLACE FUNCTION public.can_admin_clocks(_org uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT auth.uid() IS NOT NULL AND _org IS NOT NULL AND public.actor_manages_org(auth.uid(), _org) AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS(SELECT 1 FROM public.user_workspace_access WHERE user_id=auth.uid() AND org_id=_org AND access_title='paymaster')
    OR EXISTS(SELECT 1 FROM public.platform_administrators WHERE user_id=auth.uid())
    OR EXISTS(SELECT 1 FROM public.company_super_administrators WHERE user_id=auth.uid() AND org_id=_org))
$$;
CREATE OR REPLACE FUNCTION public.clock_admin_access() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$ SELECT public.can_admin_clocks(public.current_org_id()) $$;

CREATE OR REPLACE FUNCTION public.create_clock_device(_name text, _department text, _site uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions' AS $function$ DECLARE org uuid := public.current_org_id(); code text; d public.clock_devices; BEGIN
 IF NOT public.can_admin_clocks(org) THEN RAISE EXCEPTION 'Administrator or Pay Master required'; END IF;
 IF coalesce(btrim(_name),'') = '' OR length(_name) > 80 THEN RAISE EXCEPTION 'Give the clock a name'; END IF;
 IF _site IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.client_sites WHERE id=_site AND org_id=org) THEN RAISE EXCEPTION 'Work site not found'; END IF;
 code := upper(substr(encode(gen_random_bytes(6),'hex'),1,8));
 INSERT INTO public.clock_devices(org_id,name,department,site_id,activation_hash,activation_expires_at,created_by)
 VALUES(org,btrim(_name),nullif(btrim(coalesce(_department,'')),''),_site,encode(digest(code,'sha256'),'hex'),now()+interval '15 minutes',auth.uid()) RETURNING * INTO d;
 RETURN jsonb_build_object('id',d.id,'code',code,'expires_at',d.activation_expires_at);
END $function$;

CREATE OR REPLACE FUNCTION public.renew_clock_device_code(_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions' AS $function$ DECLARE code text; d public.clock_devices; BEGIN
 SELECT * INTO d FROM public.clock_devices WHERE id=_id AND org_id=public.current_org_id() AND deleted_at IS NULL;
 IF d.id IS NULL OR NOT public.can_admin_clocks(d.org_id) THEN RAISE EXCEPTION 'Administrator or Pay Master required'; END IF;
 code := upper(substr(encode(gen_random_bytes(6),'hex'),1,8));
 UPDATE public.clock_devices SET activation_hash=encode(digest(code,'sha256'),'hex'), activation_expires_at=now()+interval '15 minutes', token_hash=NULL, activated_at=NULL, revoked_at=NULL WHERE id=_id RETURNING * INTO d;
 RETURN jsonb_build_object('id',d.id,'code',code,'expires_at',d.activation_expires_at);
END $function$;

CREATE OR REPLACE FUNCTION public.revoke_clock_device(_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.clock_devices WHERE id=_id AND org_id=public.current_org_id()) OR NOT public.can_admin_clocks(public.current_org_id()) THEN RAISE EXCEPTION 'Administrator or Pay Master required'; END IF;
 UPDATE public.clock_devices SET revoked_at=now(), token_hash=NULL, activation_hash=NULL WHERE id=_id;
END $function$;

-- Deleting keeps the row (hidden) so past punches still show which tablet recorded them.
CREATE OR REPLACE FUNCTION public.delete_clock_device(_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$ DECLARE o uuid := public.current_org_id(); BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.clock_devices WHERE id=_id AND org_id=o) OR NOT public.can_admin_clocks(o) THEN RAISE EXCEPTION 'Administrator or Pay Master required'; END IF;
 UPDATE public.clock_devices SET deleted_at=now(), revoked_at=coalesce(revoked_at,now()), token_hash=NULL, activation_hash=NULL, activation_expires_at=NULL WHERE id=_id;
 INSERT INTO public.audit_logs(org_id,action,details) VALUES (o,'clock_device_deleted',jsonb_build_object('device',_id,'by',auth.uid()));
END $function$;

CREATE OR REPLACE FUNCTION public.admin_reset_employee_clock(_employee uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$ DECLARE o uuid := public.current_org_id(); BEGIN
 IF NOT public.can_admin_clocks(o) THEN RAISE EXCEPTION 'Administrator or Pay Master required'; END IF;
 UPDATE public.workforce_clock_credentials SET bound_device_hash=NULL, bound_at=NULL, failed_attempts=0, locked_until=NULL WHERE org_id=o AND employee_id=_employee;
 IF NOT FOUND THEN RAISE EXCEPTION 'This employee has no clock yet'; END IF;
 INSERT INTO public.audit_logs(org_id,action,details) VALUES (o,'clock_phone_reset',jsonb_build_object('employee',_employee,'by',auth.uid()));
END $function$;

CREATE OR REPLACE FUNCTION public.set_employee_clock_active(_employee uuid, _active boolean, _reason text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$ DECLARE o uuid := public.current_org_id(); BEGIN
 IF NOT public.can_admin_clocks(o) THEN RAISE EXCEPTION 'Administrator or Pay Master required'; END IF;
 UPDATE public.workforce_clock_credentials SET enabled=_active, bound_device_hash=CASE WHEN _active THEN bound_device_hash ELSE NULL END, bound_at=CASE WHEN _active THEN bound_at ELSE NULL END, failed_attempts=0, locked_until=NULL WHERE org_id=o AND employee_id=_employee;
 IF NOT FOUND THEN RAISE EXCEPTION 'This employee has no clock yet. Set one up in their employee folder.'; END IF;
 UPDATE public.workforce_schedules SET enabled=_active WHERE org_id=o AND employee_id=_employee;
 INSERT INTO public.audit_logs(org_id,action,details) VALUES (o, CASE WHEN _active THEN 'employee_clock_restored' ELSE 'employee_clock_removed' END, jsonb_build_object('employee',_employee,'by',auth.uid(),'reason',left(coalesce(_reason,''),200)));
END $function$;

REVOKE ALL ON FUNCTION public.can_admin_clocks(uuid), public.clock_admin_access(), public.delete_clock_device(uuid), public.admin_reset_employee_clock(uuid), public.set_employee_clock_active(uuid,boolean,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_admin_clocks(uuid), public.clock_admin_access(), public.delete_clock_device(uuid), public.admin_reset_employee_clock(uuid), public.set_employee_clock_active(uuid,boolean,text) TO authenticated;