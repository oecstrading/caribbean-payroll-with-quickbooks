ALTER TABLE public.organizations ADD COLUMN onboarding_config jsonb;
CREATE OR REPLACE FUNCTION public.validate_onboarding_pack(_pack jsonb) RETURNS void LANGUAGE plpgsql SET search_path=public AS $$ DECLARE d jsonb; BEGIN
 IF _pack IS NULL THEN RETURN; END IF;
 IF jsonb_typeof(_pack) IS DISTINCT FROM 'object' OR _pack->>'version' IS DISTINCT FROM '1' OR coalesce(_pack->>'industry','') NOT IN ('general','construction','security','services') OR coalesce(_pack->>'jurisdiction','') NOT IN ('LC','AG','KN','DM','GD') OR coalesce(_pack->>'pay_frequency','') NOT IN ('weekly','semi_monthly','monthly') OR _pack->'reviewed' IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'Review a valid industry onboarding pack'; END IF;
 IF jsonb_typeof(_pack->'weekly_hours') IS DISTINCT FROM 'number' OR (_pack->>'weekly_hours')::numeric NOT BETWEEN 1 AND 80 OR jsonb_typeof(_pack->'departments') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid onboarding hours or departments'; END IF;
 IF jsonb_array_length(_pack->'departments') NOT BETWEEN 1 AND 20 OR jsonb_typeof(_pack->'ai_notes') IS DISTINCT FROM 'string' OR length(_pack->>'ai_notes')>12000 OR EXISTS(SELECT 1 FROM jsonb_object_keys(_pack) k WHERE k NOT IN ('version','industry','jurisdiction','weekly_hours','pay_frequency','departments','reviewed','ai_notes')) THEN RAISE EXCEPTION 'Invalid onboarding template fields'; END IF;
 FOR d IN SELECT value FROM jsonb_array_elements(_pack->'departments') LOOP IF jsonb_typeof(d)<>'string' OR length(trim(d#>>'{}')) NOT BETWEEN 1 AND 80 THEN RAISE EXCEPTION 'Invalid department template'; END IF; END LOOP;
END $$;
CREATE OR REPLACE FUNCTION public.initialize_industry_clock() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NEW.onboarding_config IS NOT NULL THEN PERFORM public.validate_onboarding_pack(NEW.onboarding_config); END IF;
 IF NEW.onboarding_status='active' AND NEW.onboarding_config IS NOT NULL AND (TG_OP='INSERT' OR OLD.onboarding_status='pending') THEN
 INSERT INTO public.workforce_clock_settings(org_id,timezone,overtime_basis,overtime_threshold,overtime_multiplier,attendance_payroll) VALUES(NEW.id,CASE NEW.onboarding_config->>'jurisdiction' WHEN 'AG' THEN 'America/Antigua' WHEN 'KN' THEN 'America/St_Kitts' WHEN 'DM' THEN 'America/Dominica' WHEN 'GD' THEN 'America/Grenada' ELSE 'America/St_Lucia' END,'weekly',(NEW.onboarding_config->>'weekly_hours')::numeric,1.5,false) ON CONFLICT(org_id) DO NOTHING;
 END IF; RETURN NEW;
END $$;
CREATE TRIGGER initialize_industry_clock AFTER INSERT OR UPDATE OF onboarding_config,onboarding_status ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.initialize_industry_clock();
DO $$ DECLARE def text; BEGIN
 SELECT pg_get_functiondef('public.validate_company_setup(jsonb)'::regprocedure) INTO def;
 IF position('WHERE key<>''modules''' in def)=0 THEN RAISE EXCEPTION 'Company validator changed'; END IF;
 def:=replace(def,'WHERE key<>''modules''','WHERE key NOT IN (''modules'',''onboarding'')');
 def:=replace(def,'FOR k IN SELECT key','PERFORM public.validate_onboarding_pack(_details->''onboarding''); FOR k IN SELECT key'); EXECUTE def;
 SELECT pg_get_functiondef('public.issue_company_setup(jsonb,boolean)'::regprocedure) INTO def;
 IF position('SET enabled_modules=ARRAY' in def)=0 THEN RAISE EXCEPTION 'Company issue function changed'; END IF;
 def:=replace(def,'SET enabled_modules=ARRAY','SET onboarding_config=_details->''onboarding'',enabled_modules=ARRAY'); EXECUTE def;
 SELECT pg_get_functiondef('public.complete_company_setup(uuid,text,jsonb)'::regprocedure) INTO def;
 IF position('SET enabled_modules=ARRAY' in def)=0 THEN RAISE EXCEPTION 'Company completion changed'; END IF;
 def:=replace(def,'SET enabled_modules=ARRAY','SET onboarding_config=_details->''onboarding'',enabled_modules=ARRAY');
 def:=replace(def,'SET org_id=company,accepted_at=now()','SET defaults=_details,org_id=company,accepted_at=now()'); EXECUTE def;
 SELECT pg_get_functiondef('public.update_platform_company(uuid,uuid,jsonb)'::regprocedure) INTO def;
 IF position('SET name=trim(_details->>''company_name''),enabled_modules=' in def)=0 THEN RAISE EXCEPTION 'Company edit function changed'; END IF;
 def:=replace(def,'SET name=trim(_details->>''company_name''),enabled_modules=','SET name=trim(_details->>''company_name''),onboarding_config=CASE WHEN _details ? ''onboarding'' THEN _details->''onboarding'' ELSE onboarding_config END,enabled_modules='); EXECUTE def;
 SELECT pg_get_functiondef('public.platform_companies()'::regprocedure) INTO def;
 IF position('jsonb_build_object(''modules'',o.enabled_modules)' in def)=0 THEN RAISE EXCEPTION 'Company list function changed'; END IF;
 def:=replace(def,'jsonb_build_object(''modules'',o.enabled_modules)','jsonb_build_object(''modules'',o.enabled_modules)||CASE WHEN o.onboarding_config IS NULL THEN ''{}''::jsonb ELSE jsonb_build_object(''onboarding'',o.onboarding_config) END'); EXECUTE def;
END $$;