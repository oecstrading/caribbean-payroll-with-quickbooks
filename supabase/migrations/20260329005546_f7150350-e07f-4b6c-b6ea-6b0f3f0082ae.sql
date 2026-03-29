
-- Create incident-audio storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('incident-audio', 'incident-audio', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload audio
CREATE POLICY "Authenticated users can upload audio"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'incident-audio');

-- Allow authenticated users to read audio
CREATE POLICY "Authenticated users can read audio"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'incident-audio');

-- Add columns to incident_reports for AI voice features
ALTER TABLE public.incident_reports
ADD COLUMN IF NOT EXISTS audio_url TEXT,
ADD COLUMN IF NOT EXISTS raw_transcript TEXT,
ADD COLUMN IF NOT EXISTS ai_draft TEXT,
ADD COLUMN IF NOT EXISTS is_ai_generated BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS reviewed_by UUID,
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
