CREATE TABLE public.emergency_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  site_id uuid REFERENCES public.client_sites(id),
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  location geography(Point, 4326),
  status text NOT NULL DEFAULT 'active',
  resolved_by uuid,
  resolved_at timestamptz,
  resolution_notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.emergency_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own alerts"
ON public.emergency_alerts FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own alerts"
ON public.emergency_alerts FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all alerts"
ON public.emergency_alerts FOR SELECT
TO authenticated
USING (is_admin_or_manager(auth.uid()));

CREATE POLICY "Admins can update alerts"
ON public.emergency_alerts FOR UPDATE
TO authenticated
USING (is_admin_or_manager(auth.uid()));

-- Sync geography column from lat/lon
CREATE OR REPLACE FUNCTION public.sync_emergency_location()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER sync_emergency_alert_location
  BEFORE INSERT OR UPDATE ON public.emergency_alerts
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_emergency_location();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.emergency_alerts;

-- Trigger to call panic-alert edge function
CREATE OR REPLACE FUNCTION public.notify_panic_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1) || '/functions/v1/panic-alert',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1)
    ),
    body := jsonb_build_object(
      'record', jsonb_build_object(
        'id', NEW.id,
        'user_id', NEW.user_id,
        'site_id', NEW.site_id,
        'latitude', NEW.latitude,
        'longitude', NEW.longitude,
        'status', NEW.status,
        'created_at', NEW.created_at
      )
    )
  );
  RETURN NEW;
END;
$function$;

CREATE TRIGGER on_panic_alert
  AFTER INSERT ON public.emergency_alerts
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_panic_alert();