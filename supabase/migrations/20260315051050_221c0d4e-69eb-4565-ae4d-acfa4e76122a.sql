
-- Project time logs for tracking hours per project
CREATE TABLE public.project_time_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  hours NUMERIC NOT NULL DEFAULT 0,
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.project_time_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage time logs" ON public.project_time_logs FOR ALL TO authenticated
  USING (is_admin_or_manager(auth.uid())) WITH CHECK (is_admin_or_manager(auth.uid()));
CREATE POLICY "Users can manage their own time logs" ON public.project_time_logs FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Add photo_urls column to daily_reports
ALTER TABLE public.daily_reports ADD COLUMN photo_urls TEXT[] DEFAULT '{}';

-- Storage bucket for field report photos
INSERT INTO storage.buckets (id, name, public) VALUES ('field-photos', 'field-photos', true);

-- Storage RLS
CREATE POLICY "Authenticated can upload field photos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'field-photos');
CREATE POLICY "Anyone can view field photos" ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'field-photos');
CREATE POLICY "Admins can delete field photos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'field-photos' AND is_admin_or_manager(auth.uid()));
