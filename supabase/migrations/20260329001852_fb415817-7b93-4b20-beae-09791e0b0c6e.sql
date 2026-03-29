
-- 1. Enable PostGIS for geo-spatial queries
CREATE EXTENSION IF NOT EXISTS postgis SCHEMA extensions;

-- 2. Create jurisdictions reference table for multi-island operations
CREATE TABLE public.jurisdictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  currency_code TEXT NOT NULL DEFAULT 'XCD',
  nic_employee_rate NUMERIC(5,4) NOT NULL DEFAULT 0.05,
  nic_employer_rate NUMERIC(5,4) NOT NULL DEFAULT 0.05,
  nic_ceiling NUMERIC(12,2) DEFAULT NULL,
  overtime_multiplier NUMERIC(3,2) NOT NULL DEFAULT 1.5,
  holiday_multiplier NUMERIC(3,2) NOT NULL DEFAULT 2.0,
  holiday_ot_multiplier NUMERIC(3,2) NOT NULL DEFAULT 2.5,
  night_differential NUMERIC(3,2) NOT NULL DEFAULT 1.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Seed OECS jurisdictions
INSERT INTO public.jurisdictions (code, name, nic_employee_rate, nic_employer_rate, nic_ceiling, overtime_multiplier, holiday_multiplier, holiday_ot_multiplier) VALUES
  ('LC', 'Saint Lucia',     0.05,   0.05,   5000, 1.5, 2.0, 2.5),
  ('AG', 'Antigua & Barbuda', 0.06, 0.075,  6500, 1.5, 2.0, 2.5),
  ('KN', 'St. Kitts & Nevis', 0.05, 0.05,   5000, 1.5, 2.0, 2.5),
  ('DM', 'Dominica',         0.065, 0.0725, 5000, 1.5, 2.0, 2.5),
  ('GD', 'Grenada',          0.05,  0.05,   5000, 1.5, 2.0, 2.5),
  ('VC', 'St. Vincent & the Grenadines', 0.045, 0.055, 5000, 1.5, 2.0, 2.5);

-- 4. Add geography point column to client_sites
ALTER TABLE public.client_sites
  ADD COLUMN IF NOT EXISTS location GEOGRAPHY(POINT),
  ADD COLUMN IF NOT EXISTS jurisdiction_id UUID REFERENCES public.jurisdictions(id);

-- 5. Backfill location from existing lat/lon
UPDATE public.client_sites
SET location = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND location IS NULL;

-- 6. Add geography point for clock-in location
ALTER TABLE public.clock_punches
  ADD COLUMN IF NOT EXISTS clock_in_location GEOGRAPHY(POINT);

-- 7. Backfill clock_in_location from existing lat/lon
UPDATE public.clock_punches
SET clock_in_location = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND clock_in_location IS NULL;

-- 8. Spatial index for fast geofence lookups
CREATE INDEX IF NOT EXISTS idx_client_sites_location ON public.client_sites USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_clock_punches_location ON public.clock_punches USING GIST (clock_in_location);

-- 9. RLS for jurisdictions (read-only for all authenticated, manage for admins)
ALTER TABLE public.jurisdictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view jurisdictions"
  ON public.jurisdictions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage jurisdictions"
  ON public.jurisdictions FOR ALL
  TO authenticated
  USING (is_admin_or_manager(auth.uid()))
  WITH CHECK (is_admin_or_manager(auth.uid()));

-- 10. Add trigger to auto-set location when lat/lon are inserted/updated on client_sites
CREATE OR REPLACE FUNCTION public.sync_site_location()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_site_location
  BEFORE INSERT OR UPDATE OF latitude, longitude ON public.client_sites
  FOR EACH ROW EXECUTE FUNCTION public.sync_site_location();

-- 11. Auto-set clock_in_location on clock_punches
CREATE OR REPLACE FUNCTION public.sync_punch_location()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.clock_in_location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_punch_location
  BEFORE INSERT OR UPDATE OF latitude, longitude ON public.clock_punches
  FOR EACH ROW EXECUTE FUNCTION public.sync_punch_location();
