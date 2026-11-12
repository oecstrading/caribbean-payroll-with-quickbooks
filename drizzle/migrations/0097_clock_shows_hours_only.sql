-- Employee clocks show hours only: the pay preview no longer carries pay rates or salary.
CREATE OR REPLACE FUNCTION public.my_pay_preview(_start date,_end date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE o uuid:=public.current_org_id(); cfg public.workforce_clock_settings; total numeric; pending int; cnt int; ot numeric:=0;
BEGIN
 IF auth.uid() IS NULL OR public.employee_org_id(auth.uid()) IS DISTINCT FROM o THEN RAISE EXCEPTION 'Staff sign-in required'; END IF;
 SELECT * INTO cfg FROM public.workforce_clock_settings WHERE org_id=o;
 SELECT count(*),count(*) FILTER(WHERE approved_hours IS NULL),coalesce(sum(approved_hours),0) INTO cnt,pending,total FROM public.workforce_shifts WHERE org_id=o AND employee_id=auth.uid() AND shift_date BETWEEN _start AND _end;
 IF cfg.overtime_basis='daily' THEN SELECT coalesce(sum(greatest(0,approved_hours-cfg.overtime_threshold)),0) INTO ot FROM public.workforce_shifts WHERE org_id=o AND employee_id=auth.uid() AND shift_date BETWEEN _start AND _end;
 ELSE SELECT coalesce(sum(greatest(0,x-coalesce(cfg.overtime_threshold,40))),0) INTO ot FROM (SELECT sum(approved_hours) x FROM public.workforce_shifts WHERE org_id=o AND employee_id=auth.uid() AND shift_date BETWEEN _start AND _end GROUP BY date_trunc('week',shift_date)) w; END IF;
 RETURN jsonb_build_object('hours',total,'regular',total-ot,'overtime',ot,'pending',pending,'shifts',cnt);
END $$;
GRANT EXECUTE ON FUNCTION public.my_pay_preview(date,date) TO authenticated;