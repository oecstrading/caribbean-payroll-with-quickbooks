
-- Geofence violations view using PostGIS ST_Distance
CREATE OR REPLACE VIEW public.geofence_violations AS
SELECT
  cp.id AS punch_id,
  cp.punched_at::DATE AS shift_date,
  cp.punched_at,
  cp.user_id,
  cp.punch_type,
  cp.address_label AS site_name,
  cp.latitude AS guard_lat,
  cp.longitude AS guard_lon,
  cp.within_geofence,
  CASE
    WHEN cp.clock_in_location IS NOT NULL AND cs.location IS NOT NULL
    THEN ST_Distance(cp.clock_in_location, cs.location)
    ELSE NULL
  END AS actual_distance_meters,
  cs.radius_meters AS allowed_radius,
  cs.name AS client_site_name,
  cs.jurisdiction_id,
  p.first_name || ' ' || p.last_name AS guard_name,
  p.jurisdiction AS guard_jurisdiction
FROM public.clock_punches cp
LEFT JOIN public.guard_assignments ga ON ga.user_id = cp.user_id AND ga.is_active = true
LEFT JOIN public.client_sites cs ON cs.id = ga.site_id
LEFT JOIN public.profiles p ON p.user_id = cp.user_id
WHERE cp.within_geofence = false;
