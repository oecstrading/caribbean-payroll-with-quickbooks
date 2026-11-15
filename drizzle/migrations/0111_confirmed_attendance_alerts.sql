CREATE OR REPLACE FUNCTION public.clear_confirmed_attendance_alerts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.approved_hours IS NOT NULL OR NEW.reviewed_at IS NOT NULL OR NEW.review_status='reviewed' THEN
  UPDATE public.workforce_alerts SET resolved_at=coalesce(resolved_at,now()) WHERE shift_id=NEW.id AND org_id=NEW.org_id AND resolved_at IS NULL;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER clear_confirmed_attendance_alerts AFTER UPDATE OF approved_hours,reviewed_at,review_status ON public.workforce_shifts FOR EACH ROW EXECUTE FUNCTION public.clear_confirmed_attendance_alerts();
DO $$
DECLARE def text;
BEGIN
 def:=pg_get_functiondef('public.reconcile_workforce_attendance(uuid)'::regprocedure);
 def:=replace(def,'AND w.review_status=''pending'' AND','AND w.review_status=''pending'' AND w.approved_hours IS NULL AND w.reviewed_at IS NULL AND');
 EXECUTE def;
 def:=pg_get_functiondef('public.company_dashboard_summaries(boolean)'::regprocedure);
 def:=replace(def,'s.clock_out IS NULL AND EXISTS','s.clock_out IS NULL AND s.approved_hours IS NULL AND s.reviewed_at IS NULL AND s.review_status<>''reviewed'' AND EXISTS');
 def:=replace(def,'a.org_id=o.id AND a.resolved_at IS NULL','a.org_id=o.id AND a.resolved_at IS NULL AND EXISTS (SELECT 1 FROM public.workforce_shifts ash WHERE ash.id=a.shift_id AND ash.org_id=a.org_id AND ash.approved_hours IS NULL AND ash.reviewed_at IS NULL AND ash.review_status<>''reviewed'')');
 EXECUTE def;
END $$;