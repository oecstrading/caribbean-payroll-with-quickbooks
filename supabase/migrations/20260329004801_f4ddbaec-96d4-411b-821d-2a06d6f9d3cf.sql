CREATE TABLE public.notification_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  enable_push boolean NOT NULL DEFAULT true,
  enable_email boolean NOT NULL DEFAULT false,
  alert_on_geofence_violation boolean NOT NULL DEFAULT true,
  alert_on_late_clock_in boolean NOT NULL DEFAULT true,
  alert_on_panic_button boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notification settings"
ON public.notification_settings FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notification settings"
ON public.notification_settings FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notification settings"
ON public.notification_settings FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all notification settings"
ON public.notification_settings FOR SELECT
TO authenticated
USING (is_admin_or_manager(auth.uid()));

CREATE OR REPLACE FUNCTION public.handle_new_user_notification_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.notification_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER on_auth_user_created_notification_settings
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_notification_settings();