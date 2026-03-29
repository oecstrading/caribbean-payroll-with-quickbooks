
DROP POLICY "Service can insert late alerts" ON public.late_clock_in_alerts;

CREATE POLICY "Admins can insert late alerts"
  ON public.late_clock_in_alerts FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_or_manager(auth.uid()));
