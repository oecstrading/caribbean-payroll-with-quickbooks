-- Saves a payroll rebuilt from uploaded pay slips after an administrator reviews it.
-- Same tenant, role, overlap and reconciliation guards as approve_payroll_run, but amounts come from the reviewed slips.
CREATE OR REPLACE FUNCTION public.approve_payslip_import(_start date, _end date, _jurisdiction text, _rows jsonb, _notes text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE run uuid; row jsonb; p public.payroll_employee_directory; n integer; ids uuid[] := '{}'; depts text[] := '{}'; g numeric := 0; d numeric := 0; net numeric := 0; _period text; dep text;
BEGIN
IF NOT public.has_workspace_access(auth.uid(),'payroll') THEN RAISE EXCEPTION 'Workspace access denied'; END IF;
IF NOT public.is_admin_or_manager(auth.uid()) THEN RAISE EXCEPTION 'Payroll approval requires HR access'; END IF;
IF _start IS NULL OR _end IS NULL OR _end < _start OR _end - _start > 62 THEN RAISE EXCEPTION 'Invalid pay period'; END IF;
IF _jurisdiction IS NULL OR _jurisdiction NOT IN ('LC','AG','KN','DM','GD') THEN RAISE EXCEPTION 'Unsupported payroll jurisdiction'; END IF;
IF jsonb_typeof(_rows) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'No employees selected'; END IF;
IF _notes IS NOT NULL AND length(_notes)>500 THEN RAISE EXCEPTION 'Notes are too long'; END IF;
n := jsonb_array_length(_rows); IF n=0 OR n>500 THEN RAISE EXCEPTION 'No employees selected'; END IF;
_period := to_char(_start,'YYYY-MM-DD') || ' to ' || to_char(_end,'YYYY-MM-DD');
PERFORM pg_advisory_xact_lock(hashtext('payroll-run-' || _jurisdiction));
FOR row IN SELECT value FROM jsonb_array_elements(_rows) LOOP
  SELECT * INTO p FROM public.payroll_employee_directory WHERE org_id=public.current_org_id() AND user_id=(row->>'user_id')::uuid AND deleted_at IS NULL AND lower(status)='active';
  IF NOT FOUND THEN RAISE EXCEPTION 'Employee is not active in this company'; END IF;
  IF p.user_id=ANY(ids) THEN RAISE EXCEPTION 'The same employee is matched to two pay slips'; END IF; ids:=array_append(ids,p.user_id);
  IF EXISTS(SELECT 1 FROM public.payroll_payslip_directory s JOIN public.payroll_runs r ON r.id=s.payroll_run_id WHERE s.user_id=p.user_id AND r.status='approved' AND r.period_start<=_end AND r.period_end>=_start) THEN RAISE EXCEPTION '% % is already paid for part of this period', p.first_name, p.last_name; END IF;
  IF EXISTS(SELECT 1 FROM unnest(ARRAY['basic_pay','overtime_pay','gross_pay','employee_nic','employer_nic','paye','total_deductions','net_pay']) k WHERE row->>k IS NULL OR (row->>k)::numeric<0 OR (row->>k)::numeric>100000000 OR (row->>k)::numeric<>round((row->>k)::numeric,2)) THEN RAISE EXCEPTION 'Invalid payroll amounts'; END IF;
  IF abs((row->>'basic_pay')::numeric+(row->>'overtime_pay')::numeric-(row->>'gross_pay')::numeric)>0.02 OR abs((row->>'gross_pay')::numeric-(row->>'total_deductions')::numeric-(row->>'net_pay')::numeric)>0.02 OR (row->>'total_deductions')::numeric+0.01<(row->>'employee_nic')::numeric+(row->>'paye')::numeric OR (row->>'employee_nic')::numeric>(row->>'gross_pay')::numeric THEN RAISE EXCEPTION 'Payroll totals do not reconcile'; END IF;
  dep := coalesce(nullif(trim(p.department),''),'Unassigned'); IF NOT dep=ANY(depts) THEN depts:=array_append(depts,dep); END IF;
  g:=g+(row->>'gross_pay')::numeric; d:=d+(row->>'total_deductions')::numeric; net:=net+(row->>'net_pay')::numeric;
END LOOP;
INSERT INTO public.payroll_runs(period,status,total_gross,total_deductions,total_net,employee_count,departments,jurisdiction,currency_code,pay_type,period_start,period_end,notes)
VALUES(_period,'approved',g,d,net,n,depts,_jurisdiction,'XCD','custom',_start,_end,coalesce(nullif(trim(_notes),''),'Rebuilt from uploaded pay slips')) RETURNING id INTO run;
FOR row IN SELECT value FROM jsonb_array_elements(_rows) LOOP
  SELECT * INTO p FROM public.payroll_employee_directory WHERE org_id=public.current_org_id() AND user_id=(row->>'user_id')::uuid;
  IF p.account_linked THEN
    INSERT INTO public.payslips(payroll_run_id,user_id,period,basic_pay,overtime_pay,gross_pay,employee_nic,employer_nic,paye,total_deductions,net_pay,department_snapshot,employee_name_snapshot,currency_code) VALUES(run,p.user_id,_period,(row->>'basic_pay')::numeric,(row->>'overtime_pay')::numeric,(row->>'gross_pay')::numeric,(row->>'employee_nic')::numeric,(row->>'employer_nic')::numeric,(row->>'paye')::numeric,(row->>'total_deductions')::numeric,(row->>'net_pay')::numeric,coalesce(nullif(trim(p.department),''),'Unassigned'),trim(p.first_name||' '||p.last_name),'XCD');
  ELSE
    INSERT INTO public.employee_payslips(payroll_run_id,user_id,period,basic_pay,overtime_pay,gross_pay,employee_nic,employer_nic,paye,total_deductions,net_pay,department_snapshot,employee_name_snapshot,currency_code) VALUES(run,p.user_id,_period,(row->>'basic_pay')::numeric,(row->>'overtime_pay')::numeric,(row->>'gross_pay')::numeric,(row->>'employee_nic')::numeric,(row->>'employer_nic')::numeric,(row->>'paye')::numeric,(row->>'total_deductions')::numeric,(row->>'net_pay')::numeric,coalesce(nullif(trim(p.department),''),'Unassigned'),trim(p.first_name||' '||p.last_name),'XCD');
  END IF;
END LOOP;
RETURN run;
END $$;
REVOKE ALL ON FUNCTION public.approve_payslip_import(date,date,text,jsonb,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_payslip_import(date,date,text,jsonb,text) TO authenticated;