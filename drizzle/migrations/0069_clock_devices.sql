CREATE TABLE public.clock_devices (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
 name text NOT NULL,
 department text,
 site_id uuid REFERENCES public.client_sites(id) ON DELETE SET NULL,
 activation_hash text,
 activation_expires_at timestamptz,
 token_hash text,
 activated_at timestamptz,
 last_seen_at timestamptz,
 revoked_at timestamptz,
 created_by uuid,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX clock_devices_token_key ON public.clock_devices(token_hash) WHERE token_hash IS NOT NULL;
CREATE INDEX clock_devices_org_idx ON public.clock_devices(org_id);
GRANT SELECT ON public.clock_devices TO authenticated;
GRANT ALL ON public.clock_devices TO service_role;
ALTER TABLE public.clock_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company admins view clock devices" ON public.clock_devices FOR SELECT TO authenticated
 USING (org_id = public.current_org_id() AND public.actor_manages_org(auth.uid(), org_id));
REVOKE SELECT (activation_hash, token_hash) ON public.clock_devices FROM authenticated;

ALTER TABLE public.workforce_clock_settings ADD COLUMN IF NOT EXISTS selfie_policy text NOT NULL DEFAULT 'optional';
ALTER TABLE public.workforce_clock_settings ADD CONSTRAINT workforce_clock_settings_selfie_policy_check CHECK (selfie_policy IN ('optional','always'));
ALTER TABLE public.workforce_punches ADD COLUMN IF NOT EXISTS device_id uuid REFERENCES public.clock_devices(id) ON DELETE SET NULL;
ALTER TABLE public.workforce_punches ADD COLUMN IF NOT EXISTS photo_path text;

CREATE OR REPLACE FUNCTION public.create_clock_device(_name text, _department text, _site uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$ DECLARE org uuid := public.current_org_id(); code text; d public.clock_devices; BEGIN
 IF org IS NULL OR NOT public.actor_manages_org(auth.uid(), org) THEN RAISE EXCEPTION 'Company administrator required'; END IF;
 IF coalesce(btrim(_name),'') = '' OR length(_name) > 80 THEN RAISE EXCEPTION 'Give the clock a name'; END IF;
 IF _site IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.client_sites WHERE id=_site AND org_id=org) THEN RAISE EXCEPTION 'Work site not found'; END IF;
 code := upper(substr(encode(gen_random_bytes(6),'hex'),1,8));
 INSERT INTO public.clock_devices(org_id,name,department,site_id,activation_hash,activation_expires_at,created_by)
 VALUES(org,btrim(_name),nullif(btrim(coalesce(_department,'')),''),_site,encode(digest(code,'sha256'),'hex'),now()+interval '15 minutes',auth.uid()) RETURNING * INTO d;
 RETURN jsonb_build_object('id',d.id,'code',code,'expires_at',d.activation_expires_at);
END $$;

CREATE OR REPLACE FUNCTION public.renew_clock_device_code(_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$ DECLARE code text; d public.clock_devices; BEGIN
 SELECT * INTO d FROM public.clock_devices WHERE id=_id AND org_id=public.current_org_id();
 IF d.id IS NULL OR NOT public.actor_manages_org(auth.uid(), d.org_id) THEN RAISE EXCEPTION 'Company administrator required'; END IF;
 code := upper(substr(encode(gen_random_bytes(6),'hex'),1,8));
 -- A new code replaces the old tablet link, so a lost tablet stops working once re-activated elsewhere.
 UPDATE public.clock_devices SET activation_hash=encode(digest(code,'sha256'),'hex'), activation_expires_at=now()+interval '15 minutes', token_hash=NULL, activated_at=NULL, revoked_at=NULL WHERE id=_id RETURNING * INTO d;
 RETURN jsonb_build_object('id',d.id,'code',code,'expires_at',d.activation_expires_at);
END $$;

CREATE OR REPLACE FUNCTION public.revoke_clock_device(_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.clock_devices WHERE id=_id AND org_id=public.current_org_id()) OR NOT public.actor_manages_org(auth.uid(), public.current_org_id()) THEN RAISE EXCEPTION 'Company administrator required'; END IF;
 UPDATE public.clock_devices SET revoked_at=now(), token_hash=NULL, activation_hash=NULL WHERE id=_id;
END $$;

CREATE OR REPLACE FUNCTION public.set_selfie_policy(_policy text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$ DECLARE org uuid := public.current_org_id(); BEGIN
 IF org IS NULL OR NOT public.actor_manages_org(auth.uid(), org) THEN RAISE EXCEPTION 'Company administrator required'; END IF;
 IF _policy NOT IN ('optional','always') THEN RAISE EXCEPTION 'Invalid selfie setting'; END IF;
 INSERT INTO public.workforce_clock_settings(org_id,selfie_policy) VALUES(org,_policy) ON CONFLICT(org_id) DO UPDATE SET selfie_policy=excluded.selfie_policy;
END $$;

REVOKE ALL ON FUNCTION public.create_clock_device(text,text,uuid), public.renew_clock_device_code(uuid), public.revoke_clock_device(uuid), public.set_selfie_policy(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_clock_device(text,text,uuid), public.renew_clock_device_code(uuid), public.revoke_clock_device(uuid), public.set_selfie_policy(text) TO authenticated;

CREATE POLICY "Company admins view clock selfies" ON storage.objects FOR SELECT TO authenticated
 USING (bucket_id='clock-selfies' AND (storage.foldername(name))[1] = public.current_org_id()::text AND public.is_admin_or_manager(auth.uid()));