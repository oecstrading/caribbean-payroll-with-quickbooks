
-- Fix overly permissive INSERT on payroll_runs: only authenticated users can insert
DROP POLICY "Authenticated users can insert payroll runs" ON public.payroll_runs;
CREATE POLICY "Authenticated users can insert payroll runs" ON public.payroll_runs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Fix overly permissive INSERT on payslips: only allow inserting for authenticated users
DROP POLICY "Authenticated users can insert payslips" ON public.payslips;
CREATE POLICY "Authenticated users can insert payslips" ON public.payslips
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
