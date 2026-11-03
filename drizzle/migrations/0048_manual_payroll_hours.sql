DO $$ DECLARE d text; old text := 'IF EXISTS(SELECT 1 FROM public.workforce_clock_settings WHERE org_id=public.current_org_id() AND attendance_payroll) AND p.hr_details->>''pay_frequency'' IN (''Hourly'',''Daily'') THEN PERFORM public.validate_workforce_pay('; BEGIN
SELECT pg_get_functiondef('public.approve_payroll_run'::regproc) INTO d;
IF position(old IN d)=0 THEN RAISE EXCEPTION 'approve_payroll_run layout changed'; END IF;
d := replace(d, old, 'IF jsonb_typeof(row->''manual_hours'')=''object'' THEN PERFORM public.validate_manual_pay(p.user_id,row->''manual_hours'',f,(row->>''basic_pay'')::numeric,(row->>''overtime_pay'')::numeric); ELSIF EXISTS(SELECT 1 FROM public.workforce_clock_settings WHERE org_id=public.current_org_id() AND attendance_payroll) AND p.hr_details->>''pay_frequency'' IN (''Hourly'',''Daily'') THEN PERFORM public.validate_workforce_pay(');
d := replace(d, 'IF EXISTS(SELECT 1 FROM public.workforce_clock_settings WHERE org_id=public.current_org_id() AND attendance_payroll) AND p.hr_details->>''pay_frequency'' IN (''Hourly'',''Daily'') THEN INSERT INTO public.workforce_payroll_snapshots', 'IF jsonb_typeof(row->''manual_hours'') IS DISTINCT FROM ''object'' AND EXISTS(SELECT 1 FROM public.workforce_clock_settings WHERE org_id=public.current_org_id() AND attendance_payroll) AND p.hr_details->>''pay_frequency'' IN (''Hourly'',''Daily'') THEN INSERT INTO public.workforce_payroll_snapshots');
d := replace(d, 'CREATE OR REPLACE FUNCTION', 'CREATE OR REPLACE FUNCTION');
-- create helper first, then redefine
EXECUTE $f$CREATE OR REPLACE FUNCTION public.validate_manual_pay(_employee uuid,_h jsonb,_factor numeric,_basic numeric,_ot numeric) RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $b$
DECLARE e public.payroll_employee_directory; reg numeric; ot numeric; dt numeric; rate numeric; basis text; expected numeric; overtime numeric; mult numeric;
BEGIN SELECT * INTO e FROM public.payroll_employee_directory WHERE user_id=_employee AND org_id=public.current_org_id(); IF e.user_id IS NULL THEN RAISE EXCEPTION 'Employee company required'; END IF;
reg:=coalesce((_h->>'regular')::numeric,0); ot:=coalesce((_h->>'overtime')::numeric,0); dt:=coalesce((_h->>'double_time')::numeric,0);
IF reg<0 OR ot<0 OR dt<0 OR reg+ot+dt>2000 THEN RAISE EXCEPTION 'Entered hours are not valid'; END IF;
basis:=coalesce(e.hr_details->>'pay_frequency',''); mult:=coalesce(nullif(e.ot_rate,0),1.5);
IF basis='Hourly' THEN rate:=coalesce(nullif(e.hr_details->>'pay_rate',''),'0')::numeric; expected:=round(rate*reg,2);
ELSIF basis='Daily' THEN IF coalesce(e.std_hours_per_day,0)<=0 THEN RAISE EXCEPTION 'Daily hours required'; END IF; rate:=coalesce(nullif(e.hr_details->>'pay_rate',''),'0')::numeric/e.std_hours_per_day; expected:=round(rate*reg,2);
ELSE rate:=coalesce(e.monthly_salary,0)/(coalesce(nullif(e.std_hours_per_day,0),8)*22); expected:=round(coalesce(e.monthly_salary,0)*_factor,2); END IF;
overtime:=round(rate*ot*mult+rate*dt*2,2);
IF _basic IS NULL OR _ot IS NULL OR abs(_basic-expected)>0.01 OR abs(_ot-overtime)>0.01 THEN RAISE EXCEPTION 'Entered hours or pay rate changed; refresh payroll'; END IF; END $b$;$f$;
EXECUTE d; END $$;
REVOKE ALL ON FUNCTION public.validate_manual_pay(uuid,jsonb,numeric,numeric,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_manual_pay(uuid,jsonb,numeric,numeric,numeric) TO authenticated;