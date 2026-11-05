CREATE TABLE public.payroll_go_live (
  org_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  set_by uuid,
  set_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payroll_go_live TO authenticated;
GRANT ALL ON public.payroll_go_live TO service_role;
ALTER TABLE public.payroll_go_live ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company members read go-live date" ON public.payroll_go_live FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() OR public.is_platform_admin());

CREATE OR REPLACE FUNCTION public.can_erase_payroll(_org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND (public.is_platform_admin()
    OR EXISTS (SELECT 1 FROM public.company_super_administrators s WHERE s.user_id = auth.uid() AND s.org_id = _org));
$$;

CREATE OR REPLACE FUNCTION public.erase_payroll_data(_orgs uuid[], _start date, _end date, _confirmation text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o uuid; runs uuid[]; shifts uuid[]; result jsonb := '[]'::jsonb; n_runs int; n_shifts int; n_punch int; n_req int; n_draft int;
BEGIN
  IF _confirmation IS DISTINCT FROM 'ERASE' THEN RAISE EXCEPTION 'Type ERASE to confirm'; END IF;
  IF _start IS NULL OR _end IS NULL OR _end < _start THEN RAISE EXCEPTION 'Choose a valid date range'; END IF;
  IF _orgs IS NULL OR array_length(_orgs,1) IS NULL THEN RAISE EXCEPTION 'Choose at least one company'; END IF;
  FOREACH o IN ARRAY _orgs LOOP
    IF NOT public.can_erase_payroll(o) THEN RAISE EXCEPTION 'Super administrator authority is required for every selected company'; END IF;
    SELECT coalesce(array_agg(id),'{}') INTO runs FROM payroll_runs WHERE org_id = o
      AND coalesce(period_start, run_date) >= _start AND coalesce(period_end, run_date) <= _end;
    -- give back loan repayments taken by erased runs
    UPDATE employee_loans l SET balance = l.balance + r.total, is_active = true
      FROM (SELECT loan_id, sum(amount) total FROM loan_repayments WHERE payroll_run_id = ANY(runs) GROUP BY loan_id) r
      WHERE l.id = r.loan_id;
    DELETE FROM loan_repayments WHERE payroll_run_id = ANY(runs);
    DELETE FROM workforce_payroll_snapshots WHERE payroll_run_id = ANY(runs);
    DELETE FROM employee_payslips WHERE payroll_run_id = ANY(runs);
    DELETE FROM payslips WHERE payroll_run_id = ANY(runs);
    DELETE FROM paymaster_drafts WHERE org_id = o AND (approved_run_id = ANY(runs) OR (period_start >= _start AND period_end <= _end));
    GET DIAGNOSTICS n_draft = ROW_COUNT;
    DELETE FROM payroll_runs WHERE id = ANY(runs);
    n_runs := coalesce(array_length(runs,1),0);
    SELECT coalesce(array_agg(id),'{}') INTO shifts FROM workforce_shifts WHERE org_id = o AND shift_date BETWEEN _start AND _end;
    DELETE FROM workforce_alerts WHERE org_id = o AND (shift_id = ANY(shifts) OR created_at::date BETWEEN _start AND _end);
    DELETE FROM staff_pay_requests WHERE org_id = o AND (shift_id = ANY(shifts) OR shift_date BETWEEN _start AND _end);
    GET DIAGNOSTICS n_req = ROW_COUNT;
    DELETE FROM workforce_punches WHERE org_id = o AND (shift_id = ANY(shifts) OR punched_at::date BETWEEN _start AND _end);
    GET DIAGNOSTICS n_punch = ROW_COUNT;
    DELETE FROM workforce_shifts WHERE id = ANY(shifts);
    n_shifts := coalesce(array_length(shifts,1),0);
    INSERT INTO audit_logs(org_id, action, details) VALUES (o, 'payroll_data_erased',
      jsonb_build_object('by', auth.uid(), 'start', _start, 'end', _end, 'runs', n_runs, 'shifts', n_shifts, 'punches', n_punch, 'requests', n_req, 'drafts', n_draft));
    result := result || jsonb_build_object('org_id', o, 'runs', n_runs, 'shifts', n_shifts, 'punches', n_punch, 'requests', n_req, 'drafts', n_draft);
  END LOOP;
  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.set_payroll_go_live(_orgs uuid[], _start date, _confirmation text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o uuid; r jsonb;
BEGIN
  IF _start IS NULL THEN RAISE EXCEPTION 'Choose a go-live date'; END IF;
  r := public.erase_payroll_data(_orgs, DATE '1900-01-01', _start - 1, _confirmation);
  FOREACH o IN ARRAY _orgs LOOP
    INSERT INTO payroll_go_live(org_id, start_date, set_by) VALUES (o, _start, auth.uid())
      ON CONFLICT (org_id) DO UPDATE SET start_date = excluded.start_date, set_by = excluded.set_by, set_at = now();
  END LOOP;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.enforce_payroll_go_live()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g date;
BEGIN
  SELECT start_date INTO g FROM payroll_go_live WHERE org_id = new.org_id;
  IF g IS NOT NULL AND coalesce(new.period_start, new.run_date) < g THEN
    RAISE EXCEPTION 'This company went live on %; payroll before that date cannot be saved', g;
  END IF;
  RETURN new;
END $$;
CREATE TRIGGER payroll_runs_go_live BEFORE INSERT ON public.payroll_runs FOR EACH ROW EXECUTE FUNCTION public.enforce_payroll_go_live();

REVOKE EXECUTE ON FUNCTION public.erase_payroll_data(uuid[], date, date, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.set_payroll_go_live(uuid[], date, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.erase_payroll_data(uuid[], date, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_payroll_go_live(uuid[], date, text) TO authenticated;