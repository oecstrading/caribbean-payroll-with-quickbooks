ALTER TABLE public.employee_records ADD COLUMN permanently_deleted_at timestamptz;
COMMENT ON COLUMN public.employee_records.permanently_deleted_at IS 'Minimal retained financial identity only; excluded from HR and payroll selection, never restorable.';
CREATE TABLE public.employee_removal_jobs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),org_id uuid NOT NULL REFERENCES public.organizations(id),employee_id uuid NOT NULL UNIQUE,requested_by uuid NOT NULL,account_linked boolean NOT NULL,status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','complete')),storage_paths text[] NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now(),completed_at timestamptz);
GRANT ALL ON public.employee_removal_jobs TO service_role;
ALTER TABLE public.employee_removal_jobs ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE VIEW public.payroll_employee_directory WITH(security_invoker=true) AS SELECT id,user_id,first_name,last_name,email,phone,department,job_title,nic_number,tan_number,person_id,start_date,schedule,std_hours_per_day,ot_rate,monthly_salary,status,created_at,updated_at,jurisdiction,social_security_number,tax_id_number,hr_details,deleted_at,true AS account_linked,org_id FROM public.profiles UNION ALL SELECT id,user_id,first_name,last_name,email,phone,department,job_title,nic_number,tan_number,person_id,start_date,schedule,std_hours_per_day,ot_rate,monthly_salary,status,created_at,updated_at,jurisdiction,social_security_number,tax_id_number,hr_details,deleted_at,false AS account_linked,org_id FROM public.employee_records WHERE permanently_deleted_at IS NULL;
CREATE FUNCTION public.protect_removed_employee() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
IF TG_OP='UPDATE' THEN
IF OLD.permanently_deleted_at IS NOT NULL AND coalesce(auth.role(),'')<>'service_role' THEN RAISE EXCEPTION 'Permanently removed employees cannot be edited or restored' USING ERRCODE='42501'; END IF;
IF NEW.permanently_deleted_at IS DISTINCT FROM OLD.permanently_deleted_at AND coalesce(auth.role(),'')<>'service_role' THEN RAISE EXCEPTION 'Protected removal service required' USING ERRCODE='42501'; END IF;
ELSIF NEW.permanently_deleted_at IS NOT NULL AND coalesce(auth.role(),'')<>'service_role' THEN RAISE EXCEPTION 'Protected removal service required' USING ERRCODE='42501'; END IF;
IF NEW.permanently_deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN RAISE EXCEPTION 'Permanently removed employees must remain deleted'; END IF; RETURN NEW; END $$;
CREATE TRIGGER protect_removed_employee BEFORE INSERT OR UPDATE ON public.employee_records FOR EACH ROW EXECUTE FUNCTION public.protect_removed_employee();
CREATE FUNCTION public.prepare_employee_removal(_actor uuid,_employee uuid,_confirmation text) RETURNS public.employee_removal_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE org uuid; p record; job public.employee_removal_jobs; linked boolean; paths text[]; BEGIN
IF coalesce(auth.role(),'')<>'service_role' THEN RAISE EXCEPTION 'Protected removal service required' USING ERRCODE='42501'; END IF;
SELECT org_id INTO org FROM public.profiles WHERE user_id=_actor AND deleted_at IS NULL;
IF org IS NULL OR NOT public.has_role(_actor,'admin') OR NOT public.has_workspace_access(_actor,'hr') THEN RAISE EXCEPTION 'Company administrator with HR access required' USING ERRCODE='42501'; END IF;
IF _employee=_actor OR EXISTS(SELECT 1 FROM public.platform_administrators WHERE user_id=_employee) OR public.has_role(_employee,'admin') THEN RAISE EXCEPTION 'Administrator accounts cannot be removed here' USING ERRCODE='42501'; END IF;
IF _confirmation IS DISTINCT FROM 'DELETE' THEN RAISE EXCEPTION 'Type DELETE to confirm permanent removal'; END IF;
PERFORM pg_advisory_xact_lock(hashtextextended(_employee::text,0));
SELECT * INTO job FROM public.employee_removal_jobs WHERE employee_id=_employee AND org_id=org FOR UPDATE;
IF job.id IS NOT NULL THEN RETURN job; END IF;
SELECT * INTO p FROM public.profiles WHERE user_id=_employee AND org_id=org FOR UPDATE; linked:=FOUND;
IF NOT linked THEN SELECT * INTO p FROM public.employee_records WHERE user_id=_employee AND org_id=org AND permanently_deleted_at IS NULL FOR UPDATE; END IF;
IF NOT FOUND THEN RAISE EXCEPTION 'Employee not found in your company' USING ERRCODE='42501'; END IF;
SELECT coalesce(array_agg(storage_path),'{}'::text[]) INTO paths FROM public.employee_documents WHERE employee_key=_employee AND org_id=org;
INSERT INTO public.employee_removal_jobs(org_id,employee_id,requested_by,account_linked,storage_paths) VALUES(org,_employee,_actor,linked,paths) RETURNING * INTO job;
IF linked THEN
INSERT INTO public.employee_records(user_id,first_name,last_name,department,nic_number,tan_number,person_id,social_security_number,tax_id_number,jurisdiction,status,monthly_salary,hr_details,deleted_at,permanently_deleted_at,org_id) VALUES(_employee,p.first_name,p.last_name,p.department,p.nic_number,p.tan_number,p.person_id,p.social_security_number,p.tax_id_number,p.jurisdiction,'Inactive',0,'{}',now(),now(),org);
INSERT INTO public.employee_payslips(id,payroll_run_id,user_id,period,gross_pay,basic_pay,overtime_pay,employee_nic,employer_nic,paye,total_deductions,net_pay,created_at,department_snapshot,employee_name_snapshot,currency_code,org_id) SELECT id,payroll_run_id,user_id,period,gross_pay,basic_pay,overtime_pay,employee_nic,employer_nic,paye,total_deductions,net_pay,created_at,coalesce(department_snapshot,p.department),coalesce(employee_name_snapshot,trim(p.first_name||' '||p.last_name)),currency_code,org_id FROM public.payslips WHERE user_id=_employee AND org_id=org;
DELETE FROM public.payslips WHERE user_id=_employee AND org_id=org;
UPDATE public.profiles SET deleted_at=now(),status='Inactive' WHERE user_id=_employee AND org_id=org;
ELSE
UPDATE public.employee_records SET email='',phone='',job_title='',start_date=NULL,schedule='',std_hours_per_day=0,ot_rate=0,monthly_salary=0,hr_details='{}',status='Inactive',deleted_at=now(),permanently_deleted_at=now() WHERE user_id=_employee AND org_id=org;
END IF;
UPDATE public.employee_loans SET is_active=false WHERE user_id=_employee AND org_id=org;
DELETE FROM public.employee_documents WHERE employee_key=_employee AND org_id=org;
DELETE FROM public.workforce_alerts WHERE employee_id=_employee AND org_id=org;
DELETE FROM public.workforce_punches WHERE employee_id=_employee AND org_id=org;
DELETE FROM public.workforce_shifts WHERE employee_id=_employee AND org_id=org;
DELETE FROM public.workforce_schedules WHERE employee_id=_employee AND org_id=org;
DELETE FROM public.workforce_clock_credentials WHERE employee_id=_employee AND org_id=org;
DELETE FROM public.clock_punches WHERE user_id=_employee AND org_id=org;
DELETE FROM public.simulated_attendance_punches WHERE user_id=_employee AND org_id=org;
DELETE FROM public.late_clock_in_alerts WHERE user_id=_employee AND org_id=org;
DELETE FROM public.leave_requests WHERE user_id=_employee AND org_id=org;
DELETE FROM public.leave_balances WHERE user_id=_employee AND org_id=org;
DELETE FROM public.employee_bank_info WHERE user_id=_employee AND org_id=org;
DELETE FROM public.guard_licenses WHERE user_id=_employee AND org_id=org;
DELETE FROM public.guard_assignments WHERE user_id=_employee AND org_id=org;
DELETE FROM public.crew_members WHERE user_id=_employee AND org_id=org;
DELETE FROM public.project_assignments WHERE user_id=_employee AND org_id=org;
DELETE FROM public.user_pins WHERE user_id=_employee AND org_id=org;
DELETE FROM public.user_workspace_access WHERE user_id=_employee;
DELETE FROM public.notification_settings WHERE user_id=_employee AND org_id=org;
DELETE FROM public.user_roles WHERE user_id=_employee;
UPDATE public.crews SET lead_user_id=NULL WHERE lead_user_id=_employee AND org_id=org;
INSERT INTO public.audit_logs(org_id,employee_id,action,details) VALUES(org,_employee,'employee_permanently_removed',jsonb_build_object('actor',_actor,'financial_history_retained',true,'job_id',job.id));
RETURN job;
END $$;
REVOKE ALL ON FUNCTION public.prepare_employee_removal(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_employee_removal(uuid,uuid,text) TO service_role;
CREATE FUNCTION public.finish_employee_removal(_actor uuid,_job uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE j public.employee_removal_jobs; BEGIN IF coalesce(auth.role(),'')<>'service_role' THEN RAISE EXCEPTION 'Protected removal service required'; END IF; SELECT * INTO j FROM public.employee_removal_jobs WHERE id=_job FOR UPDATE; IF j.id IS NULL OR NOT public.has_role(_actor,'admin') OR NOT public.has_workspace_access(_actor,'hr') OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE user_id=_actor AND org_id=j.org_id AND deleted_at IS NULL) THEN RAISE EXCEPTION 'Company administrator required'; END IF; DELETE FROM public.profiles WHERE user_id=j.employee_id AND org_id=j.org_id; UPDATE public.employee_removal_jobs SET status='complete',storage_paths='{}',completed_at=now() WHERE id=j.id; END $$;
REVOKE ALL ON FUNCTION public.finish_employee_removal(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finish_employee_removal(uuid,uuid) TO service_role;