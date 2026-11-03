CREATE OR REPLACE FUNCTION public.validate_pay_lines(_row jsonb) RETURNS void LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE l jsonb; b numeric:=0; o numeric:=0; e numeric:=0; d numeric:=0; a numeric; n int;
BEGIN n:=jsonb_array_length(_row->'pay_lines'); IF n=0 OR n>60 THEN RAISE EXCEPTION 'Edited payroll needs 1 to 60 lines'; END IF;
FOR l IN SELECT value FROM jsonb_array_elements(_row->'pay_lines') LOOP
 IF jsonb_typeof(l->'amount')<>'number' OR coalesce(l->>'kind','') NOT IN ('basic','overtime','addition','deduction') OR length(coalesce(l->>'label',''))>80 THEN RAISE EXCEPTION 'Invalid edited pay line'; END IF;
 a:=(l->>'amount')::numeric; IF a<0 OR a>10000000 OR a<>round(a,2) THEN RAISE EXCEPTION 'Invalid edited pay amount'; END IF;
 IF l->>'kind'='basic' THEN b:=b+a; ELSIF l->>'kind'='overtime' THEN o:=o+a; ELSIF l->>'kind'='addition' THEN e:=e+a; ELSE d:=d+a; END IF;
END LOOP;
IF abs(b-(_row->>'basic_pay')::numeric)>0.01 OR abs(o-(_row->>'overtime_pay')::numeric)>0.01 OR abs(b+o+e-(_row->>'gross_pay')::numeric)>0.02 OR abs(d+(_row->>'employee_nic')::numeric+(_row->>'paye')::numeric-(_row->>'total_deductions')::numeric)>0.02 THEN RAISE EXCEPTION 'Edited pay lines do not match the totals; refresh payroll'; END IF;
END $$;
DO $$ DECLARE d text; a text := 'IF jsonb_typeof(row->''manual_hours'')=''object'' THEN'; s text := 'IF jsonb_typeof(row->''manual_hours'') IS DISTINCT FROM ''object'' AND'; BEGIN
SELECT pg_get_functiondef('public.approve_payroll_run'::regproc) INTO d;
IF position(a IN d)=0 OR position(s IN d)=0 THEN RAISE EXCEPTION 'approve_payroll_run layout changed'; END IF;
d:=replace(d,a,'IF jsonb_typeof(row->''pay_lines'')=''array'' THEN PERFORM public.validate_pay_lines(row); ELSIF jsonb_typeof(row->''manual_hours'')=''object'' THEN');
d:=replace(d,s,s||' jsonb_typeof(row->''pay_lines'') IS DISTINCT FROM ''array'' AND');
EXECUTE d; END $$;