-- Client portal: replace anon table reads with a code-checked RPC
DROP POLICY IF EXISTS "Anon can read incidents" ON public.incident_reports;
DROP POLICY IF EXISTS "Anon can read sites by id" ON public.client_sites;
DROP POLICY IF EXISTS "Anon can read patrol logs" ON public.patrol_logs;
DROP POLICY IF EXISTS "Anon can read signoffs" ON public.post_order_signoffs;

CREATE OR REPLACE FUNCTION public.client_portal_data(_code text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.client_portal_access;
BEGIN
  IF _code IS NULL OR length(trim(_code)) = 0 OR length(_code) > 100 THEN RETURN NULL; END IF;
  SELECT * INTO a FROM public.client_portal_access WHERE access_code = trim(_code) AND is_active LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'site', (SELECT jsonb_build_object('id',s.id,'name',s.name,'address',s.address,'client_name',s.client_name,'status',s.status,'post_orders',s.post_orders) FROM public.client_sites s WHERE s.id = a.site_id),
    'patrols', coalesce((SELECT jsonb_agg(to_jsonb(p) - 'user_id') FROM (SELECT * FROM public.patrol_logs WHERE site_id = a.site_id ORDER BY scanned_at DESC LIMIT 50) p), '[]'::jsonb),
    'incidents', coalesce((SELECT jsonb_agg(jsonb_build_object('id',i.id,'title',i.title,'description',i.description,'severity',i.severity,'status',i.status,'reported_at',i.reported_at,'resolved_at',i.resolved_at)) FROM (SELECT * FROM public.incident_reports WHERE site_id = a.site_id ORDER BY reported_at DESC LIMIT 20) i), '[]'::jsonb),
    'signoffs', coalesce((SELECT jsonb_agg(jsonb_build_object('id',o.id,'signed_at',o.signed_at)) FROM (SELECT * FROM public.post_order_signoffs WHERE site_id = a.site_id ORDER BY signed_at DESC LIMIT 20) o), '[]'::jsonb)
  );
END $$;
REVOKE ALL ON FUNCTION public.client_portal_data(text) FROM public;
GRANT EXECUTE ON FUNCTION public.client_portal_data(text) TO anon, authenticated;

-- HR-only data
DROP POLICY IF EXISTS "Authenticated users can view payroll runs" ON public.payroll_runs;
CREATE POLICY "HR can view payroll runs" ON public.payroll_runs FOR SELECT TO authenticated USING (public.is_admin_or_manager(auth.uid()));
DROP POLICY IF EXISTS "Authenticated can view creditors" ON public.creditors;

-- Staff reference data: only users holding an app role
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id)
$$;

DROP POLICY IF EXISTS "Employees can view projects" ON public.projects;
CREATE POLICY "Staff can view projects" ON public.projects FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "Authenticated can view jurisdictions" ON public.jurisdictions;
CREATE POLICY "Staff can view jurisdictions" ON public.jurisdictions FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "Authenticated can view geofence zones" ON public.geofence_zones;
CREATE POLICY "Staff can view geofence zones" ON public.geofence_zones FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "Authenticated can view training documents" ON public.training_documents;
CREATE POLICY "Staff can view training documents" ON public.training_documents FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "Employees can view crews" ON public.crews;
CREATE POLICY "Staff can view crews" ON public.crews FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "Authenticated can view company settings" ON public.company_settings;
CREATE POLICY "Staff can view company settings" ON public.company_settings FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "Signed in users read simulation clock" ON public.attendance_simulation_clock;
CREATE POLICY "Staff read simulation clock" ON public.attendance_simulation_clock FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "Employees can view equipment" ON public.equipment;
CREATE POLICY "Staff can view equipment" ON public.equipment FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- Storage: bind uploads to the uploader's folder; scope reads
DROP POLICY IF EXISTS "Authenticated can upload field photos" ON storage.objects;
CREATE POLICY "Users upload own field photos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'field-photos' AND (storage.foldername(name))[2] = auth.uid()::text);
DROP POLICY IF EXISTS "Authenticated users can upload audio" ON storage.objects;
CREATE POLICY "Users upload own audio" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'incident-audio' AND (storage.foldername(name))[2] = auth.uid()::text);
DROP POLICY IF EXISTS "Authenticated users can read audio" ON storage.objects;
CREATE POLICY "Owners and HR read audio" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'incident-audio' AND ((storage.foldername(name))[2] = auth.uid()::text OR public.is_admin_or_manager(auth.uid())));
DROP POLICY IF EXISTS "Authenticated can view training files" ON storage.objects;
CREATE POLICY "Staff view training files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'training-docs' AND public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "Anyone can view field photos" ON storage.objects;
CREATE POLICY "Owners and HR view field photos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'field-photos' AND ((storage.foldername(name))[2] = auth.uid()::text OR public.is_admin_or_manager(auth.uid())));
DROP POLICY IF EXISTS "Anyone can view company assets" ON storage.objects;
CREATE POLICY "Staff view company assets" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'company-assets' AND public.is_staff(auth.uid()));