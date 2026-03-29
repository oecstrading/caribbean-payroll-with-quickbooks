
-- PostGIS-powered server-side geofence verification function
CREATE OR REPLACE FUNCTION public.verify_guard_location(
  _site_id UUID,
  _lat DOUBLE PRECISION,
  _lon DOUBLE PRECISION
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  _site RECORD;
  _guard_point GEOGRAPHY;
  _distance DOUBLE PRECISION;
  _within BOOLEAN;
BEGIN
  SELECT id, name, location, radius_meters
  INTO _site
  FROM public.client_sites
  WHERE id = _site_id;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Site not found');
  END IF;

  IF _site.location IS NULL THEN
    RETURN json_build_object('error', 'Site has no coordinates');
  END IF;

  _guard_point := ST_SetSRID(ST_MakePoint(_lon, _lat), 4326)::geography;
  _distance := ST_Distance(_site.location, _guard_point);
  _within := _distance <= _site.radius_meters;

  RETURN json_build_object(
    'within_geofence', _within,
    'distance_meters', _distance,
    'radius_meters', _site.radius_meters,
    'site_name', _site.name
  );
END;
$$;
