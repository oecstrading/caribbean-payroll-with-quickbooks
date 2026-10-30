CREATE OR REPLACE FUNCTION public.initialize_industry_clock() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NEW.onboarding_config IS NOT NULL THEN PERFORM public.validate_onboarding_pack(NEW.onboarding_config); END IF;
 IF NEW.onboarding_status='active' AND NEW.onboarding_config IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.company_settings WHERE org_id=NEW.id) THEN
 INSERT INTO public.workforce_clock_settings(org_id,timezone,overtime_basis,overtime_threshold,overtime_multiplier,attendance_payroll) VALUES(NEW.id,CASE NEW.onboarding_config->>'jurisdiction' WHEN 'AG' THEN 'America/Antigua' WHEN 'KN' THEN 'America/St_Kitts' WHEN 'DM' THEN 'America/Dominica' WHEN 'GD' THEN 'America/Grenada' ELSE 'America/St_Lucia' END,'weekly',(NEW.onboarding_config->>'weekly_hours')::numeric,1.5,false) ON CONFLICT(org_id) DO NOTHING;
 END IF; RETURN NEW;
END $$;