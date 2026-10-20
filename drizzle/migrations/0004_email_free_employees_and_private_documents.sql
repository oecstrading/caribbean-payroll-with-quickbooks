CREATE TABLE public.employee_records (LIKE public.profiles INCLUDING DEFAULTS);
ALTER TABLE public.employee_records ALTER COLUMN user_id SET DEFAULT gen_random_uuid();
ALTER TABLE public.employee_records ADD PRIMARY KEY(id), ADD UNIQUE(user_id);
GRANT SELECT,INSERT,UPDATE ON public.employee_records TO authenticated;
GRANT ALL ON public.employee_records TO service_role;
ALTER TABLE public.employee_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "HR read account-free employees" ON public.employee_records FOR SELECT TO authenticated USING(public.is_admin_or_manager(auth.uid()));
CREATE POLICY "Admin create account-free employees" ON public.employee_records FOR INSERT TO authenticated WITH CHECK(public.has_role(auth.uid(),'admin'));
CREATE POLICY "HR edit account-free employees" ON public.employee_records FOR UPDATE TO authenticated USING(public.is_admin_or_manager(auth.uid())) WITH CHECK(public.is_admin_or_manager(auth.uid()));
CREATE TRIGGER validate_employee_folder BEFORE INSERT OR UPDATE ON public.employee_records FOR EACH ROW EXECUTE FUNCTION public.validate_employee_folder();
CREATE TRIGGER update_employee_record BEFORE UPDATE ON public.employee_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
COMMENT ON TABLE public.employee_records IS 'Account-free HR employees. user_id is a durable employment key, never an authentication identity.';
CREATE VIEW public.payroll_employee_directory WITH(security_invoker=true) AS SELECT p.*,true AS account_linked FROM public.profiles p UNION ALL SELECT e.*,false AS account_linked FROM public.employee_records e;
GRANT SELECT ON public.payroll_employee_directory TO authenticated,service_role;
CREATE TABLE public.employee_payslips (LIKE public.payslips INCLUDING DEFAULTS);
ALTER TABLE public.employee_payslips ADD PRIMARY KEY(id), ADD FOREIGN KEY(user_id) REFERENCES public.employee_records(user_id), ADD FOREIGN KEY(payroll_run_id) REFERENCES public.payroll_runs(id);
GRANT SELECT ON public.employee_payslips TO authenticated;
GRANT ALL ON public.employee_payslips TO service_role;
ALTER TABLE public.employee_payslips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "HR read account-free payslips" ON public.employee_payslips FOR SELECT TO authenticated USING(public.is_admin_or_manager(auth.uid()));
CREATE VIEW public.payroll_payslip_directory WITH(security_invoker=true) AS SELECT * FROM public.payslips UNION ALL SELECT * FROM public.employee_payslips;
GRANT SELECT ON public.payroll_payslip_directory TO authenticated,service_role;
CREATE FUNCTION public.can_access_employee_document(_employee uuid,_shared boolean) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT public.is_admin_or_manager(auth.uid()) OR (_shared AND _employee=auth.uid() AND EXISTS(SELECT 1 FROM public.profiles WHERE user_id=_employee AND deleted_at IS NULL)); $$;
REVOKE ALL ON FUNCTION public.can_access_employee_document(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_access_employee_document(uuid,boolean) TO authenticated;
CREATE TABLE public.employee_documents(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),employee_key uuid NOT NULL,title text NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 150),category text NOT NULL CHECK(category IN ('Contract','Certification','Other HR')),file_name text NOT NULL CHECK(length(file_name) BETWEEN 1 AND 255),storage_path text UNIQUE NOT NULL,file_size bigint NOT NULL CHECK(file_size BETWEEN 1 AND 20971520),expiry_date date,employee_visible boolean NOT NULL DEFAULT false,uploaded_by uuid NOT NULL DEFAULT auth.uid(),created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT,INSERT,UPDATE,DELETE ON public.employee_documents TO authenticated;
GRANT ALL ON public.employee_documents TO service_role;
ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read authorized HR documents" ON public.employee_documents FOR SELECT TO authenticated USING(public.can_access_employee_document(employee_key,employee_visible));
CREATE POLICY "HR upload documents" ON public.employee_documents FOR INSERT TO authenticated WITH CHECK(public.is_admin_or_manager(auth.uid()) AND uploaded_by=auth.uid());
CREATE POLICY "HR update documents" ON public.employee_documents FOR UPDATE TO authenticated USING(public.is_admin_or_manager(auth.uid())) WITH CHECK(public.is_admin_or_manager(auth.uid()));
CREATE POLICY "HR delete documents" ON public.employee_documents FOR DELETE TO authenticated USING(public.is_admin_or_manager(auth.uid()));
CREATE FUNCTION public.validate_employee_document() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE user_id=NEW.employee_key AND deleted_at IS NULL) AND NOT EXISTS(SELECT 1 FROM public.employee_records WHERE user_id=NEW.employee_key AND deleted_at IS NULL) THEN RAISE EXCEPTION 'Active employee folder required'; END IF;
IF NEW.storage_path <> NEW.employee_key::text || '/' || NEW.id::text THEN RAISE EXCEPTION 'Invalid document path'; END IF;
IF TG_OP='UPDATE' AND (NEW.employee_key,NEW.storage_path,NEW.uploaded_by,NEW.file_name,NEW.file_size) IS DISTINCT FROM (OLD.employee_key,OLD.storage_path,OLD.uploaded_by,OLD.file_name,OLD.file_size) THEN RAISE EXCEPTION 'Document identity cannot be changed'; END IF;
RETURN NEW; END $$;
CREATE TRIGGER validate_document BEFORE INSERT OR UPDATE ON public.employee_documents FOR EACH ROW EXECUTE FUNCTION public.validate_employee_document();
CREATE POLICY "HR upload private employee files" ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='employee-hr-docs' AND public.is_admin_or_manager(auth.uid()) AND EXISTS(SELECT 1 FROM public.employee_documents d WHERE d.storage_path=name AND d.uploaded_by=auth.uid()));
CREATE POLICY "Authorized employee file reads" ON storage.objects FOR SELECT TO authenticated USING(bucket_id='employee-hr-docs' AND EXISTS(SELECT 1 FROM public.employee_documents d WHERE d.storage_path=name AND public.can_access_employee_document(d.employee_key,d.employee_visible)));
CREATE POLICY "HR remove employee files" ON storage.objects FOR DELETE TO authenticated USING(bucket_id='employee-hr-docs' AND public.is_admin_or_manager(auth.uid()));
CREATE OR REPLACE FUNCTION public.approve_department_payroll(_period text,_jurisdiction text,_departments text[],_rows jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE run uuid; row jsonb; p public.payroll_employee_directory; n integer; ids uuid[] := '{}'; g numeric := 0; d numeric := 0; net numeric := 0;
BEGIN
IF NOT public.is_admin_or_manager(auth.uid()) THEN RAISE EXCEPTION 'Payroll approval requires HR access'; END IF;
IF _period IS NULL OR _period !~ '^20[0-9]{2}-(0[1-9]|1[0-2])$' THEN RAISE EXCEPTION 'Choose a valid payroll month'; END IF;
IF _jurisdiction IS NULL OR _jurisdiction NOT IN ('LC','AG','KN','DM','GD') THEN RAISE EXCEPTION 'Unsupported payroll jurisdiction'; END IF;
IF coalesce(cardinality(_departments),0)=0 OR jsonb_typeof(_rows) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Select departments and employees'; END IF;
n:=jsonb_array_length(_rows); IF n=0 THEN RAISE EXCEPTION 'No employees selected'; END IF;
PERFORM pg_advisory_xact_lock(hashtext('department-payroll-' || _period));
FOR row IN SELECT value FROM jsonb_array_elements(_rows) LOOP
SELECT * INTO p FROM public.payroll_employee_directory WHERE user_id=(row->>'user_id')::uuid AND deleted_at IS NULL AND lower(status)='active';
IF NOT FOUND THEN RAISE EXCEPTION 'Employee is not active'; END IF;
IF p.jurisdiction<>_jurisdiction OR NOT(coalesce(nullif(trim(p.department),''),'Unassigned')=ANY(_departments)) OR row->>'department' IS DISTINCT FROM coalesce(nullif(trim(p.department),''),'Unassigned') THEN RAISE EXCEPTION 'Employee department changed; refresh payroll'; END IF;
IF p.user_id=ANY(ids) THEN RAISE EXCEPTION 'Duplicate employee'; END IF; ids:=array_append(ids,p.user_id);
IF EXISTS(SELECT 1 FROM public.payroll_payslip_directory s JOIN public.payroll_runs r ON r.id=s.payroll_run_id WHERE s.user_id=p.user_id AND s.period=_period AND r.status='approved') THEN RAISE EXCEPTION 'An employee already has approved payroll for this month'; END IF;
IF (row->>'basic_pay')::numeric IS DISTINCT FROM p.monthly_salary THEN RAISE EXCEPTION 'Salary changed; refresh payroll'; END IF;
IF EXISTS(SELECT 1 FROM unnest(ARRAY['basic_pay','overtime_pay','gross_pay','employee_nic','employer_nic','paye','total_deductions','net_pay']) k WHERE row->>k IS NULL OR (row->>k)::numeric<0 OR (row->>k)::numeric>100000000 OR (row->>k)::numeric<>round((row->>k)::numeric,2)) THEN RAISE EXCEPTION 'Invalid payroll amounts'; END IF;
IF abs((row->>'gross_pay')::numeric-(row->>'total_deductions')::numeric-(row->>'net_pay')::numeric)>0.02 OR (row->>'total_deductions')::numeric+0.01<(row->>'employee_nic')::numeric+(row->>'paye')::numeric THEN RAISE EXCEPTION 'Payroll totals do not reconcile'; END IF;
g:=g+(row->>'gross_pay')::numeric; d:=d+(row->>'total_deductions')::numeric; net:=net+(row->>'net_pay')::numeric;
END LOOP;
IF (SELECT count(*) FROM public.payroll_employee_directory WHERE deleted_at IS NULL AND lower(status)='active' AND jurisdiction=_jurisdiction AND coalesce(nullif(trim(department),''),'Unassigned')=ANY(_departments))<>n THEN RAISE EXCEPTION 'Employee list changed; refresh payroll'; END IF;
INSERT INTO public.payroll_runs(period,status,total_gross,total_deductions,total_net,employee_count,departments,jurisdiction,currency_code) VALUES(_period,'approved',g,d,net,n,_departments,_jurisdiction,'XCD') RETURNING id INTO run;
FOR row IN SELECT value FROM jsonb_array_elements(_rows) LOOP
SELECT * INTO p FROM public.payroll_employee_directory WHERE user_id=(row->>'user_id')::uuid;
IF p.account_linked THEN
INSERT INTO public.payslips(payroll_run_id,user_id,period,basic_pay,overtime_pay,gross_pay,employee_nic,employer_nic,paye,total_deductions,net_pay,department_snapshot,employee_name_snapshot,currency_code) VALUES(run,p.user_id,_period,(row->>'basic_pay')::numeric,(row->>'overtime_pay')::numeric,(row->>'gross_pay')::numeric,(row->>'employee_nic')::numeric,(row->>'employer_nic')::numeric,(row->>'paye')::numeric,(row->>'total_deductions')::numeric,(row->>'net_pay')::numeric,coalesce(nullif(trim(p.department),''),'Unassigned'),trim(p.first_name || ' ' || p.last_name),'XCD');
ELSE
INSERT INTO public.employee_payslips(payroll_run_id,user_id,period,basic_pay,overtime_pay,gross_pay,employee_nic,employer_nic,paye,total_deductions,net_pay,department_snapshot,employee_name_snapshot,currency_code) VALUES(run,p.user_id,_period,(row->>'basic_pay')::numeric,(row->>'overtime_pay')::numeric,(row->>'gross_pay')::numeric,(row->>'employee_nic')::numeric,(row->>'employer_nic')::numeric,(row->>'paye')::numeric,(row->>'total_deductions')::numeric,(row->>'net_pay')::numeric,coalesce(nullif(trim(p.department),''),'Unassigned'),trim(p.first_name || ' ' || p.last_name),'XCD');
END IF;
END LOOP; RETURN run; END $$;