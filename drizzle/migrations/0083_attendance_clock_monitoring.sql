ALTER TABLE public.workforce_clock_credentials ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

CREATE TABLE public.clock_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  clock_type text NOT NULL CHECK (clock_type IN ('shared','personal')),
  clock_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('shared_offline','offline_sync_review')),
  severity text NOT NULL CHECK (severity IN ('high','medium')),
  title text NOT NULL,
  detail text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','resolved')),
  first_detected_at timestamptz NOT NULL DEFAULT now(),
  last_detected_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,
  acknowledged_by uuid,
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.clock_incidents TO authenticated;
GRANT ALL ON public.clock_incidents TO service_role;
ALTER TABLE public.clock_incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Attendance managers read clock incidents" ON public.clock_incidents FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() AND public.is_admin_or_manager(auth.uid()) AND public.has_workspace_access(auth.uid(),'attendance'));
CREATE UNIQUE INDEX clock_incidents_open_key ON public.clock_incidents(org_id,clock_type,clock_id,kind) WHERE status <> 'resolved';
CREATE INDEX clock_incidents_org_status_idx ON public.clock_incidents(org_id,status,last_detected_at DESC);

CREATE OR REPLACE FUNCTION public.scan_clock_health(_org uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  d record;
  p record;
  opened integer := 0;
  before_count integer;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Trusted monitoring service required'; END IF;

  FOR d IN
    SELECT d.id,d.org_id,d.name,d.activated_at,d.last_seen_at,d.revoked_at
    FROM public.clock_devices d
    WHERE (_org IS NULL OR d.org_id=_org)
  LOOP
    IF d.revoked_at IS NULL AND d.activated_at IS NOT NULL AND coalesce(d.last_seen_at,d.activated_at) < now() - interval '15 minutes' THEN
      SELECT count(*) INTO before_count FROM public.clock_incidents i
        WHERE i.org_id=d.org_id AND i.clock_type='shared' AND i.clock_id=d.id AND i.kind='shared_offline' AND i.status <> 'resolved';
      INSERT INTO public.clock_incidents(org_id,clock_type,clock_id,kind,severity,title,detail)
      VALUES (d.org_id,'shared',d.id,'shared_offline','high',d.name || ' is not responding','No heartbeat for more than 15 minutes. Check the tablet power, internet connection and clock app. Punches saved on it still require manager review.')
      ON CONFLICT (org_id,clock_type,clock_id,kind) WHERE status <> 'resolved'
      DO UPDATE SET last_detected_at=now(),severity='high',title=excluded.title,detail=excluded.detail;
      IF before_count=0 THEN opened:=opened+1; END IF;
    ELSE
      UPDATE public.clock_incidents SET status='resolved',resolved_at=now(),resolved_by=NULL
      WHERE org_id=d.org_id AND clock_type='shared' AND clock_id=d.id AND kind='shared_offline' AND status <> 'resolved';
    END IF;
  END LOOP;

  FOR p IN
    SELECT s.org_id,s.employee_id,trim(concat(e.first_name,' ',e.last_name)) AS employee_name,count(pu.id) AS pending_count
    FROM public.workforce_schedules s
    JOIN public.payroll_employee_directory e ON e.org_id=s.org_id AND e.user_id=s.employee_id
    JOIN public.workforce_punches pu ON pu.org_id=s.org_id AND pu.employee_id=s.employee_id AND pu.captured_offline
    JOIN public.workforce_shifts sh ON sh.id=pu.shift_id AND sh.reviewed_at IS NULL AND sh.review_status='pending'
    WHERE (_org IS NULL OR s.org_id=_org) AND s.enabled AND e.deleted_at IS NULL AND lower(e.status)='active'
    GROUP BY s.org_id,s.employee_id,e.first_name,e.last_name
  LOOP
    SELECT count(*) INTO before_count FROM public.clock_incidents i
      WHERE i.org_id=p.org_id AND i.clock_type='personal' AND i.clock_id=p.employee_id AND i.kind='offline_sync_review' AND i.status <> 'resolved';
    INSERT INTO public.clock_incidents(org_id,clock_type,clock_id,kind,severity,title,detail)
    VALUES (p.org_id,'personal',p.employee_id,'offline_sync_review','medium',p.employee_name || ' has offline punches to review',p.pending_count || ' offline punch record(s) have synced but are not yet confirmed. Review the actual time and location before those hours enter payroll.')
    ON CONFLICT (org_id,clock_type,clock_id,kind) WHERE status <> 'resolved'
    DO UPDATE SET last_detected_at=now(),title=excluded.title,detail=excluded.detail;
    IF before_count=0 THEN opened:=opened+1; END IF;
  END LOOP;

  UPDATE public.clock_incidents i SET status='resolved',resolved_at=now(),resolved_by=NULL
  WHERE (_org IS NULL OR i.org_id=_org) AND i.clock_type='personal' AND i.kind='offline_sync_review' AND i.status <> 'resolved'
    AND NOT EXISTS (
      SELECT 1 FROM public.workforce_punches pu
      JOIN public.workforce_shifts sh ON sh.id=pu.shift_id
      WHERE pu.org_id=i.org_id AND pu.employee_id=i.clock_id AND pu.captured_offline AND sh.reviewed_at IS NULL AND sh.review_status='pending'
    );

  RETURN jsonb_build_object(
    'new_incidents',opened,
    'open_incidents',(SELECT count(*) FROM public.clock_incidents i WHERE (_org IS NULL OR i.org_id=_org) AND i.status='open'),
    'checked_at',now()
  );
END $$;
REVOKE ALL ON FUNCTION public.scan_clock_health(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.scan_clock_health(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.clock_monitoring()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE o uuid := public.current_org_id();
BEGIN
  IF o IS NULL OR NOT (public.is_admin_or_manager(auth.uid()) AND public.has_workspace_access(auth.uid(),'attendance')) THEN
    RAISE EXCEPTION 'Attendance management required';
  END IF;
  RETURN jsonb_build_object(
    'generated_at',now(),
    'clocks',(
      SELECT coalesce(jsonb_agg(item ORDER BY item->>'name'),'[]'::jsonb) FROM (
        SELECT jsonb_build_object(
          'id',d.id,'type','shared','name',d.name,'department',d.department,
          'site_id',d.site_id,'site_name',st.name,
          'latitude',coalesce(lp.latitude,st.latitude),'longitude',coalesce(lp.longitude,st.longitude),
          'status',CASE WHEN d.revoked_at IS NOT NULL THEN 'switched_off' WHEN d.activated_at IS NULL THEN 'activation_pending' WHEN d.last_seen_at >= now()-interval '10 minutes' THEN 'online' ELSE 'offline' END,
          'last_seen_at',d.last_seen_at,'last_activity_at',lp.punched_at,
          'current_activity',CASE WHEN lp.employee_id IS NULL THEN 'No tablet punches yet' ELSE trim(concat(pe.first_name,' ',pe.last_name)) || ' · ' || replace(lp.direction,'_',' ') END,
          'punches_today',coalesce(pc.punch_count,0),'activated_at',d.activated_at
        ) AS item
        FROM public.clock_devices d
        LEFT JOIN public.client_sites st ON st.id=d.site_id AND st.org_id=d.org_id
        LEFT JOIN LATERAL (SELECT pu.employee_id,pu.direction,pu.punched_at,pu.latitude,pu.longitude FROM public.workforce_punches pu WHERE pu.org_id=d.org_id AND pu.device_id=d.id ORDER BY pu.punched_at DESC LIMIT 1) lp ON true
        LEFT JOIN public.payroll_employee_directory pe ON pe.org_id=d.org_id AND pe.user_id=lp.employee_id
        LEFT JOIN LATERAL (SELECT count(*) AS punch_count FROM public.workforce_punches pu WHERE pu.org_id=d.org_id AND pu.device_id=d.id AND pu.punched_at >= date_trunc('day',now())) pc ON true
        WHERE d.org_id=o
        UNION ALL
        SELECT jsonb_build_object(
          'id',s.employee_id,'type','personal','name',trim(concat(e.first_name,' ',e.last_name)),'department',e.department,
          'site_id',s.site_id,'site_name',st.name,
          'latitude',coalesce(lp.latitude,st.latitude),'longitude',coalesce(lp.longitude,st.longitude),
          'status',CASE
            WHEN c.employee_id IS NULL OR NOT c.enabled THEN 'not_configured'
            WHEN c.locked_until > now() THEN 'locked'
            WHEN EXISTS (SELECT 1 FROM public.workforce_punches op JOIN public.workforce_shifts osh ON osh.id=op.shift_id WHERE op.org_id=s.org_id AND op.employee_id=s.employee_id AND op.captured_offline AND osh.reviewed_at IS NULL AND osh.review_status='pending') THEN 'sync_review'
            WHEN os.id IS NOT NULL AND os.lunch_out IS NOT NULL AND os.lunch_in IS NULL THEN 'on_lunch'
            WHEN os.id IS NOT NULL THEN 'clocked_in'
            ELSE 'ready' END,
          'last_seen_at',greatest(c.last_seen_at,lp.received_at),'last_activity_at',lp.punched_at,
          'current_activity',CASE WHEN os.id IS NULL THEN coalesce(lp.direction,'No punches yet') WHEN os.lunch_out IS NOT NULL AND os.lunch_in IS NULL THEN 'On lunch' ELSE 'Working · started ' || os.clock_in::text END,
          'punches_today',coalesce(pc.punch_count,0),'bound_at',c.bound_at
        ) AS item
        FROM public.workforce_schedules s
        JOIN public.payroll_employee_directory e ON e.org_id=s.org_id AND e.user_id=s.employee_id AND e.deleted_at IS NULL AND lower(e.status)='active'
        LEFT JOIN public.workforce_clock_credentials c ON c.org_id=s.org_id AND c.employee_id=s.employee_id
        LEFT JOIN public.client_sites st ON st.id=s.site_id AND st.org_id=s.org_id
        LEFT JOIN LATERAL (SELECT pu.direction,pu.punched_at,pu.received_at,pu.latitude,pu.longitude FROM public.workforce_punches pu WHERE pu.org_id=s.org_id AND pu.employee_id=s.employee_id ORDER BY pu.punched_at DESC LIMIT 1) lp ON true
        LEFT JOIN LATERAL (SELECT sh.id,sh.clock_in,sh.lunch_out,sh.lunch_in FROM public.workforce_shifts sh WHERE sh.org_id=s.org_id AND sh.employee_id=s.employee_id AND sh.clock_in IS NOT NULL AND sh.clock_out IS NULL ORDER BY sh.clock_in DESC LIMIT 1) os ON true
        LEFT JOIN LATERAL (SELECT count(*) AS punch_count FROM public.workforce_punches pu WHERE pu.org_id=s.org_id AND pu.employee_id=s.employee_id AND pu.punched_at >= date_trunc('day',now())) pc ON true
        WHERE s.org_id=o AND s.enabled
      ) all_clocks
    ),
    'incidents',(
      SELECT coalesce(jsonb_agg(jsonb_build_object('id',i.id,'clock_type',i.clock_type,'clock_id',i.clock_id,'kind',i.kind,'severity',i.severity,'title',i.title,'detail',i.detail,'status',i.status,'first_detected_at',i.first_detected_at,'last_detected_at',i.last_detected_at) ORDER BY i.last_detected_at DESC),'[]'::jsonb)
      FROM public.clock_incidents i WHERE i.org_id=o AND i.status <> 'resolved'
    )
  );
END $$;
REVOKE ALL ON FUNCTION public.clock_monitoring() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.clock_monitoring() TO authenticated;

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
  INSERT INTO public.audit_logs(org_id,user_id,action,details) VALUES(o,auth.uid(),'clock_incident_' || _action,jsonb_build_object('incident',i.id,'kind',i.kind,'clock_id',i.clock_id));
END $$;
REVOKE ALL ON FUNCTION public.review_clock_incident(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.review_clock_incident(uuid,text) TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.clock_incidents;