ALTER TABLE public.employee_records ADD COLUMN login_user_id uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL;
CREATE UNIQUE INDEX employee_records_login_user_id_key ON public.employee_records(login_user_id) WHERE login_user_id IS NOT NULL;
CREATE OR REPLACE FUNCTION public.protect_employee_login_link() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN IF (TG_OP='INSERT' AND NEW.login_user_id IS NOT NULL OR TG_OP='UPDATE' AND NEW.login_user_id IS DISTINCT FROM OLD.login_user_id) AND current_user NOT IN ('postgres','supabase_admin') AND auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Trusted account service required'; END IF; RETURN NEW; END $$;
CREATE TRIGGER protect_employee_login_link BEFORE INSERT OR UPDATE ON public.employee_records FOR EACH ROW EXECUTE FUNCTION public.protect_employee_login_link();
CREATE OR REPLACE FUNCTION public.link_employee_login(_actor uuid,_employee uuid,_user uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE company uuid; BEGIN
IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Trusted account service required'; END IF;
SELECT org_id INTO company FROM public.profiles WHERE user_id=_actor AND deleted_at IS NULL;
IF company IS NULL OR NOT public.has_role(_actor,'admin') OR NOT public.has_workspace_access(_actor,'hr') THEN RAISE EXCEPTION 'Company administrator with HR access required'; END IF;
PERFORM 1 FROM public.employee_records WHERE user_id=_employee AND org_id=company AND deleted_at IS NULL AND permanently_deleted_at IS NULL AND login_user_id IS NULL FOR UPDATE;
IF NOT FOUND THEN RAISE EXCEPTION 'Employee already linked or unavailable'; END IF;
PERFORM 1 FROM public.profiles WHERE user_id=_user AND org_id=company AND deleted_at IS NULL AND is_employee=false FOR UPDATE;
IF NOT FOUND THEN RAISE EXCEPTION 'Separate company login required'; END IF;
UPDATE public.employee_records SET login_user_id=_user WHERE user_id=_employee AND org_id=company;
END $$;
REVOKE ALL ON FUNCTION public.link_employee_login(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.link_employee_login(uuid,uuid,uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.staff_employment_key() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT coalesce((SELECT user_id FROM public.employee_records WHERE login_user_id=auth.uid() AND org_id=public.current_org_id() AND deleted_at IS NULL AND permanently_deleted_at IS NULL),auth.uid()) $$;
REVOKE ALL ON FUNCTION public.staff_employment_key() FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.staff_employment_key() TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.has_employee_clock_access(_employee uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.workforce_schedules s JOIN public.organizations o ON o.id=s.org_id WHERE s.enabled AND 'attendance'=ANY(o.enabled_modules) AND (EXISTS(SELECT 1 FROM public.profiles p WHERE p.user_id=_employee AND p.user_id=s.employee_id AND p.org_id=s.org_id AND p.deleted_at IS NULL AND lower(p.status)='active') OR EXISTS(SELECT 1 FROM public.employee_records e WHERE e.login_user_id=_employee AND e.user_id=s.employee_id AND e.org_id=s.org_id AND e.deleted_at IS NULL AND e.permanently_deleted_at IS NULL AND lower(e.status)='active'))) $$;
CREATE OR REPLACE FUNCTION public.sync_linked_staff_personal_information() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE details jsonb; BEGIN
SELECT coalesce(jsonb_object_agg(key,value),'{}'::jsonb) INTO details FROM jsonb_each(NEW.hr_details) WHERE key IN ('date_of_birth','gender','marital_status','nationality','address','city','country','personal_email','emergency_name','emergency_relationship','emergency_phone');
UPDATE public.employee_records SET hr_details=hr_details||details WHERE login_user_id=NEW.user_id AND org_id=NEW.org_id AND deleted_at IS NULL AND permanently_deleted_at IS NULL;
RETURN NEW; END $$;
CREATE TRIGGER sync_linked_staff_personal_information AFTER UPDATE OF hr_details ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.sync_linked_staff_personal_information();