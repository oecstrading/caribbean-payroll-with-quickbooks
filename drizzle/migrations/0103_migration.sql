CREATE OR REPLACE FUNCTION public.move_clock_device_company(_id uuid, _org uuid, _name text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE o uuid := public.current_org_id(); BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.clock_devices WHERE id=_id AND org_id=o AND deleted_at IS NULL) OR NOT public.can_admin_clocks(o) OR NOT public.can_admin_clocks(_org) THEN
   RAISE EXCEPTION 'Administrator or Pay Master access to both companies required'; END IF;
 IF _org = o THEN RETURN; END IF;
 IF EXISTS(SELECT 1 FROM public.workforce_punches WHERE device_id=_id) THEN
   RAISE EXCEPTION 'This clock already recorded punches for this company. Delete it and add a new clock in the other company.'; END IF;
 UPDATE public.clock_devices SET org_id=_org, site_id=NULL, name=coalesce(nullif(trim(_name),''),name),
   token_hash=NULL, activated_at=NULL, activation_hash=NULL, activation_expires_at=NULL WHERE id=_id;
 INSERT INTO public.audit_logs(org_id,action,details) VALUES (o,'clock_device_moved',jsonb_build_object('device',_id,'to',_org,'by',auth.uid())),
   (_org,'clock_device_moved',jsonb_build_object('device',_id,'from',o,'by',auth.uid()));
END $$;
REVOKE ALL ON FUNCTION public.move_clock_device_company(uuid,uuid,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.move_clock_device_company(uuid,uuid,text) TO authenticated;