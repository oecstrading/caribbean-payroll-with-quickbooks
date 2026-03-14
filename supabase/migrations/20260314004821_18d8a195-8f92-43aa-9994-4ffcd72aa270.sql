-- Create storage bucket for company assets
INSERT INTO storage.buckets (id, name, public) VALUES ('company-assets', 'company-assets', true);

-- Allow authenticated users to view
CREATE POLICY "Anyone can view company assets" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'company-assets');

-- Only admins/managers can upload
CREATE POLICY "Admins can upload company assets" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'company-assets' AND public.is_admin_or_manager(auth.uid()));

-- Only admins/managers can update
CREATE POLICY "Admins can update company assets" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'company-assets' AND public.is_admin_or_manager(auth.uid()));

-- Only admins/managers can delete
CREATE POLICY "Admins can delete company assets" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'company-assets' AND public.is_admin_or_manager(auth.uid()));

-- Add logo_url column to company_settings
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS logo_url text DEFAULT '';