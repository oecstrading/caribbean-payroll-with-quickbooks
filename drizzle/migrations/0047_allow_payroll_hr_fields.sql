DO $m$
DECLARE def text;
BEGIN
  def := pg_get_functiondef('public.validate_employee_folder()'::regprocedure);
  def := replace(def, '''weekly_hours'',''notes'')', '''weekly_hours'',''notes'',''tax_code'',''paye_method'',''paye_fixed_amount'',''nic_basis'',''daily_rate_rule'',''fixed_daily_rate'',''staff_group'',''cost_centre_code'',''bank_name'',''bank_branch'',''bank_account_number'',''bank_account_type'')');
  IF position('bank_account_type' in def) = 0 THEN RAISE EXCEPTION 'allowed list not found'; END IF;
  EXECUTE def;
END $m$;