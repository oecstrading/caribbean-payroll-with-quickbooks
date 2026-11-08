CREATE OR REPLACE FUNCTION public.clear_punch_selfie(_punch_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _punch public.workforce_punches%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  SELECT * INTO _punch FROM public.workforce_punches WHERE id = _punch_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Punch not found'; END IF;
  IF _punch.org_id IS DISTINCT FROM public.current_org_id() THEN RAISE EXCEPTION 'This punch belongs to another company'; END IF;
  IF NOT (public.is_admin_or_manager(auth.uid()) AND public.has_workspace_access(auth.uid(), 'attendance')) THEN
    RAISE EXCEPTION 'Administrator, Pay Master or manager authority with attendance access is required';
  END IF;
  IF _punch.photo_path IS NULL THEN RETURN NULL; END IF;
  UPDATE public.workforce_punches SET photo_path = NULL WHERE id = _punch_id;
  INSERT INTO public.audit_logs (org_id, user_id, action, entity, entity_id, details)
  VALUES (_punch.org_id, auth.uid(), 'delete_punch_selfie', 'workforce_punches', _punch_id,
          jsonb_build_object('employee_id', _punch.employee_id, 'punched_at', _punch.punched_at));
  RETURN _punch.photo_path;
END; $$;
REVOKE ALL ON FUNCTION public.clear_punch_selfie(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clear_punch_selfie(uuid) TO authenticated;

CREATE POLICY "Attendance managers delete clock selfies" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'clock-selfies'
  AND (storage.foldername(name))[1] = (public.current_org_id())::text
  AND public.is_admin_or_manager(auth.uid())
  AND public.has_workspace_access(auth.uid(), 'attendance'));

COMMENT ON FUNCTION public.delete_punch_selfie(uuid) IS 'DEPRECATED: replaced by clear_punch_selfie plus Storage API removal';