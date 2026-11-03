ALTER TABLE public.workforce_clock_settings
 ADD COLUMN default_work_days integer[] NOT NULL DEFAULT '{1,2,3,4,5}',
 ADD COLUMN default_shift_start time NOT NULL DEFAULT '08:00',
 ADD COLUMN default_shift_end time NOT NULL DEFAULT '16:00',
 ADD COLUMN default_break_minutes integer NOT NULL DEFAULT 0 CHECK (default_break_minutes BETWEEN 0 AND 240);

CREATE OR REPLACE FUNCTION public.validate_onboarding_pack(_pack jsonb) RETURNS void LANGUAGE plpgsql SET search_path=public AS $$ DECLARE d jsonb; BEGIN
 IF _pack IS NULL THEN RETURN; END IF;
 IF jsonb_typeof(_pack) IS DISTINCT FROM 'object' OR _pack->>'version' IS DISTINCT FROM '1' OR coalesce(_pack->>'industry','') NOT IN ('general','construction','security','services') OR coalesce(_pack->>'jurisdiction','') NOT IN ('LC','AG','KN','DM','GD') OR coalesce(_pack->>'pay_frequency','') NOT IN ('weekly','semi_monthly','monthly') OR _pack->'reviewed' IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'Review a valid industry onboarding pack'; END IF;
 IF jsonb_typeof(_pack->'weekly_hours') IS DISTINCT FROM 'number' OR (_pack->>'weekly_hours')::numeric NOT BETWEEN 1 AND 80 OR jsonb_typeof(_pack->'departments') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid onboarding hours or departments'; END IF;
 IF jsonb_array_length(_pack->'departments') NOT BETWEEN 1 AND 20 OR jsonb_typeof(_pack->'ai_notes') IS DISTINCT FROM 'string' OR length(_pack->>'ai_notes')>12000 OR EXISTS(SELECT 1 FROM jsonb_object_keys(_pack) k WHERE k NOT IN ('version','industry','jurisdiction','weekly_hours','pay_frequency','departments','reviewed','ai_notes','work_days','shift_start','shift_end','break_minutes')) THEN RAISE EXCEPTION 'Invalid onboarding template fields'; END IF;
 FOR d IN SELECT value FROM jsonb_array_elements(_pack->'departments') LOOP IF jsonb_typeof(d)<>'string' OR length(trim(d#>>'{}')) NOT BETWEEN 1 AND 80 THEN RAISE EXCEPTION 'Invalid department template'; END IF; END LOOP;
 IF _pack ? 'work_days' THEN
  IF jsonb_typeof(_pack->'work_days')<>'array' OR jsonb_array_length(_pack->'work_days') NOT BETWEEN 1 AND 7 OR EXISTS(SELECT 1 FROM jsonb_array_elements(_pack->'work_days') v WHERE jsonb_typeof(v)<>'number' OR (v#>>'{}') NOT IN ('0','1','2','3','4','5','6')) THEN RAISE EXCEPTION 'Choose at least one working day'; END IF;
 END IF;
 IF (_pack ? 'shift_start') OR (_pack ? 'shift_end') THEN
  IF coalesce(_pack->>'shift_start','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' OR coalesce(_pack->>'shift_end','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' OR _pack->>'shift_start'=_pack->>'shift_end' THEN RAISE EXCEPTION 'Enter valid start and end hours'; END IF;
 END IF;
 IF _pack ? 'break_minutes' AND (jsonb_typeof(_pack->'break_minutes')<>'number' OR (_pack->>'break_minutes')::numeric NOT BETWEEN 0 AND 240 OR (_pack->>'break_minutes')::numeric<>round((_pack->>'break_minutes')::numeric)) THEN RAISE EXCEPTION 'Unpaid break must be 0 to 240 minutes'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.initialize_industry_clock() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE c jsonb := NEW.onboarding_config; BEGIN
 IF c IS NOT NULL THEN PERFORM public.validate_onboarding_pack(c); END IF;
 IF NEW.onboarding_status='active' AND c IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.company_settings WHERE org_id=NEW.id) THEN
 INSERT INTO public.workforce_clock_settings(org_id,timezone,overtime_basis,overtime_threshold,overtime_multiplier,attendance_payroll) VALUES(NEW.id,CASE c->>'jurisdiction' WHEN 'AG' THEN 'America/Antigua' WHEN 'KN' THEN 'America/St_Kitts' WHEN 'DM' THEN 'America/Dominica' WHEN 'GD' THEN 'America/Grenada' ELSE 'America/St_Lucia' END,'weekly',(c->>'weekly_hours')::numeric,1.5,false) ON CONFLICT(org_id) DO NOTHING;
 END IF;
 IF NEW.onboarding_status='active' AND c IS NOT NULL AND (c ? 'work_days' OR c ? 'shift_start' OR c ? 'break_minutes') THEN
  INSERT INTO public.workforce_clock_settings(org_id) VALUES(NEW.id) ON CONFLICT(org_id) DO NOTHING;
  UPDATE public.workforce_clock_settings SET
   default_work_days=CASE WHEN c ? 'work_days' THEN ARRAY(SELECT (v#>>'{}')::int FROM jsonb_array_elements(c->'work_days') v ORDER BY 1) ELSE default_work_days END,
   default_shift_start=CASE WHEN c ? 'shift_start' THEN (c->>'shift_start')::time ELSE default_shift_start END,
   default_shift_end=CASE WHEN c ? 'shift_end' THEN (c->>'shift_end')::time ELSE default_shift_end END,
   default_break_minutes=CASE WHEN c ? 'break_minutes' THEN (c->>'break_minutes')::int ELSE default_break_minutes END
  WHERE org_id=NEW.id;
 END IF; RETURN NEW;
END $$;