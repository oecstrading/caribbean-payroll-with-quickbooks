DO $$
DECLARE def text;
BEGIN
  def := pg_get_functiondef('public.clock_monitoring()'::regprocedure);
  def := replace(def, 'WHERE d.org_id=o', 'WHERE d.org_id=o AND d.deleted_at IS NULL');
  def := replace(def, 'FROM public.clock_incidents i WHERE i.org_id=o AND i.status <> ''resolved''', 'FROM public.clock_incidents i WHERE i.org_id=o AND i.status <> ''resolved'' AND ((i.clock_type=''shared'' AND EXISTS (SELECT 1 FROM public.clock_devices cd WHERE cd.id=i.clock_id AND cd.org_id=o AND cd.deleted_at IS NULL)) OR (i.clock_type=''personal'' AND EXISTS (SELECT 1 FROM public.workforce_clock_credentials cc WHERE cc.employee_id=i.clock_id AND cc.org_id=o)))');
  EXECUTE def;
END $$;