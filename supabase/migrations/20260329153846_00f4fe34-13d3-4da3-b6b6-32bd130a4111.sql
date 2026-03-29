
-- Create training_documents table
CREATE TABLE public.training_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL DEFAULT '',
  description TEXT DEFAULT '',
  category TEXT NOT NULL DEFAULT 'general',
  file_name TEXT NOT NULL DEFAULT '',
  file_url TEXT NOT NULL DEFAULT '',
  file_size BIGINT DEFAULT 0,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.training_documents ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can view
CREATE POLICY "Authenticated can view training documents"
  ON public.training_documents FOR SELECT
  TO authenticated
  USING (true);

-- Admins/managers can manage
CREATE POLICY "Admins can manage training documents"
  ON public.training_documents FOR ALL
  TO authenticated
  USING (is_admin_or_manager(auth.uid()))
  WITH CHECK (is_admin_or_manager(auth.uid()));

-- Create storage bucket for training docs
INSERT INTO storage.buckets (id, name, public) VALUES ('training-docs', 'training-docs', true);

-- Storage policies
CREATE POLICY "Authenticated can view training files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'training-docs');

CREATE POLICY "Admins can upload training files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'training-docs' AND public.is_admin_or_manager(auth.uid()));

CREATE POLICY "Admins can delete training files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'training-docs' AND public.is_admin_or_manager(auth.uid()));
