CREATE TABLE public.pay_item_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL DEFAULT public.current_org_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('deduction','addition')),
  name text NOT NULL,
  creditor_id uuid REFERENCES public.creditors(id) ON DELETE SET NULL,
  addition_type text,
  amount numeric NOT NULL DEFAULT 0,
  frequency text NOT NULL DEFAULT 'monthly',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pay_item_templates TO authenticated;
GRANT ALL ON public.pay_item_templates TO service_role;
ALTER TABLE public.pay_item_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company payroll staff manage templates" ON public.pay_item_templates FOR ALL TO authenticated
USING (org_id = public.current_org_id() AND public.is_admin_or_manager(auth.uid()) AND public.has_workspace_access(auth.uid(),'payroll'))
WITH CHECK (org_id = public.current_org_id() AND public.is_admin_or_manager(auth.uid()) AND public.has_workspace_access(auth.uid(),'payroll'));