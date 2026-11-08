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
    SELECT cd.id,cd.org_id,cd.name,cd.activated_at,cd.last_seen_at,cd.revoked_at
    FROM public.clock_devices cd
    WHERE (_org IS NULL OR cd.org_id=_org)
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