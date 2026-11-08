CREATE OR REPLACE FUNCTION public.review_clock_incident(_id uuid,_action text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE i public.clock_incidents; o uuid := public.current_org_id();
BEGIN
  IF o IS NULL OR NOT (public.is_admin_or_manager(auth.uid()) AND public.has_workspace_access(auth.uid(),'attendance')) THEN RAISE EXCEPTION 'Attendance management required'; END IF;
  IF _action NOT IN ('acknowledge','resolve') THEN RAISE EXCEPTION 'Choose acknowledge or resolve'; END IF;
  SELECT * INTO i FROM public.clock_incidents WHERE id=_id AND org_id=o FOR UPDATE;
  IF i.id IS NULL THEN RAISE EXCEPTION 'Clock incident not found'; END IF;
  IF _action='acknowledge' THEN
    UPDATE public.clock_incidents SET status='acknowledged',acknowledged_at=now(),acknowledged_by=auth.uid() WHERE id=i.id;
  ELSE
    UPDATE public.clock_incidents SET status='resolved',resolved_at=now(),resolved_by=auth.uid() WHERE id=i.id;
  END IF;
  INSERT INTO public.audit_logs(org_id,action,details) VALUES(o,'clock_incident_' || _action,jsonb_build_object('incident',i.id,'kind',i.kind,'clock_id',i.clock_id,'by',auth.uid()));
END $$;
REVOKE ALL ON FUNCTION public.review_clock_incident(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.review_clock_incident(uuid,text) TO authenticated;