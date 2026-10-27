ALTER TABLE public.profiles ADD COLUMN login_username text, ADD COLUMN is_employee boolean NOT NULL DEFAULT true;
CREATE UNIQUE INDEX profiles_login_username_unique ON public.profiles(lower(login_username)) WHERE login_username IS NOT NULL;
CREATE OR REPLACE FUNCTION public.protect_login_identity() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
 IF TG_OP='UPDATE' AND (NEW.login_username IS DISTINCT FROM OLD.login_username OR NEW.is_employee IS DISTINCT FROM OLD.is_employee OR NEW.email IS DISTINCT FROM OLD.email) AND coalesce(auth.role(),'')<>'service_role' THEN RAISE EXCEPTION 'Use administrator account management to change login or employment designation'; END IF;
 IF NEW.login_username IS NOT NULL AND NEW.login_username !~ '^[a-z0-9][a-z0-9_.-]{2,39}$' THEN RAISE EXCEPTION 'Invalid username'; END IF;
 RETURN NEW; END $$;
CREATE TRIGGER protect_login_identity BEFORE UPDATE OR INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_login_identity();
CREATE TABLE public.user_pin_attempts (user_id uuid PRIMARY KEY, failures integer NOT NULL DEFAULT 0, locked_until timestamptz);
GRANT ALL ON public.user_pin_attempts TO service_role;
ALTER TABLE public.user_pin_attempts ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.claim_user_pin_attempt(_user uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE r public.user_pin_attempts; BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Trusted account service required'; END IF;
 INSERT INTO public.user_pin_attempts(user_id) VALUES(_user) ON CONFLICT DO NOTHING;
 SELECT * INTO r FROM public.user_pin_attempts WHERE user_id=_user FOR UPDATE;
 IF r.locked_until>now() THEN RETURN false; END IF;
 IF r.locked_until IS NOT NULL THEN r.failures:=0; END IF;
 UPDATE public.user_pin_attempts SET failures=r.failures+1,locked_until=CASE WHEN r.failures+1>=5 THEN now()+interval '15 minutes' ELSE NULL END WHERE user_id=_user;
 RETURN true; END $$;
REVOKE ALL ON FUNCTION public.claim_user_pin_attempt(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_user_pin_attempt(uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.save_own_staff_information(_user uuid,_details jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE k text; v jsonb; BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Trusted account service required'; END IF;
 IF jsonb_typeof(_details)<>'object' THEN RAISE EXCEPTION 'Invalid personal information'; END IF;
 FOR k,v IN SELECT * FROM jsonb_each(_details) LOOP
 IF k NOT IN ('date_of_birth','gender','marital_status','nationality','address','city','country','personal_email','emergency_name','emergency_relationship','emergency_phone') OR jsonb_typeof(v)<>'string' OR length(v#>>'{}')>(CASE WHEN k='address' THEN 500 ELSE 100 END) THEN RAISE EXCEPTION 'Invalid personal field'; END IF;
 END LOOP;
 UPDATE public.profiles SET hr_details=hr_details||_details WHERE user_id=_user AND org_id IS NOT NULL AND deleted_at IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'Active company profile required'; END IF;
 END $$;
REVOKE ALL ON FUNCTION public.save_own_staff_information(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_own_staff_information(uuid,jsonb) TO service_role;
CREATE OR REPLACE VIEW public.payroll_employee_directory WITH (security_invoker=true) AS SELECT id,user_id,first_name,last_name,email,phone,department,job_title,nic_number,tan_number,person_id,start_date,schedule,std_hours_per_day,ot_rate,monthly_salary,status,created_at,updated_at,jurisdiction,social_security_number,tax_id_number,hr_details,deleted_at,true AS account_linked,org_id FROM public.profiles WHERE is_employee UNION ALL SELECT id,user_id,first_name,last_name,email,phone,department,job_title,nic_number,tan_number,person_id,start_date,schedule,std_hours_per_day,ot_rate,monthly_salary,status,created_at,updated_at,jurisdiction,social_security_number,tax_id_number,hr_details,deleted_at,false AS account_linked,org_id FROM public.employee_records WHERE permanently_deleted_at IS NULL;