ALTER TABLE public.workforce_clock_settings ADD COLUMN IF NOT EXISTS grace_minutes integer NOT NULL DEFAULT 15 CHECK (grace_minutes BETWEEN 0 AND 120);
CREATE OR REPLACE FUNCTION public.set_clock_grace(_minutes integer)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$ BEGIN
IF NOT public.is_admin_or_manager(auth.uid()) OR NOT public.has_workspace_access(auth.uid(),'attendance') OR public.current_org_id() IS NULL THEN RAISE EXCEPTION 'Company attendance manager required'; END IF;
IF _minutes IS NULL OR _minutes < 0 OR _minutes > 120 THEN RAISE EXCEPTION 'Grace must be 0-120 minutes'; END IF;
INSERT INTO public.workforce_clock_settings(org_id,grace_minutes) VALUES(public.current_org_id(),_minutes) ON CONFLICT(org_id) DO UPDATE SET grace_minutes=EXCLUDED.grace_minutes; END $$;
REVOKE ALL ON FUNCTION public.set_clock_grace(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_clock_grace(integer) TO authenticated;