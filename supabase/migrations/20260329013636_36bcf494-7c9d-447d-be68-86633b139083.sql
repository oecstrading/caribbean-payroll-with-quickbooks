
CREATE TABLE public.late_clock_in_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  site_id UUID NOT NULL,
  shift_date DATE NOT NULL DEFAULT CURRENT_DATE,
  shift_start TIME NOT NULL,
  late_minutes INTEGER NOT NULL DEFAULT 0,
  alert_sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  clock_in_at TIMESTAMP WITH TIME ZONE,
  UNIQUE (user_id, site_id, shift_date)
);

ALTER TABLE public.late_clock_in_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view late alerts"
  ON public.late_clock_in_alerts FOR SELECT
  TO authenticated
  USING (is_admin_or_manager(auth.uid()));

CREATE POLICY "Service can insert late alerts"
  ON public.late_clock_in_alerts FOR INSERT
  TO authenticated
  WITH CHECK (true);
