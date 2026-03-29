
-- Fix: Set the view to use INVOKER security (respects caller's RLS)
ALTER VIEW public.geofence_violations SET (security_invoker = on);
