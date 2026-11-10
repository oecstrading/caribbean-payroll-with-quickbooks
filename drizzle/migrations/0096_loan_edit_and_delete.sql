CREATE OR REPLACE FUNCTION public.edit_employee_loan(_loan uuid, _creditor uuid, _original numeric, _balance numeric, _amount numeric, _frequency text, _notes text DEFAULT '')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE l public.employee_loans; BEGIN
IF NOT public.is_admin_or_manager(auth.uid()) OR NOT public.has_workspace_access(auth.uid(),'payroll') THEN RAISE EXCEPTION 'Payroll management access required'; END IF;
SELECT * INTO l FROM public.employee_loans WHERE id=_loan AND org_id=public.current_org_id() FOR UPDATE;
IF NOT FOUND THEN RAISE EXCEPTION 'Loan not found'; END IF;
IF NOT EXISTS(SELECT 1 FROM public.creditors WHERE id=_creditor AND org_id=public.current_org_id()) THEN RAISE EXCEPTION 'Creditor must belong to your company'; END IF;
IF coalesce(_frequency,'') NOT IN ('weekly','bi-weekly','semi-monthly','monthly') THEN RAISE EXCEPTION 'Invalid repayment frequency'; END IF;
IF _original IS NULL OR _balance IS NULL OR _amount IS NULL OR _original<=0 OR _original>100000000 OR _balance<0 OR _balance>_original OR _amount<=0 OR _amount>_original OR length(coalesce(_notes,''))>500 OR _original<>round(_original,2) OR _balance<>round(_balance,2) OR _amount<>round(_amount,2) THEN RAISE EXCEPTION 'Invalid loan amounts'; END IF;
UPDATE public.employee_loans SET creditor_id=_creditor, original_amount=_original, balance=_balance, repayment_amount=_amount, repayment_frequency=_frequency, monthly_repayment=public.loan_monthly_equivalent(_amount,_frequency), notes=coalesce(_notes,''), is_active=CASE WHEN _balance=0 THEN false ELSE is_active END WHERE id=_loan;
END $function$;
REVOKE ALL ON FUNCTION public.edit_employee_loan(uuid,uuid,numeric,numeric,numeric,text,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.edit_employee_loan(uuid,uuid,numeric,numeric,numeric,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_employee_loan(_loan uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
IF NOT public.is_admin_or_manager(auth.uid()) OR NOT public.has_workspace_access(auth.uid(),'payroll') THEN RAISE EXCEPTION 'Payroll management access required'; END IF;
PERFORM 1 FROM public.employee_loans WHERE id=_loan AND org_id=public.current_org_id() FOR UPDATE;
IF NOT FOUND THEN RAISE EXCEPTION 'Loan not found'; END IF;
IF EXISTS(SELECT 1 FROM public.loan_repayments WHERE loan_id=_loan) THEN RAISE EXCEPTION 'This loan already has payroll repayments, so it is kept for your records. Pause it instead.'; END IF;
DELETE FROM public.employee_loans WHERE id=_loan;
END $function$;
REVOKE ALL ON FUNCTION public.delete_employee_loan(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.delete_employee_loan(uuid) TO authenticated;