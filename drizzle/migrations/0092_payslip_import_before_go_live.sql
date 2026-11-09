CREATE OR REPLACE FUNCTION public.enforce_payroll_go_live()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE g date;
BEGIN
  -- Historical pay-slip imports (approve_payslip_import) may record periods before go-live.
  IF current_setting('app.payslip_import', true) = 'on' THEN RETURN new; END IF;
  SELECT start_date INTO g FROM payroll_go_live WHERE org_id = new.org_id;
  IF g IS NOT NULL AND coalesce(new.period_start, new.run_date) < g THEN
    RAISE EXCEPTION 'This company went live on %; payroll before that date cannot be saved', g;
  END IF;
  RETURN new;
END $function$;

DO $do$
DECLARE src text;
BEGIN
  src := pg_get_functiondef('public.approve_payslip_import(date,date,text,jsonb,text)'::regprocedure);
  src := replace(src, 'INSERT INTO public.payroll_runs(period,status', 'PERFORM set_config(''app.payslip_import'',''on'',true);
INSERT INTO public.payroll_runs(period,status');
  src := replace(src, 'RETURNING id INTO run;', 'RETURNING id INTO run;
PERFORM set_config(''app.payslip_import'',''off'',true);');
  EXECUTE src;
END $do$;