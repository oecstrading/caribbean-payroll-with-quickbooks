CREATE TABLE public.staff_pay_requests(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 org_id uuid NOT NULL,
 employee_id uuid NOT NULL,
 kind text NOT NULL,
 shift_id uuid REFERENCES public.workforce_shifts(id) ON DELETE SET NULL,
 shift_date date,
 requested_clock_in timestamptz,
 requested_clock_out timestamptz,
 reason text NOT NULL,
 status text NOT NULL DEFAULT 'pending',
 review_note text,
 reviewed_by uuid,
 reviewed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.staff_pay_requests TO authenticated;
GRANT ALL ON public.staff_pay_requests TO service_role;
ALTER TABLE public.staff_pay_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own or manager read pay requests" ON public.staff_pay_requests FOR SELECT TO authenticated
USING (org_id=public.current_org_id() AND (employee_id=auth.uid() OR (public.is_admin_or_manager(auth.uid()) AND public.has_workspace_access(auth.uid(),'attendance'))));
CREATE INDEX ON public.staff_pay_requests(org_id,status);

CREATE OR REPLACE FUNCTION public.submit_staff_pay_request(_kind text,_shift uuid,_date date,_in timestamptz,_out timestamptz,_reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o uuid:=public.current_org_id(); s public.workforce_shifts; r uuid;
BEGIN
 IF auth.uid() IS NULL OR o IS NULL OR public.employee_org_id(auth.uid()) IS DISTINCT FROM o THEN RAISE EXCEPTION 'Staff sign-in required'; END IF;
 IF _kind NOT IN ('punch_correction','pay_dispute') THEN RAISE EXCEPTION 'Unknown request type'; END IF;
 IF length(trim(coalesce(_reason,'')))<5 OR length(_reason)>1000 THEN RAISE EXCEPTION 'Explain the request in at least 5 characters'; END IF;
 IF _shift IS NOT NULL THEN
  SELECT * INTO s FROM public.workforce_shifts WHERE id=_shift AND org_id=o AND employee_id=auth.uid();
  IF s.id IS NULL THEN RAISE EXCEPTION 'Shift not found'; END IF;
 END IF;
 IF _kind='punch_correction' THEN
  IF s.id IS NULL OR _in IS NULL OR _out IS NULL OR _out<=_in OR _out-_in>interval '24 hours' THEN RAISE EXCEPTION 'Choose the shift and valid clock-in and clock-out times'; END IF;
  IF EXISTS(SELECT 1 FROM public.staff_pay_requests WHERE shift_id=_shift AND status='pending') THEN RAISE EXCEPTION 'A correction is already waiting for review'; END IF;
 END IF;
 INSERT INTO public.staff_pay_requests(org_id,employee_id,kind,shift_id,shift_date,requested_clock_in,requested_clock_out,reason)
 VALUES(o,auth.uid(),_kind,_shift,coalesce(s.shift_date,_date),_in,_out,trim(_reason)) RETURNING id INTO r;
 INSERT INTO public.audit_logs(org_id,employee_id,action,details) VALUES(o,auth.uid(),'staff_request_submitted',jsonb_build_object('request_id',r,'kind',_kind));
 RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.review_staff_pay_request(_id uuid,_approve boolean,_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE q public.staff_pay_requests; s public.workforce_shifts; h numeric;
BEGIN
 IF NOT public.is_admin_or_manager(auth.uid()) OR NOT public.has_workspace_access(auth.uid(),'attendance') THEN RAISE EXCEPTION 'Attendance manager required'; END IF;
 IF length(trim(coalesce(_note,'')))<3 THEN RAISE EXCEPTION 'Add a review note'; END IF;
 SELECT * INTO q FROM public.staff_pay_requests WHERE id=_id AND org_id=public.current_org_id() FOR UPDATE;
 IF q.id IS NULL OR q.status<>'pending' THEN RAISE EXCEPTION 'Request is not pending'; END IF;
 IF _approve AND q.kind='punch_correction' THEN
  SELECT * INTO s FROM public.workforce_shifts WHERE id=q.shift_id;
  h:=greatest(0,extract(epoch FROM q.requested_clock_out-q.requested_clock_in)/3600-coalesce(s.break_minutes,0)/60.0);
  PERFORM public.review_workforce_shift(q.shift_id,h,'Staff correction approved: '||_note);
 END IF;
 UPDATE public.staff_pay_requests SET status=CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,review_note=_note,reviewed_by=auth.uid(),reviewed_at=now() WHERE id=_id;
 INSERT INTO public.audit_logs(org_id,employee_id,action,details) VALUES(q.org_id,q.employee_id,'staff_request_reviewed',jsonb_build_object('request_id',_id,'approved',_approve));
END $$;

CREATE OR REPLACE FUNCTION public.my_pay_preview(_start date,_end date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE o uuid:=public.current_org_id(); cfg public.workforce_clock_settings; total numeric; pending int; cnt int; ot numeric:=0; hr jsonb; sal numeric;
BEGIN
 IF auth.uid() IS NULL OR public.employee_org_id(auth.uid()) IS DISTINCT FROM o THEN RAISE EXCEPTION 'Staff sign-in required'; END IF;
 SELECT * INTO cfg FROM public.workforce_clock_settings WHERE org_id=o;
 SELECT count(*),count(*) FILTER(WHERE approved_hours IS NULL),coalesce(sum(approved_hours),0) INTO cnt,pending,total FROM public.workforce_shifts WHERE org_id=o AND employee_id=auth.uid() AND shift_date BETWEEN _start AND _end;
 IF cfg.overtime_basis='daily' THEN SELECT coalesce(sum(greatest(0,approved_hours-cfg.overtime_threshold)),0) INTO ot FROM public.workforce_shifts WHERE org_id=o AND employee_id=auth.uid() AND shift_date BETWEEN _start AND _end;
 ELSE SELECT coalesce(sum(greatest(0,x-coalesce(cfg.overtime_threshold,40))),0) INTO ot FROM (SELECT sum(approved_hours) x FROM public.workforce_shifts WHERE org_id=o AND employee_id=auth.uid() AND shift_date BETWEEN _start AND _end GROUP BY date_trunc('week',shift_date)) w; END IF;
 SELECT hr_details,monthly_salary INTO hr,sal FROM public.profiles WHERE user_id=auth.uid() AND org_id=o;
 RETURN jsonb_build_object('hours',total,'regular',total-ot,'overtime',ot,'pending',pending,'shifts',cnt,'multiplier',coalesce(cfg.overtime_multiplier,1.5),
  'pay_frequency',coalesce(hr->>'pay_frequency',''),'pay_rate',coalesce(nullif(hr->>'pay_rate','')::numeric,0),'monthly_salary',coalesce(sal,0));
END $$;
GRANT EXECUTE ON FUNCTION public.submit_staff_pay_request(text,uuid,date,timestamptz,timestamptz,text), public.review_staff_pay_request(uuid,boolean,text), public.my_pay_preview(date,date) TO authenticated;