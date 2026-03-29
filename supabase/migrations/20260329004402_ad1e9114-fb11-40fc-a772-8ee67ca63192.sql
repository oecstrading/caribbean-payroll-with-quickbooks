-- Create a trigger function to call the geofence-alert edge function on violation
CREATE OR REPLACE FUNCTION public.notify_geofence_violation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.within_geofence = false THEN
    PERFORM net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1) || '/functions/v1/geofence-alert',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1)
      ),
      body := jsonb_build_object(
        'record', jsonb_build_object(
          'id', NEW.id,
          'user_id', NEW.user_id,
          'punch_type', NEW.punch_type,
          'latitude', NEW.latitude,
          'longitude', NEW.longitude,
          'within_geofence', NEW.within_geofence,
          'address_label', NEW.address_label,
          'punched_at', NEW.punched_at
        )
      )
    );
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS on_geofence_violation ON public.clock_punches;
CREATE TRIGGER on_geofence_violation
  AFTER INSERT ON public.clock_punches
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_geofence_violation();