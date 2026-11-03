CREATE OR REPLACE FUNCTION public.administrator_authority(_user uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Company user required'; END IF;
  IF NOT (
    EXISTS(SELECT 1 FROM public.profiles WHERE user_id=_user AND org_id=public.current_org_id())
    OR (_user = auth.uid() AND public.can_view_company(public.current_org_id()))
  ) THEN RAISE EXCEPTION 'Company user required'; END IF;
  RETURN jsonb_build_object('company_super_admin',public.is_company_super_admin(_user),'platform_super_admin',EXISTS(SELECT 1 FROM public.platform_administrators WHERE user_id=_user));
END $$;