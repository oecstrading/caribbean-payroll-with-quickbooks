DO $$
DECLARE def text; old_expression text;
BEGIN
 def:=pg_get_functiondef('public.company_dashboard_summaries(boolean)'::regprocedure);
 old_expression:='(SELECT count(*) FROM public.workforce_alerts a WHERE a.org_id=o.id AND a.resolved_at IS NULL AND EXISTS (SELECT 1 FROM public.workforce_shifts ash WHERE ash.id=a.shift_id AND ash.org_id=a.org_id AND ash.approved_hours IS NULL AND ash.reviewed_at IS NULL AND ash.review_status<>''reviewed''))';
 IF position(old_expression IN def)=0 THEN RAISE EXCEPTION 'Dashboard counting expression not found'; END IF;
 def:=replace(def,old_expression,'(SELECT count(*) FROM public.workforce_shifts ash WHERE ash.org_id=o.id AND ash.approved_hours IS NULL AND ash.reviewed_at IS NULL AND ash.review_status=''pending'' AND ash.scheduled_end<now())');
 EXECUTE def;
END $$;