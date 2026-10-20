CREATE OR REPLACE FUNCTION public.validate_employee_folder()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE k text; v jsonb; privileged boolean;
BEGIN
 privileged := coalesce(auth.role()='service_role',false) OR public.is_admin_or_manager(auth.uid());
 IF TG_OP='UPDATE' AND NOT privileged AND (to_jsonb(NEW)-ARRAY['first_name','last_name','phone','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['first_name','last_name','phone','updated_at']) THEN RAISE EXCEPTION 'Only HR administrators and managers can update employment details' USING ERRCODE='42501'; END IF;
 IF TG_OP='INSERT' AND NOT privileged AND (NEW.hr_details<>'{}'::jsonb OR NEW.deleted_at IS NOT NULL OR coalesce(NEW.monthly_salary,0)<>0 OR NEW.department IS NOT NULL OR NEW.job_title IS NOT NULL) THEN RAISE EXCEPTION 'Only HR administrators can create employment details' USING ERRCODE='42501'; END IF;
 IF TG_OP='UPDATE' AND NEW.deleted_at IS DISTINCT FROM OLD.deleted_at AND NOT (coalesce(auth.role()='service_role',false) OR public.has_role(auth.uid(),'admin')) THEN RAISE EXCEPTION 'Only administrators can delete or restore employee folders' USING ERRCODE='42501'; END IF;
 IF TG_OP='UPDATE' AND NEW.deleted_at IS NOT NULL AND NEW.user_id=auth.uid() THEN RAISE EXCEPTION 'You cannot delete your own employee folder'; END IF;
 IF length(NEW.first_name)>100 OR length(NEW.last_name)>100 OR length(NEW.email)>255 OR coalesce(length(NEW.phone),0)>40 OR coalesce(length(NEW.department),0)>100 OR coalesce(length(NEW.job_title),0)>100 OR coalesce(length(NEW.nic_number),0)>100 OR coalesce(length(NEW.tan_number),0)>100 OR coalesce(length(NEW.person_id),0)>100 OR coalesce(length(NEW.schedule),0)>100 THEN RAISE EXCEPTION 'Employee field exceeds its allowed length'; END IF;
 IF coalesce(NEW.monthly_salary,0)<0 OR coalesce(NEW.std_hours_per_day,0) NOT BETWEEN 0 AND 24 OR coalesce(NEW.ot_rate,0) NOT BETWEEN 0 AND 10 THEN RAISE EXCEPTION 'Invalid salary, daily hours, or overtime multiplier'; END IF;
 IF jsonb_typeof(NEW.hr_details)<>'object' THEN RAISE EXCEPTION 'HR details must be an object'; END IF;
 FOR k,v IN SELECT * FROM jsonb_each(NEW.hr_details) LOOP
 IF k NOT IN ('date_of_birth','gender','marital_status','nationality','address','city','country','personal_email','emergency_name','emergency_relationship','emergency_phone','employment_type','work_location','supervisor','probation_end','contract_end','termination_date','termination_reason','pay_frequency','pay_rate','notes') THEN RAISE EXCEPTION 'Unknown HR field: %',k; END IF;
 IF jsonb_typeof(v)<>'string' OR length(v #>> '{}') > (CASE WHEN k='notes' THEN 2000 WHEN k IN ('address','termination_reason') THEN 500 ELSE 100 END) THEN RAISE EXCEPTION 'Invalid HR value: %',k; END IF;
 IF k IN ('date_of_birth','probation_end','contract_end','termination_date') AND (v #>> '{}')<>'' THEN
 IF (v #>> '{}') !~ '^\d{4}-\d{2}-\d{2}$' THEN RAISE EXCEPTION 'Invalid date: %',k; END IF;
 PERFORM (v #>> '{}')::date;
 END IF;
 IF k='personal_email' AND (v #>> '{}')<>'' AND (v #>> '{}') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'Invalid personal email'; END IF;
 IF k='employment_type' AND (v #>> '{}') NOT IN ('','Full-time','Part-time','Contract','Temporary','Intern') THEN RAISE EXCEPTION 'Invalid employment type'; END IF;
 IF k='pay_frequency' AND (v #>> '{}') NOT IN ('','Monthly','Semi-monthly','Fortnightly','Weekly','Daily','Hourly') THEN RAISE EXCEPTION 'Invalid pay frequency'; END IF;
 IF k='pay_rate' AND (v #>> '{}')<>'' AND ((v #>> '{}') !~ '^\d{1,9}(\.\d{1,2})?$') THEN RAISE EXCEPTION 'Invalid pay rate'; END IF;
 END LOOP;
 IF coalesce(NEW.hr_details->>'date_of_birth','')<>'' AND (NEW.hr_details->>'date_of_birth')::date>CURRENT_DATE THEN RAISE EXCEPTION 'Date of birth cannot be in the future'; END IF;
 IF NEW.start_date IS NOT NULL THEN
 FOREACH k IN ARRAY ARRAY['contract_end','probation_end','termination_date'] LOOP
 IF coalesce(NEW.hr_details->>k,'')<>'' AND (NEW.hr_details->>k)::date<NEW.start_date THEN RAISE EXCEPTION '% must be on or after start date',k; END IF;
 END LOOP;
 END IF;
 RETURN NEW;
END; $function$;