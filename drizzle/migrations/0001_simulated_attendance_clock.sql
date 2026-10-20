CREATE TABLE public.attendance_simulation_clock (
 id boolean PRIMARY KEY DEFAULT true CHECK (id),
 run_id uuid NOT NULL DEFAULT gen_random_uuid(),
 simulated_start timestamptz NOT NULL DEFAULT now(),
 real_start timestamptz NOT NULL DEFAULT now(),
 enabled boolean NOT NULL DEFAULT false,
 changed_by uuid
);
GRANT SELECT ON public.attendance_simulation_clock TO authenticated;
GRANT ALL ON public.attendance_simulation_clock TO service_role;
ALTER TABLE public.attendance_simulation_clock ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed in users read simulation clock" ON public.attendance_simulation_clock FOR SELECT TO authenticated USING (true);
CREATE TABLE public.simulated_attendance_punches (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL,
 run_id uuid NOT NULL,
 punch_type text NOT NULL CHECK (punch_type IN ('clock_in','clock_out')),
 simulated_at timestamptz NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.simulated_attendance_punches TO authenticated;
GRANT ALL ON public.simulated_attendance_punches TO service_role;
ALTER TABLE public.simulated_attendance_punches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own simulation punches or HR" ON public.simulated_attendance_punches FOR SELECT TO authenticated USING (user_id=auth.uid() OR public.is_admin_or_manager(auth.uid()));
CREATE INDEX simulated_punches_user_run ON public.simulated_attendance_punches(user_id, run_id, recorded_at);
CREATE FUNCTION public.reset_attendance_simulation(_start timestamptz, _enabled boolean) RETURNS public.attendance_simulation_clock LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result public.attendance_simulation_clock;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_admin_or_manager(auth.uid()) THEN RAISE EXCEPTION 'Only administrators and managers can reset the simulation' USING ERRCODE='42501'; END IF;
 IF _enabled IS NULL OR _start IS NULL OR NOT isfinite(_start) OR _start < '2000-01-01'::timestamptz OR _start >= '2101-01-01'::timestamptz THEN RAISE EXCEPTION 'Choose a date between 2000 and 2100'; END IF;
 INSERT INTO public.attendance_simulation_clock(id, simulated_start, real_start, enabled, changed_by) VALUES (true,_start,clock_timestamp(),_enabled,auth.uid())
 ON CONFLICT(id) DO UPDATE SET simulated_start=EXCLUDED.simulated_start, real_start=EXCLUDED.real_start, enabled=EXCLUDED.enabled, changed_by=EXCLUDED.changed_by, run_id=gen_random_uuid() RETURNING * INTO result;
 RETURN result;
END; $$;
CREATE FUNCTION public.record_simulated_punch(_type text) RETURNS public.simulated_attendance_punches LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE settings public.attendance_simulation_clock; previous_type text; result public.simulated_attendance_punches;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to use simulated attendance' USING ERRCODE='42501'; END IF;
 IF _type IS NULL OR _type NOT IN ('clock_in','clock_out') THEN RAISE EXCEPTION 'Invalid punch type'; END IF;
 SELECT * INTO settings FROM public.attendance_simulation_clock WHERE id=true FOR UPDATE;
 IF NOT FOUND OR NOT settings.enabled THEN RAISE EXCEPTION 'Simulation is not active'; END IF;
 SELECT punch_type INTO previous_type FROM public.simulated_attendance_punches WHERE user_id=auth.uid() AND run_id=settings.run_id ORDER BY recorded_at DESC LIMIT 1;
 IF (_type='clock_in' AND previous_type='clock_in') OR (_type='clock_out' AND previous_type IS DISTINCT FROM 'clock_in') THEN RAISE EXCEPTION 'Clock in and clock out must alternate'; END IF;
 INSERT INTO public.simulated_attendance_punches(user_id,run_id,punch_type,simulated_at) VALUES(auth.uid(),settings.run_id,_type,settings.simulated_start + (clock_timestamp()-settings.real_start)) RETURNING * INTO result;
 RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.reset_attendance_simulation(timestamptz,boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_simulated_punch(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reset_attendance_simulation(timestamptz,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_simulated_punch(text) TO authenticated;
COMMENT ON TABLE public.simulated_attendance_punches IS 'Training only. Never consumed by payroll, billing, geofencing or live attendance.';