DO $$
DECLARE fn text; def text;
BEGIN
  FOREACH fn IN ARRAY ARRAY['clock_monitoring()', 'review_clock_incident(uuid,text)'] LOOP
    def := pg_get_functiondef(('public.' || fn)::regprocedure);
    def := replace(def, 'NOT (public.is_admin_or_manager(auth.uid()) AND public.has_workspace_access(auth.uid(),''attendance''))', 'NOT public.can_admin_clocks(o)');
    def := replace(def, 'Attendance management required', 'Administrator or Pay Master required');
    IF position('can_admin_clocks(o)' IN def) = 0 THEN RAISE EXCEPTION 'Access rule not updated for %', fn; END IF;
    EXECUTE def;
  END LOOP;
END $$;