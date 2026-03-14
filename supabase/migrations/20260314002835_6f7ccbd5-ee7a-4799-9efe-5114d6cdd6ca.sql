
-- Role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'employee');

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'employee',
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (avoids recursive RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Helper: check if user is admin or manager
CREATE OR REPLACE FUNCTION public.is_admin_or_manager(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'manager')
  )
$$;

-- RLS on user_roles: admins can manage, users can read their own
CREATE POLICY "Users can view their own role" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert roles" ON public.user_roles
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update roles" ON public.user_roles
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles" ON public.user_roles
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Update profiles RLS: admins/managers can view & edit all profiles
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (public.is_admin_or_manager(auth.uid()));

CREATE POLICY "Admins can update all profiles" ON public.profiles
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- Update leave_requests: managers can view their team's requests
CREATE POLICY "Managers can view all leave requests" ON public.leave_requests
  FOR SELECT USING (public.is_admin_or_manager(auth.uid()));

CREATE POLICY "Managers can update leave requests" ON public.leave_requests
  FOR UPDATE USING (public.is_admin_or_manager(auth.uid()));

-- Update leave_balances: admins can manage
CREATE POLICY "Admins can view all leave balances" ON public.leave_balances
  FOR SELECT USING (public.is_admin_or_manager(auth.uid()));

CREATE POLICY "Admins can update all leave balances" ON public.leave_balances
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert leave balances" ON public.leave_balances
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Geofence settings (company-wide locations)
CREATE TABLE public.geofence_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  radius_meters INTEGER NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.geofence_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view geofence zones" ON public.geofence_zones
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage geofence zones" ON public.geofence_zones
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update geofence zones" ON public.geofence_zones
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete geofence zones" ON public.geofence_zones
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_geofence_zones_updated_at BEFORE UPDATE ON public.geofence_zones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Clock punches with GPS
CREATE TABLE public.clock_punches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  punch_type TEXT NOT NULL CHECK (punch_type IN ('in', 'out')),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  geofence_zone_id UUID REFERENCES public.geofence_zones(id),
  within_geofence BOOLEAN DEFAULT false,
  address_label TEXT DEFAULT '',
  punched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.clock_punches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own punches" ON public.clock_punches
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own punches" ON public.clock_punches
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all punches" ON public.clock_punches
  FOR SELECT USING (public.is_admin_or_manager(auth.uid()));

-- Assign default role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'employee');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();
