CREATE OR REPLACE FUNCTION public.round_up_shift_hours()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.approved_hours IS NOT NULL AND NEW.approved_hours >= 7.51 AND NEW.approved_hours < 8 THEN
    NEW.approved_hours := 8;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_round_up_shift_hours ON public.workforce_shifts;
CREATE TRIGGER trg_round_up_shift_hours BEFORE INSERT OR UPDATE OF approved_hours ON public.workforce_shifts
FOR EACH ROW EXECUTE FUNCTION public.round_up_shift_hours();