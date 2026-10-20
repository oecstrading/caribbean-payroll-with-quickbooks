ALTER TABLE public.payroll_runs ADD COLUMN IF NOT EXISTS departments text[] NOT NULL DEFAULT '{}', ADD COLUMN IF NOT EXISTS jurisdiction text, ADD COLUMN IF NOT EXISTS currency_code text;
ALTER TABLE public.payslips ADD COLUMN IF NOT EXISTS department_snapshot text, ADD COLUMN IF NOT EXISTS employee_name_snapshot text, ADD COLUMN IF NOT EXISTS currency_code text;
COMMENT ON COLUMN public.payslips.department_snapshot IS 'Department at payroll approval; historical reports must not use current profile membership.';
CREATE POLICY "HR can read payroll payslips" ON public.payslips FOR SELECT TO authenticated USING (public.is_admin_or_manager(auth.uid()));
DROP POLICY IF EXISTS "Authenticated users can insert payroll runs" ON public.payroll_runs;
DROP POLICY IF EXISTS "Authenticated users can insert payslips" ON public.payslips;
CREATE POLICY "HR can insert payroll runs" ON public.payroll_runs FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_manager(auth.uid()));
CREATE POLICY "HR can insert payroll payslips" ON public.payslips FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_manager(auth.uid()));
CREATE OR REPLACE FUNCTION public.approve_department_payroll(_period text, _jurisdiction text, _departments text[], _rows jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE run uuid; row jsonb; p public.profiles; n integer; ids uuid[] := '{}'; g numeric := 0; d numeric := 0; net numeric := 0;
BEGIN
 IF NOT public.is_admin_or_manager(auth.uid()) THEN RAISE EXCEPTION 'Payroll approval requires HR access'; END IF;
 IF _period IS NULL OR _period !~ '^20[0-9]{2}-(0[1-9]|1[0-2])$' THEN RAISE EXCEPTION 'Choose a valid payroll month'; END IF;
 IF _jurisdiction IS NULL OR _jurisdiction NOT IN ('LC','AG','KN','DM','GD') THEN RAISE EXCEPTION 'Unsupported payroll jurisdiction'; END IF;
 IF coalesce(cardinality(_departments),0) = 0 OR jsonb_typeof(_rows) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Select departments and employees'; END IF;
 n := jsonb_array_length(_rows); IF n = 0 THEN RAISE EXCEPTION 'No employees selected'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('department-payroll-' || _period));
 FOR row IN SELECT value FROM jsonb_array_elements(_rows) LOOP
  SELECT * INTO p FROM public.profiles WHERE user_id=(row->>'user_id')::uuid AND deleted_at IS NULL AND lower(status)='active';
  IF NOT FOUND THEN RAISE EXCEPTION 'Employee is not active'; END IF;
  IF p.jurisdiction <> _jurisdiction OR NOT (coalesce(nullif(trim(p.department),''),'Unassigned') = ANY(_departments)) OR row->>'department' IS DISTINCT FROM coalesce(nullif(trim(p.department),''),'Unassigned') THEN RAISE EXCEPTION 'Employee department changed; refresh payroll'; END IF;
  IF p.user_id = ANY(ids) THEN RAISE EXCEPTION 'Duplicate employee'; END IF;
  ids := array_append(ids,p.user_id);
  IF EXISTS(SELECT 1 FROM public.payslips s JOIN public.payroll_runs r ON r.id=s.payroll_run_id WHERE s.user_id=p.user_id AND s.period=_period AND r.status='approved') THEN RAISE EXCEPTION 'An employee already has approved payroll for this month'; END IF;
  IF (row->>'basic_pay')::numeric IS DISTINCT FROM p.monthly_salary THEN RAISE EXCEPTION 'Salary changed; refresh payroll'; END IF;
  IF EXISTS(SELECT 1 FROM unnest(ARRAY['basic_pay','overtime_pay','gross_pay','employee_nic','employer_nic','paye','total_deductions','net_pay']) k WHERE row->>k IS NULL OR (row->>k)::numeric < 0 OR (row->>k)::numeric > 100000000 OR (row->>k)::numeric <> round((row->>k)::numeric,2)) THEN RAISE EXCEPTION 'Invalid payroll amounts'; END IF;
  IF abs((row->>'gross_pay')::numeric - (row->>'total_deductions')::numeric - (row->>'net_pay')::numeric) > 0.02 OR (row->>'total_deductions')::numeric + 0.01 < (row->>'employee_nic')::numeric + (row->>'paye')::numeric THEN RAISE EXCEPTION 'Payroll totals do not reconcile'; END IF;
  g:=g+(row->>'gross_pay')::numeric; d:=d+(row->>'total_deductions')::numeric; net:=net+(row->>'net_pay')::numeric;
 END LOOP;
 IF (SELECT count(*) FROM public.profiles WHERE deleted_at IS NULL AND lower(status)='active' AND jurisdiction=_jurisdiction AND coalesce(nullif(trim(department),''),'Unassigned')=ANY(_departments)) <> n THEN RAISE EXCEPTION 'Employee list changed; refresh payroll'; END IF;
 INSERT INTO public.payroll_runs(period,status,total_gross,total_deductions,total_net,employee_count,departments,jurisdiction,currency_code) VALUES(_period,'approved',g,d,net,n,_departments,_jurisdiction,'XCD') RETURNING id INTO run;
 FOR row IN SELECT value FROM jsonb_array_elements(_rows) LOOP
  SELECT * INTO p FROM public.profiles WHERE user_id=(row->>'user_id')::uuid;
  INSERT INTO public.payslips(payroll_run_id,user_id,period,basic_pay,overtime_pay,gross_pay,employee_nic,employer_nic,paye,total_deductions,net_pay,department_snapshot,employee_name_snapshot,currency_code) VALUES(run,p.user_id,_period,(row->>'basic_pay')::numeric,(row->>'overtime_pay')::numeric,(row->>'gross_pay')::numeric,(row->>'employee_nic')::numeric,(row->>'employer_nic')::numeric,(row->>'paye')::numeric,(row->>'total_deductions')::numeric,(row->>'net_pay')::numeric,coalesce(nullif(trim(p.department),''),'Unassigned'),trim(p.first_name || ' ' || p.last_name),'XCD');
 END LOOP;
 RETURN run;
END $$;
REVOKE ALL ON FUNCTION public.approve_department_payroll(text,text,text[],jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_department_payroll(text,text,text[],jsonb) TO authenticated;
GRANT SELECT, INSERT ON public.payroll_runs, public.payslips TO authenticated;
GRANT ALL ON public.payroll_runs, public.payslips TO service_role;