CREATE INDEX IF NOT EXISTS workforce_alerts_open_org_idx ON public.workforce_alerts (org_id, created_at DESC) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS profiles_org_live_idx ON public.profiles (org_id) WHERE deleted_at IS NULL;
DROP INDEX IF EXISTS public.idx_profiles_user_id;