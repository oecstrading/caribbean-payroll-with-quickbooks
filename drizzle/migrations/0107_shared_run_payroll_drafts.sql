CREATE TABLE public.payroll_run_drafts (
  org_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  draft jsonb NOT NULL,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_run_drafts TO authenticated;
GRANT ALL ON public.payroll_run_drafts TO service_role;
ALTER TABLE public.payroll_run_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Payroll staff share company draft" ON public.payroll_run_drafts FOR ALL TO authenticated
USING (org_id = public.current_org_id() AND public.is_admin_or_manager(auth.uid()) AND public.has_workspace_access(auth.uid(),'payroll'))
WITH CHECK (org_id = public.current_org_id() AND public.is_admin_or_manager(auth.uid()) AND public.has_workspace_access(auth.uid(),'payroll'));

CREATE OR REPLACE FUNCTION public.apply_payroll_loans(_run uuid, _employee uuid, _factor numeric, _submitted numeric)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$ DECLARE l public.employee_loans; repayment numeric; expected numeric:=0; remaining numeric; BEGIN
IF NOT public.is_admin_or_manager(auth.uid()) OR NOT public.has_workspace_access(auth.uid(),'payroll') OR public.employee_org_id(_employee) IS DISTINCT FROM public.current_org_id() OR NOT EXISTS(SELECT 1 FROM public.payroll_runs WHERE id=_run AND org_id=public.current_org_id()) THEN RAISE EXCEPTION 'Company payroll access required'; END IF;
SELECT coalesce(sum(least(balance,round(monthly_repayment*_factor,2))),0) INTO expected FROM public.employee_loans WHERE user_id=_employee AND org_id=public.current_org_id() AND is_active AND balance>0;
IF _submitted IS NULL OR _submitted < 0 OR _submitted > expected + 0.01 THEN RAISE EXCEPTION 'Loan balance changed; refresh payroll'; END IF;
remaining := least(_submitted, expected);
FOR l IN SELECT * FROM public.employee_loans WHERE user_id=_employee AND org_id=public.current_org_id() AND is_active AND balance>0 ORDER BY id FOR UPDATE LOOP
  EXIT WHEN remaining <= 0;
  repayment:=least(l.balance,round(l.monthly_repayment*_factor,2),remaining);
  IF repayment>0 THEN INSERT INTO public.loan_repayments(org_id,loan_id,payroll_run_id,user_id,amount) VALUES(l.org_id,l.id,_run,_employee,repayment); UPDATE public.employee_loans SET balance=balance-repayment,is_active=(balance-repayment>0) WHERE id=l.id; remaining:=remaining-repayment; END IF;
END LOOP;
END $function$;