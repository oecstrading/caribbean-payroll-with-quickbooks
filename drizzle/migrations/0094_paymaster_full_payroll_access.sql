DROP POLICY IF EXISTS "Admin create account-free employees" ON public.employee_records;
CREATE POLICY "HR create account-free employees" ON public.employee_records FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_manager(auth.uid()));
DROP POLICY IF EXISTS "Admins manage paymaster settings" ON public.paymaster_settings;
DROP POLICY IF EXISTS "Admins update paymaster settings" ON public.paymaster_settings;
CREATE POLICY "Payroll managers insert paymaster settings" ON public.paymaster_settings FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org_id() AND public.is_admin_or_manager(auth.uid()) AND public.has_workspace_access(auth.uid(), 'payroll'));
CREATE POLICY "Payroll managers update paymaster settings" ON public.paymaster_settings FOR UPDATE TO authenticated
  USING (org_id = public.current_org_id() AND public.is_admin_or_manager(auth.uid()) AND public.has_workspace_access(auth.uid(), 'payroll'))
  WITH CHECK (org_id = public.current_org_id() AND public.is_admin_or_manager(auth.uid()) AND public.has_workspace_access(auth.uid(), 'payroll'));