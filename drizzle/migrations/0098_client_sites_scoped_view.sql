DROP POLICY IF EXISTS "Employees can view client sites" ON public.client_sites;
CREATE POLICY "Employees can view client sites" ON public.client_sites
FOR SELECT TO authenticated
USING (org_id = public.current_org_id());