-- Run through the approved database data-change tool before test:security:live.
-- These are account-free test employees, never authentication users.
INSERT INTO public.organizations(id,name) VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','Automated isolation test company');
INSERT INTO public.employee_records(user_id,first_name,last_name,email,org_id)
SELECT 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2','Automated','Payroll verification','',id
FROM public.organizations WHERE id='11111111-1111-4111-8111-111111111111';
INSERT INTO public.employee_records(user_id,first_name,last_name,email,org_id)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3','Automated','Foreign verification','','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1');
INSERT INTO public.creditors(id,name,type,org_id)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4','Automated repayment verification','other','11111111-1111-4111-8111-111111111111'),
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5','Automated foreign creditor','other','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1');