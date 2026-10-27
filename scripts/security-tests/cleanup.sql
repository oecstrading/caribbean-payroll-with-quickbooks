-- Remove only the fixed fixture employee/company records, in dependency order.
DELETE FROM public.loan_repayments WHERE user_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
DELETE FROM public.employee_loans WHERE user_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
DELETE FROM public.employee_payslips WHERE user_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
DELETE FROM public.payroll_runs WHERE notes='Automated security verification aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
DELETE FROM public.employee_records WHERE user_id IN ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3');
DELETE FROM public.creditors WHERE id IN ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5');
DELETE FROM public.audit_logs WHERE org_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
DELETE FROM public.organizations WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';