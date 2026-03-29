
-- Allow anonymous/public read for client portal access (code-based auth)
CREATE POLICY "Public can verify access codes" ON public.client_portal_access
  FOR SELECT TO anon
  USING (is_active = true);

-- Allow anon to read client_sites by id (for client portal)
CREATE POLICY "Anon can read sites by id" ON public.client_sites
  FOR SELECT TO anon
  USING (true);

-- Allow anon to read patrol logs (for client portal)
CREATE POLICY "Anon can read patrol logs" ON public.patrol_logs
  FOR SELECT TO anon
  USING (true);

-- Allow anon to read incident reports (for client portal)
CREATE POLICY "Anon can read incidents" ON public.incident_reports
  FOR SELECT TO anon
  USING (true);

-- Allow anon to read sign-offs (for client portal)
CREATE POLICY "Anon can read signoffs" ON public.post_order_signoffs
  FOR SELECT TO anon
  USING (true);
