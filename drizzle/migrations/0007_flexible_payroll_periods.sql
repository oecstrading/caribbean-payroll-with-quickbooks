ALTER TABLE public.payroll_runs ADD COLUMN IF NOT EXISTS pay_type text NOT NULL DEFAULT 'monthly', ADD COLUMN IF NOT EXISTS period_start date, ADD COLUMN IF NOT EXISTS period_end date, ADD COLUMN IF NOT EXISTS notes text;
UPDATE public.payroll_runs SET period_start = (period || '-01')::date, period_end = ((period || '-01')::date + interval '1 month - 1 day')::date WHERE period_start IS NULL AND period ~ '^\d{4}-\d{2}$';

CREATE OR REPLACE FUNCTION public.payroll_period_factor(_pay_type text, _start date, _end date) RETURNS numeric LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE wd integer;
BEGIN
IF _start IS NULL OR _end IS NULL OR _end < _start OR _end - _start > 366 THEN RAISE EXCEPTION 'Choose a valid pay period'; END IF;
IF _pay_type='monthly' THEN
  IF extract(day FROM _start)<>1 OR _end <> (date_trunc('month',_start)+interval '1 month - 1 day')::date THEN RAISE EXCEPTION 'Monthly payroll must cover a full calendar month'; END IF;
  RETURN 1;
ELSIF _pay_type='semi_monthly' THEN
  IF NOT ((extract(day FROM _start)=1 AND extract(day FROM _end)=15 AND date_trunc('month',_start)=date_trunc('month',_end))
       OR (extract(day FROM _start)=16 AND _end=(date_trunc('month',_start)+interval '1 month - 1 day')::date)) THEN RAISE EXCEPTION 'Semi-monthly payroll must cover the 1st–15th or 16th–month end'; END IF;
  RETURN 0.5;
ELSIF _pay_type='weekly' THEN
  IF _end - _start <> 6 THEN RAISE EXCEPTION 'Weekly payroll must cover 7 days'; END IF;
  RETURN 12.0/52;
ELSIF _pay_type='custom' THEN
  SELECT count(*) INTO wd FROM generate_series(_start,_end,interval '1 day') g WHERE extract(isodow FROM g) < 6;
  RETURN wd*12.0/260;
END IF;
RAISE EXCEPTION 'Unsupported pay type';
END $$;

