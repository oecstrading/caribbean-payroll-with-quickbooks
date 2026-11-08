CREATE OR REPLACE FUNCTION public.list_activatable_clocks()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id',d.id,'name',d.name,'department',d.department,'org_id',d.org_id,'company',o.name,
   'activated_at',d.activated_at,'last_seen_at',d.last_seen_at,'revoked_at',d.revoked_at,'activation_expires_at',d.activation_expires_at) ORDER BY o.name,d.name)
  FROM public.clock_devices d JOIN public.organizations o ON o.id=d.org_id
  WHERE public.actor_manages_org(auth.uid(), d.org_id)),'[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.bulk_issue_clock_codes(_ids uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','extensions'
AS $$ DECLARE r public.clock_devices; code text; out jsonb := '[]'::jsonb; BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 IF _ids IS NULL OR cardinality(_ids)=0 OR cardinality(_ids)>200 THEN RAISE EXCEPTION 'Choose between 1 and 200 clocks'; END IF;
 IF EXISTS(SELECT 1 FROM public.clock_devices d WHERE d.id=ANY(_ids) AND NOT public.actor_manages_org(auth.uid(), d.org_id))
   OR (SELECT count(*) FROM public.clock_devices WHERE id=ANY(_ids)) <> (SELECT count(DISTINCT x) FROM unnest(_ids) x)
 THEN RAISE EXCEPTION 'Company administrator required for every selected clock'; END IF;
 FOR r IN SELECT * FROM public.clock_devices WHERE id=ANY(_ids) ORDER BY org_id,name FOR UPDATE LOOP
  code := upper(substr(encode(gen_random_bytes(6),'hex'),1,8));
  UPDATE public.clock_devices SET activation_hash=encode(digest(code,'sha256'),'hex'), activation_expires_at=now()+interval '15 minutes', token_hash=NULL, activated_at=NULL, revoked_at=NULL WHERE id=r.id RETURNING * INTO r;
  out := out || jsonb_build_object('id',r.id,'name',r.name,'org_id',r.org_id,'code',code,'expires_at',r.activation_expires_at);
 END LOOP;
 RETURN out;
END $$;

REVOKE ALL ON FUNCTION public.list_activatable_clocks() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.bulk_issue_clock_codes(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_activatable_clocks() TO authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_issue_clock_codes(uuid[]) TO authenticated;