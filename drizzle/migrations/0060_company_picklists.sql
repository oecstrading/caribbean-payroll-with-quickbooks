CREATE TABLE public.company_picklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL DEFAULT public.current_org_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  list_key text NOT NULL CHECK (list_key ~ '^[a-z_]{1,40}$'),
  items text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, list_key),
  CHECK (cardinality(items) <= 300)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_picklists TO authenticated;
GRANT ALL ON public.company_picklists TO service_role;
ALTER TABLE public.company_picklists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company members read lists" ON public.company_picklists FOR SELECT TO authenticated USING (org_id = public.current_org_id());
CREATE POLICY "Managers insert lists" ON public.company_picklists FOR INSERT TO authenticated WITH CHECK (org_id = public.current_org_id() AND public.is_admin_or_manager(auth.uid()));
CREATE POLICY "Managers update lists" ON public.company_picklists FOR UPDATE TO authenticated USING (org_id = public.current_org_id() AND public.is_admin_or_manager(auth.uid())) WITH CHECK (org_id = public.current_org_id());
CREATE POLICY "Managers delete lists" ON public.company_picklists FOR DELETE TO authenticated USING (org_id = public.current_org_id() AND public.is_admin_or_manager(auth.uid()));