CREATE OR REPLACE FUNCTION public.approve_payroll_run(_pay_type text,_start date,_end date,_jurisdiction text,_departments text[],_rows jsonb,_notes text DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE run uuid; row jsonb; p public.payroll_employee_directory; n integer; ids uuid[] := '{}'; g numeric := 0; d numeric := 0; net numeric := 0; f numeric; _period text;
BEGIN
IF NOT public.is_admin_or_manager(auth.uid()) THEN RAISE EXCEPTION 'Payroll approval requires HR access'; END IF;
f := public.payroll_period_factor(_pay_type,_start,_end);
_period := CASE WHEN _pay_type='monthly' THEN to_char(_start,'YYYY-MM') ELSE to_char(_start,'YYYY-MM-DD') || ' to ' || to_char(_end,'YYYY-MM-DD') END;
IF _jurisdiction IS NULL OR _jurisdiction NOT IN ('LC','AG','KN','DM','GD') THEN RAISE EXCEPTION 'Unsupported payroll jurisdiction'; END IF;
IF coalesce(cardinality(_departments),0)=0 OR jsonb_typeof(_rows) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Select departments and employees'; END IF;
IF _notes IS NOT NULL AND length(_notes)>500 THEN RAISE EXCEPTION 'Notes are too long'; END IF;
n:=jsonb_array_length(_rows); IF n=0 THEN RAISE EXCEPTION 'No employees selected'; END IF;
PERFORM pg_advisory_xact_lock(hashtext('payroll-run-' || _jurisdiction));
FOR row IN SELECT value FROM jsonb_array_elements(_rows) LOOP
SELECT * INTO p FROM public.payroll_employee_directory WHERE user_id=(row->>'user_id')::uuid AND deleted_at IS NULL AND lower(status)='active';
IF NOT FOUND THEN RAISE EXCEPTION 'Employee is not active'; END IF;
IF p.jurisdiction<>_jurisdiction OR NOT(coalesce(nullif(trim(p.department),''),'Unassigned')=ANY(_departments)) OR row->>'department' IS DISTINCT FROM coalesce(nullif(trim(p.department),''),'Unassigned') THEN RAISE EXCEPTION 'Employee department changed; refresh payroll'; END IF;
IF p.user_id=ANY(ids) THEN RAISE EXCEPTION 'Duplicate employee'; END IF; ids:=array_append(ids,p.user_id);
IF EXISTS(SELECT 1 FROM public.payroll_payslip_directory s JOIN public.payroll_runs r ON r.id=s.payroll_run_id WHERE s.user_id=p.user_id AND r.status='approved' AND r.period_start<=_end AND r.period_end>=_start) THEN RAISE EXCEPTION '% % is already paid for part of this period', p.first_name, p.last_name; END IF;
IF abs((row->>'basic_pay')::numeric - round(coalesce(p.monthly_salary,0)*f,2))>0.01 THEN RAISE EXCEPTION 'Salary changed; refresh payroll'; END IF;
IF EXISTS(SELECT 1 FROM unnest(ARRAY['basic_pay','overtime_pay','gross_pay','employee_nic','employer_nic','paye','total_deductions','net_pay']) k WHERE row->>k IS NULL OR (row->>k)::numeric<0 OR (row->>k)::numeric>100000000 OR (row->>k)::numeric<>round((row->>k)::numeric,2)) THEN RAISE EXCEPTION 'Invalid payroll amounts'; END IF;
IF abs((row->>'gross_pay')::numeric-(row->>'total_deductions')::numeric-(row->>'net_pay')::numeric)>0.02 OR (row->>'total_deductions')::numeric+0.01<(row->>'employee_nic')::numeric+(row->>'paye')::numeric THEN RAISE EXCEPTION 'Payroll totals do not reconcile'; END IF;
g:=g+(row->>'gross_pay')::numeric; d:=d+(row->>'total_deductions')::numeric; net:=net+(row->>'net_pay')::numeric;
END LOOP;
IF _pay_type<>'custom' AND (SELECT count(*) FROM public.payroll_employee_directory WHERE deleted_at IS NULL AND lower(status)='active' AND jurisdiction=_jurisdiction AND coalesce(nullif(trim(department),''),'Unassigned')=ANY(_departments))<>n THEN RAISE EXCEPTION 'Employee list changed; refresh payroll'; END IF;
INSERT INTO public.payroll_runs(period,status,total_gross,total_deductions,total_net,employee_count,departments,jurisdiction,currency_code,pay_type,period_start,period_end,notes) VALUES(_period,'approved',g,d,net,n,_departments,_jurisdiction,'XCD',_pay_type,_start,_end,nullif(trim(_notes),'')) RETURNING id INTO run;
FOR row IN SELECT value FROM jsonb_array_elements(_rows) LOOP
SELECT * INTO p FROM public.payroll_employee_directory WHERE user_id=(row->>'user_id')::uuid;
IF p.account_linked THEN
INSERT INTO public.payslips(payroll_run_id,user_id,period,basic_pay,overtime_pay,gross_pay,employee_nic,employer_nic,paye,total_deductions,net_pay,department_snapshot,employee_name_snapshot,currency_code) VALUES(run,p.user_id,_period,(row->>'basic_pay')::numeric,(row->>'overtime_pay')::numeric,(row->>'gross_pay')::numeric,(row->>'employee_nic')::numeric,(row->>'employer_nic')::numeric,(row->>'paye')::numeric,(row->>'total_deductions')::numeric,(row->>'net_pay')::numeric,coalesce(nullif(trim(p.department),''),'Unassigned'),trim(p.first_name || ' ' || p.last_name),'XCD');
ELSE
INSERT INTO public.employee_payslips(payroll_run_id,user_id,period,basic_pay,overtime_pay,gross_pay,employee_nic,employer_nic,paye,total_deductions,net_pay,department_snapshot,employee_name_snapshot,currency_code) VALUES(run,p.user_id,_period,(row->>'basic_pay')::numeric,(row->>'overtime_pay')::numeric,(row->>'gross_pay')::numeric,(row->>'employee_nic')::numeric,(row->>'employer_nic')::numeric,(row->>'paye')::numeric,(row->>'total_deductions')::numeric,(row->>'net_pay')::numeric,coalesce(nullif(trim(p.department),''),'Unassigned'),trim(p.first_name || ' ' || p.last_name),'XCD');
END IF;
END LOOP; RETURN run; END $$;
REVOKE ALL ON FUNCTION public.approve_payroll_run(text,date,date,text,text[],jsonb,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_payroll_run(text,date,date,text,text[],jsonb,text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.approve_department_payroll(text,text,text[],jsonb) FROM PUBLIC, anon, authenticated;
COMMENT ON FUNCTION public.approve_department_payroll(text,text,text[],jsonb) IS 'DEPRECATED: replaced by approve_payroll_run';