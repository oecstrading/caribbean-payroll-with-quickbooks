ALTER TABLE public.employee_loans
  ADD COLUMN IF NOT EXISTS repayment_frequency text NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS repayment_amount numeric;
UPDATE public.employee_loans SET repayment_amount = monthly_repayment WHERE repayment_amount IS NULL;
ALTER TABLE public.employee_loans ADD CONSTRAINT employee_loans_repayment_frequency_check CHECK (repayment_frequency IN ('weekly','bi-weekly','semi-monthly','monthly'));

CREATE OR REPLACE FUNCTION public.loan_monthly_equivalent(_amount numeric, _frequency text)
RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT round(_amount * CASE _frequency WHEN 'weekly' THEN 52.0/12 WHEN 'bi-weekly' THEN 26.0/12 WHEN 'semi-monthly' THEN 2 ELSE 1 END, 2)
$$;

CREATE OR REPLACE FUNCTION public.create_employee_loan(_employee uuid, _creditor uuid, _original numeric, _balance numeric, _monthly numeric, _notes text DEFAULT '', _frequency text DEFAULT 'monthly')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE result uuid; monthly_eq numeric; BEGIN
IF NOT public.is_admin_or_manager(auth.uid()) OR NOT public.has_workspace_access(auth.uid(),'payroll') THEN RAISE EXCEPTION 'Payroll management access required'; END IF;
IF public.employee_org_id(_employee) IS DISTINCT FROM public.current_org_id() OR NOT EXISTS(SELECT 1 FROM public.creditors WHERE id=_creditor AND org_id=public.current_org_id()) THEN RAISE EXCEPTION 'Employee and creditor must belong to your company'; END IF;
IF coalesce(_frequency,'') NOT IN ('weekly','bi-weekly','semi-monthly','monthly') THEN RAISE EXCEPTION 'Invalid repayment frequency'; END IF;
IF _original IS NULL OR _balance IS NULL OR _monthly IS NULL OR _original<=0 OR _original>100000000 OR _balance<0 OR _balance>_original OR _monthly<=0 OR _monthly>_original OR length(coalesce(_notes,''))>500 OR _original<>round(_original,2) OR _balance<>round(_balance,2) OR _monthly<>round(_monthly,2) THEN RAISE EXCEPTION 'Invalid loan amounts'; END IF;
monthly_eq := public.loan_monthly_equivalent(_monthly,_frequency);
INSERT INTO public.employee_loans(user_id,creditor_id,original_amount,balance,monthly_repayment,repayment_amount,repayment_frequency,notes,org_id,is_active)
VALUES(_employee,_creditor,_original,_balance,monthly_eq,_monthly,_frequency,coalesce(_notes,''),public.current_org_id(),_balance>0) RETURNING id INTO result;
RETURN result; END $function$;
DROP FUNCTION IF EXISTS public.create_employee_loan(uuid,uuid,numeric,numeric,numeric,text);

CREATE OR REPLACE FUNCTION public.update_employee_loan_repayment(_loan uuid, _amount numeric, _frequency text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE l public.employee_loans; BEGIN
IF NOT public.is_admin_or_manager(auth.uid()) OR NOT public.has_workspace_access(auth.uid(),'payroll') THEN RAISE EXCEPTION 'Payroll management access required'; END IF;
SELECT * INTO l FROM public.employee_loans WHERE id=_loan AND org_id=public.current_org_id() FOR UPDATE;
IF NOT FOUND THEN RAISE EXCEPTION 'Loan not found'; END IF;
IF coalesce(_frequency,'') NOT IN ('weekly','bi-weekly','semi-monthly','monthly') THEN RAISE EXCEPTION 'Invalid repayment frequency'; END IF;
IF _amount IS NULL OR _amount<=0 OR _amount>l.original_amount OR _amount<>round(_amount,2) THEN RAISE EXCEPTION 'Invalid repayment amount'; END IF;
UPDATE public.employee_loans SET repayment_amount=_amount, repayment_frequency=_frequency, monthly_repayment=public.loan_monthly_equivalent(_amount,_frequency) WHERE id=_loan;
END $function$;
REVOKE ALL ON FUNCTION public.update_employee_loan_repayment(uuid,numeric,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.update_employee_loan_repayment(uuid,numeric,text) TO authenticated;
REVOKE ALL ON FUNCTION public.create_employee_loan(uuid,uuid,numeric,numeric,numeric,text,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_employee_loan(uuid,uuid,numeric,numeric,numeric,text,text) TO authenticated;