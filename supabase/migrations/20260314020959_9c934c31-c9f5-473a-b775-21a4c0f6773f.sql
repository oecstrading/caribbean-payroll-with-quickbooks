
-- Create addition_type enum
CREATE TYPE public.addition_type AS ENUM ('bonus', 'overtime', 'double_time', 'vacation_pay', 'commission', 'allowance', 'other');

-- Create employee_additions table
CREATE TABLE public.employee_additions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  addition_type addition_type NOT NULL DEFAULT 'bonus',
  description TEXT DEFAULT '',
  amount NUMERIC NOT NULL DEFAULT 0,
  frequency TEXT NOT NULL DEFAULT 'one-time',
  is_active BOOLEAN NOT NULL DEFAULT true,
  period TEXT DEFAULT NULL,
  notes TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.employee_additions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage additions"
  ON public.employee_additions FOR ALL
  TO authenticated
  USING (is_admin_or_manager(auth.uid()))
  WITH CHECK (is_admin_or_manager(auth.uid()));

CREATE POLICY "Admins can view all additions"
  ON public.employee_additions FOR SELECT
  TO authenticated
  USING (is_admin_or_manager(auth.uid()));

CREATE POLICY "Users can view their own additions"
  ON public.employee_additions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Updated_at trigger
CREATE TRIGGER update_employee_additions_updated_at
  BEFORE UPDATE ON public.employee_additions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
