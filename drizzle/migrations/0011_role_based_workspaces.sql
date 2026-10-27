CREATE TABLE public.user_workspace_access (user_id uuid PRIMARY KEY, modules text[] NOT NULL DEFAULT '{}', updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid);
GRANT SELECT ON public.user_workspace_access TO authenticated;
GRANT ALL ON public.user_workspace_access TO service_role;
ALTER TABLE public.user_workspace_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own or administer workspace" ON public.user_workspace_access FOR SELECT TO authenticated USING (user_id=auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE FUNCTION public.has_workspace_access(_user_id uuid, _module text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=_user_id AND (r.role='admin' OR (_module IN ('hr','payroll','reports','attendance','leave','recruitment','field','security','billing','training','quickbooks','settings') AND (r.role='manager' OR _module IN ('attendance','field','security','training')) AND CASE WHEN EXISTS(SELECT 1 FROM public.user_workspace_access a WHERE a.user_id=_user_id) THEN EXISTS(SELECT 1 FROM public.user_workspace_access a WHERE a.user_id=_user_id AND _module=ANY(a.modules)) ELSE true END))) $$;
REVOKE ALL ON FUNCTION public.has_workspace_access(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_workspace_access(uuid,text) TO authenticated,service_role;
CREATE FUNCTION public.set_user_workspace_access(_user_id uuid,_role public.app_role,_modules text[]) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Only administrators can assign roles and access'; END IF;
IF _role IS NULL OR _modules IS NULL OR EXISTS(SELECT 1 FROM unnest(_modules) m WHERE m IS NULL OR m NOT IN ('hr','payroll','reports','attendance','leave','recruitment','field','security','billing','training','quickbooks','settings')) THEN RAISE EXCEPTION 'Invalid workspace access'; END IF;
IF _role='employee' AND EXISTS(SELECT 1 FROM unnest(_modules) m WHERE m NOT IN ('attendance','field','security','training')) THEN RAISE EXCEPTION 'Employee access cannot include management pages'; END IF;
IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE user_id=_user_id) THEN RAISE EXCEPTION 'User not found'; END IF;
IF public.has_role(_user_id,'admin') AND _role<>'admin' THEN RAISE EXCEPTION 'Administrators must retain full access'; END IF;
PERFORM pg_advisory_xact_lock(hashtext(_user_id::text));
DELETE FROM public.user_roles WHERE user_id=_user_id;
INSERT INTO public.user_roles(user_id,role) VALUES(_user_id,_role);
INSERT INTO public.user_workspace_access(user_id,modules,updated_by) VALUES(_user_id,_modules,auth.uid()) ON CONFLICT(user_id) DO UPDATE SET modules=excluded.modules,updated_at=now(),updated_by=auth.uid();
END $$;
REVOKE ALL ON FUNCTION public.set_user_workspace_access(uuid,public.app_role,text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_user_workspace_access(uuid,public.app_role,text[]) TO authenticated;
CREATE FUNCTION public.protect_workspace_admin() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
IF OLD.role='admin' AND (TG_OP='DELETE' OR NEW.role<>'admin') AND NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=OLD.user_id AND role='admin' AND id<>OLD.id) THEN
IF TG_OP='DELETE' AND current_query() LIKE '%set_user_workspace_access%' THEN RETURN OLD; END IF;
RAISE EXCEPTION 'Administrators must retain full access'; END IF;
IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW; END $$;
-- Role assignment uses an update for existing administrator rows; their protected role is never removed.
CREATE OR REPLACE FUNCTION public.set_user_workspace_access(_user_id uuid,_role public.app_role,_modules text[]) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Only administrators can assign roles and access'; END IF;
IF _role IS NULL OR _modules IS NULL OR EXISTS(SELECT 1 FROM unnest(_modules) m WHERE m IS NULL OR m NOT IN ('hr','payroll','reports','attendance','leave','recruitment','field','security','billing','training','quickbooks','settings')) THEN RAISE EXCEPTION 'Invalid workspace access'; END IF;
IF _role='employee' AND EXISTS(SELECT 1 FROM unnest(_modules) m WHERE m NOT IN ('attendance','field','security','training')) THEN RAISE EXCEPTION 'Employee access cannot include management pages'; END IF;
IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE user_id=_user_id) THEN RAISE EXCEPTION 'User not found'; END IF;
PERFORM pg_advisory_xact_lock(hashtext(_user_id::text));
IF public.has_role(_user_id,'admin') THEN
IF _role<>'admin' THEN RAISE EXCEPTION 'Administrators must retain full access'; END IF;
ELSE
DELETE FROM public.user_roles WHERE user_id=_user_id;
INSERT INTO public.user_roles(user_id,role) VALUES(_user_id,_role);
END IF;
INSERT INTO public.user_workspace_access(user_id,modules,updated_by) VALUES(_user_id,_modules,auth.uid()) ON CONFLICT(user_id) DO UPDATE SET modules=excluded.modules,updated_at=now(),updated_by=auth.uid();
END $$;
CREATE TRIGGER protect_workspace_admin BEFORE UPDATE OR DELETE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.protect_workspace_admin();
DO $$ DECLARE item record; expression text; BEGIN
FOR item IN SELECT * FROM (VALUES
('applicants','recruitment'),('applicant_documents','recruitment'),('employee_records','hr,payroll'),('employee_payslips','payroll,reports'),('employee_additions','payroll'),('employee_deductions','payroll'),('creditors','payroll'),('payroll_runs','payroll,reports'),('client_invoices','billing'),('invoice_line_items','billing'),('contractors','billing'),('contractor_payments','billing'),('projects','field,billing'),('project_assignments','field,billing'),('project_time_logs','field,billing'),('crews','field'),('crew_members','field'),('equipment','field'),('equipment_checkouts','field'),('daily_reports','field'),('client_sites','security,billing'),('client_portal_access','security'),('guard_assignments','security'),('guard_licenses','security'),('patrol_logs','security'),('post_order_signoffs','security'),('incident_reports','security'),('late_clock_in_alerts','security'),('geofence_zones','security,attendance'),('training_documents','training'),('qbo_account_mappings','quickbooks'),('qbo_chart_of_accounts','quickbooks'),('qbo_connection','quickbooks'),('qbo_employee_map','quickbooks'),('qbo_sync_log','quickbooks')) AS v(t,mods) LOOP
SELECT string_agg(format('public.has_workspace_access(auth.uid(),%L)',m),' OR ') INTO expression FROM unnest(string_to_array(item.mods,',')) m;
EXECUTE format('CREATE POLICY workspace_module_gate ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (%s) WITH CHECK (%s)',item.t,expression,expression);
END LOOP;
END $$;
CREATE POLICY workspace_profile_gate ON public.profiles AS RESTRICTIVE FOR ALL TO authenticated USING (user_id=auth.uid() OR public.has_workspace_access(auth.uid(),'hr') OR public.has_workspace_access(auth.uid(),'payroll') OR public.has_workspace_access(auth.uid(),'security')) WITH CHECK (user_id=auth.uid() OR public.has_workspace_access(auth.uid(),'hr'));
CREATE POLICY workspace_bank_gate ON public.employee_bank_info AS RESTRICTIVE FOR ALL TO authenticated USING (user_id=auth.uid() OR public.has_workspace_access(auth.uid(),'hr') OR public.has_workspace_access(auth.uid(),'payroll')) WITH CHECK (user_id=auth.uid() OR public.has_workspace_access(auth.uid(),'hr'));
CREATE POLICY workspace_payslip_gate ON public.payslips AS RESTRICTIVE FOR SELECT TO authenticated USING (user_id=auth.uid() OR public.has_workspace_access(auth.uid(),'payroll') OR public.has_workspace_access(auth.uid(),'reports'));
CREATE POLICY workspace_leave_gate ON public.leave_requests AS RESTRICTIVE FOR ALL TO authenticated USING (user_id=auth.uid() OR public.has_workspace_access(auth.uid(),'leave')) WITH CHECK (user_id=auth.uid() OR public.has_workspace_access(auth.uid(),'leave'));
CREATE POLICY workspace_balance_gate ON public.leave_balances AS RESTRICTIVE FOR ALL TO authenticated USING (user_id=auth.uid() OR public.has_workspace_access(auth.uid(),'leave')) WITH CHECK (user_id=auth.uid() OR public.has_workspace_access(auth.uid(),'leave'));
CREATE POLICY workspace_clock_gate ON public.clock_punches AS RESTRICTIVE FOR ALL TO authenticated USING (public.has_workspace_access(auth.uid(),'attendance') OR public.has_workspace_access(auth.uid(),'security')) WITH CHECK (public.has_workspace_access(auth.uid(),'attendance') OR public.has_workspace_access(auth.uid(),'security'));
CREATE POLICY workspace_settings_gate ON public.company_settings AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.has_workspace_access(auth.uid(),'settings')) WITH CHECK (public.has_workspace_access(auth.uid(),'settings'));
CREATE POLICY workspace_document_gate ON public.employee_documents AS RESTRICTIVE FOR ALL TO authenticated USING (employee_key=auth.uid() AND employee_visible OR public.has_workspace_access(auth.uid(),'hr')) WITH CHECK (public.has_workspace_access(auth.uid(),'hr'));
DO $$ DECLARE f record; module text; definition text; BEGIN
FOR f IN SELECT oid,proname FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('approve_payroll_run','approve_department_payroll','reset_attendance_simulation','record_simulated_punch') LOOP
module:=CASE WHEN f.proname LIKE 'approve_%' THEN 'payroll' ELSE 'attendance' END;
definition:=pg_get_functiondef(f.oid);
definition:=regexp_replace(definition,'\mBEGIN\M',format('BEGIN IF NOT public.has_workspace_access(auth.uid(),%L) THEN RAISE EXCEPTION ''Workspace access denied''; END IF;',module),'i');
EXECUTE definition;
END LOOP; END $$;