-- First, check and create app_role enum if not exists
DO $$ BEGIN
    CREATE TYPE public.app_role AS ENUM ('super_admin', 'franchise', 'admin_keuangan', 'admin_marketing', 'user');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create franchises table if not exists
CREATE TABLE IF NOT EXISTS public.franchises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  franchise_id TEXT UNIQUE,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create user_roles table if not exists
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role public.app_role NOT NULL,
  franchise_id UUID REFERENCES public.franchises(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, role, franchise_id)
);

-- Create workers table if not exists
CREATE TABLE IF NOT EXISTS public.workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama TEXT NOT NULL,
  rekening TEXT,
  wa TEXT,
  role TEXT,
  status TEXT DEFAULT 'active',
  franchise_id UUID NOT NULL REFERENCES public.franchises(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create admin_income table if not exists
CREATE TABLE IF NOT EXISTS public.admin_income (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT,
  nominal NUMERIC(15,2) NOT NULL,
  tanggal TIMESTAMPTZ DEFAULT now(),
  franchise_id UUID NOT NULL REFERENCES public.franchises(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create worker_income table if not exists
CREATE TABLE IF NOT EXISTS public.worker_income (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT,
  jobdesk TEXT,
  fee NUMERIC(15,2) NOT NULL,
  worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  tanggal TIMESTAMPTZ DEFAULT now(),
  franchise_id UUID NOT NULL REFERENCES public.franchises(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create expenses table if not exists
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nominal NUMERIC(15,2) NOT NULL,
  keterangan TEXT,
  tanggal TIMESTAMPTZ DEFAULT now(),
  franchise_id UUID NOT NULL REFERENCES public.franchises(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create salary_withdrawals table if not exists
CREATE TABLE IF NOT EXISTS public.salary_withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount NUMERIC(15,2) NOT NULL,
  worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  tanggal TIMESTAMPTZ DEFAULT now(),
  franchise_id UUID NOT NULL REFERENCES public.franchises(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security on all tables
ALTER TABLE public.franchises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_income ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_income ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_withdrawals ENABLE ROW LEVEL SECURITY;

-- Create security definer functions (drop first if exists)
DROP FUNCTION IF EXISTS public.get_user_role(UUID);
DROP FUNCTION IF EXISTS public.is_super_admin(UUID);
DROP FUNCTION IF EXISTS public.get_user_franchise_id(UUID);

CREATE OR REPLACE FUNCTION public.get_user_role(target_user_id UUID DEFAULT auth.uid())
RETURNS TABLE(role app_role, franchise_id UUID) AS $$
BEGIN
  RETURN QUERY
  SELECT ur.role, ur.franchise_id
  FROM public.user_roles ur
  WHERE ur.user_id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_super_admin(target_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = target_user_id AND role = 'super_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_user_franchise_id(target_user_id UUID DEFAULT auth.uid())
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT ur.franchise_id
    FROM public.user_roles ur
    WHERE ur.user_id = target_user_id
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- Drop existing policies if they exist and recreate them
DROP POLICY IF EXISTS "franchises_select_policy" ON public.franchises;
DROP POLICY IF EXISTS "franchises_insert_super_admin_only" ON public.franchises;
DROP POLICY IF EXISTS "franchises_update_super_admin_only" ON public.franchises;
DROP POLICY IF EXISTS "franchises_delete_super_admin_only" ON public.franchises;

CREATE POLICY "franchises_select_policy" ON public.franchises
FOR SELECT USING (
  public.is_super_admin() OR 
  id = public.get_user_franchise_id()
);

CREATE POLICY "franchises_insert_super_admin_only" ON public.franchises
FOR INSERT WITH CHECK (public.is_super_admin());

CREATE POLICY "franchises_update_super_admin_only" ON public.franchises
FOR UPDATE USING (public.is_super_admin());

CREATE POLICY "franchises_delete_super_admin_only" ON public.franchises
FOR DELETE USING (public.is_super_admin());

-- Drop and recreate policies for other tables
DROP POLICY IF EXISTS "user_roles_select_policy" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_insert_super_admin_only" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_update_super_admin_only" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_delete_super_admin_only" ON public.user_roles;

CREATE POLICY "user_roles_select_policy" ON public.user_roles
FOR SELECT USING (
  public.is_super_admin() OR 
  user_id = auth.uid()
);

CREATE POLICY "user_roles_insert_super_admin_only" ON public.user_roles
FOR INSERT WITH CHECK (public.is_super_admin());

CREATE POLICY "user_roles_update_super_admin_only" ON public.user_roles
FOR UPDATE USING (public.is_super_admin());

CREATE POLICY "user_roles_delete_super_admin_only" ON public.user_roles
FOR DELETE USING (public.is_super_admin());

-- Policies for other tables (workers, admin_income, worker_income, expenses, salary_withdrawals)
-- Workers policies
DROP POLICY IF EXISTS "workers_select_policy" ON public.workers;
DROP POLICY IF EXISTS "workers_insert_policy" ON public.workers;
DROP POLICY IF EXISTS "workers_update_policy" ON public.workers;
DROP POLICY IF EXISTS "workers_delete_policy" ON public.workers;

CREATE POLICY "workers_select_policy" ON public.workers
FOR SELECT USING (
  public.is_super_admin() OR 
  franchise_id = public.get_user_franchise_id()
);

CREATE POLICY "workers_insert_policy" ON public.workers
FOR INSERT WITH CHECK (
  public.is_super_admin() OR 
  (franchise_id = public.get_user_franchise_id() AND 
   EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('franchise', 'admin_keuangan')))
);

CREATE POLICY "workers_update_policy" ON public.workers
FOR UPDATE USING (
  public.is_super_admin() OR 
  (franchise_id = public.get_user_franchise_id() AND 
   EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('franchise', 'admin_keuangan')))
);

CREATE POLICY "workers_delete_policy" ON public.workers
FOR DELETE USING (
  public.is_super_admin() OR 
  (franchise_id = public.get_user_franchise_id() AND 
   EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('franchise', 'admin_keuangan')))
);

-- Admin income policies
DROP POLICY IF EXISTS "admin_income_select_policy" ON public.admin_income;
DROP POLICY IF EXISTS "admin_income_insert_policy" ON public.admin_income;
DROP POLICY IF EXISTS "admin_income_update_policy" ON public.admin_income;
DROP POLICY IF EXISTS "admin_income_delete_policy" ON public.admin_income;

CREATE POLICY "admin_income_select_policy" ON public.admin_income
FOR SELECT USING (
  public.is_super_admin() OR 
  (franchise_id = public.get_user_franchise_id() AND 
   EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('franchise', 'admin_keuangan', 'admin_marketing')))
);

CREATE POLICY "admin_income_insert_policy" ON public.admin_income
FOR INSERT WITH CHECK (
  public.is_super_admin() OR 
  (franchise_id = public.get_user_franchise_id() AND 
   EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('franchise', 'admin_keuangan', 'admin_marketing')) AND
   created_by = auth.uid())
);

CREATE POLICY "admin_income_update_policy" ON public.admin_income
FOR UPDATE USING (
  public.is_super_admin() OR 
  (franchise_id = public.get_user_franchise_id() AND 
   EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('franchise', 'admin_keuangan', 'admin_marketing')))
);

CREATE POLICY "admin_income_delete_policy" ON public.admin_income
FOR DELETE USING (
  public.is_super_admin() OR 
  (franchise_id = public.get_user_franchise_id() AND 
   EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('franchise', 'admin_keuangan', 'admin_marketing')))
);

-- Worker income policies
DROP POLICY IF EXISTS "worker_income_select_policy" ON public.worker_income;
DROP POLICY IF EXISTS "worker_income_insert_policy" ON public.worker_income;
DROP POLICY IF EXISTS "worker_income_update_policy" ON public.worker_income;
DROP POLICY IF EXISTS "worker_income_delete_policy" ON public.worker_income;

CREATE POLICY "worker_income_select_policy" ON public.worker_income
FOR SELECT USING (
  public.is_super_admin() OR 
  franchise_id = public.get_user_franchise_id()
);

CREATE POLICY "worker_income_insert_policy" ON public.worker_income
FOR INSERT WITH CHECK (
  public.is_super_admin() OR 
  (franchise_id = public.get_user_franchise_id() AND 
   EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('franchise', 'admin_keuangan')) AND
   created_by = auth.uid())
);

CREATE POLICY "worker_income_update_policy" ON public.worker_income
FOR UPDATE USING (
  public.is_super_admin() OR 
  (franchise_id = public.get_user_franchise_id() AND 
   EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('franchise', 'admin_keuangan')))
);

CREATE POLICY "worker_income_delete_policy" ON public.worker_income
FOR DELETE USING (
  public.is_super_admin() OR 
  (franchise_id = public.get_user_franchise_id() AND 
   EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('franchise', 'admin_keuangan')))
);

-- Expenses policies
DROP POLICY IF EXISTS "expenses_select_policy" ON public.expenses;
DROP POLICY IF EXISTS "expenses_insert_policy" ON public.expenses;
DROP POLICY IF EXISTS "expenses_update_policy" ON public.expenses;
DROP POLICY IF EXISTS "expenses_delete_policy" ON public.expenses;

CREATE POLICY "expenses_select_policy" ON public.expenses
FOR SELECT USING (
  public.is_super_admin() OR 
  franchise_id = public.get_user_franchise_id()
);

CREATE POLICY "expenses_insert_policy" ON public.expenses
FOR INSERT WITH CHECK (
  public.is_super_admin() OR 
  (franchise_id = public.get_user_franchise_id() AND 
   EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('franchise', 'admin_keuangan')) AND
   created_by = auth.uid())
);

CREATE POLICY "expenses_update_policy" ON public.expenses
FOR UPDATE USING (
  public.is_super_admin() OR 
  (franchise_id = public.get_user_franchise_id() AND 
   EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('franchise', 'admin_keuangan')))
);

CREATE POLICY "expenses_delete_policy" ON public.expenses
FOR DELETE USING (
  public.is_super_admin() OR 
  (franchise_id = public.get_user_franchise_id() AND 
   EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('franchise', 'admin_keuangan')))
);

-- Salary withdrawals policies
DROP POLICY IF EXISTS "salary_withdrawals_select_policy" ON public.salary_withdrawals;
DROP POLICY IF EXISTS "salary_withdrawals_insert_policy" ON public.salary_withdrawals;
DROP POLICY IF EXISTS "salary_withdrawals_update_policy" ON public.salary_withdrawals;
DROP POLICY IF EXISTS "salary_withdrawals_delete_policy" ON public.salary_withdrawals;

CREATE POLICY "salary_withdrawals_select_policy" ON public.salary_withdrawals
FOR SELECT USING (
  public.is_super_admin() OR 
  franchise_id = public.get_user_franchise_id()
);

CREATE POLICY "salary_withdrawals_insert_policy" ON public.salary_withdrawals
FOR INSERT WITH CHECK (
  public.is_super_admin() OR 
  (franchise_id = public.get_user_franchise_id() AND 
   EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('franchise', 'admin_keuangan')) AND
   created_by = auth.uid())
);

CREATE POLICY "salary_withdrawals_update_policy" ON public.salary_withdrawals
FOR UPDATE USING (
  public.is_super_admin() OR 
  (franchise_id = public.get_user_franchise_id() AND 
   EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('franchise', 'admin_keuangan')))
);

CREATE POLICY "salary_withdrawals_delete_policy" ON public.salary_withdrawals
FOR DELETE USING (
  public.is_super_admin() OR 
  (franchise_id = public.get_user_franchise_id() AND 
   EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('franchise', 'admin_keuangan')))
);

-- Create public view for worker income (accessible by anonymous users)
DROP VIEW IF EXISTS public.worker_income_public;

CREATE VIEW public.worker_income_public AS
SELECT 
  wi.id,
  wi.code,
  wi.jobdesk,
  wi.fee,
  w.nama as worker_name,
  wi.tanggal,
  f.slug as franchise_slug,
  f.name as franchise_name
FROM public.worker_income wi
JOIN public.workers w ON wi.worker_id = w.id
JOIN public.franchises f ON wi.franchise_id = f.id;

-- Grant access to anon and authenticated roles for the view
GRANT SELECT ON public.worker_income_public TO anon;
GRANT SELECT ON public.worker_income_public TO authenticated;

-- Create function to generate franchise_id automatically
CREATE OR REPLACE FUNCTION public.generate_franchise_id()
RETURNS TEXT AS $$
DECLARE
  next_num INTEGER;
  result TEXT;
BEGIN
  -- Get the next sequence number
  SELECT COALESCE(MAX(CAST(SUBSTRING(franchise_id FROM 4) AS INTEGER)), 0) + 1
  INTO next_num
  FROM public.franchises
  WHERE franchise_id ~ '^FR-[0-9]+$';
  
  -- Format as FR-001, FR-002, etc.
  result := 'FR-' || LPAD(next_num::TEXT, 3, '0');
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate franchise_id if not provided
DROP TRIGGER IF EXISTS trigger_auto_franchise_id ON public.franchises;
DROP FUNCTION IF EXISTS public.auto_generate_franchise_id();

CREATE OR REPLACE FUNCTION public.auto_generate_franchise_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.franchise_id IS NULL OR NEW.franchise_id = '' THEN
    NEW.franchise_id := public.generate_franchise_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_franchise_id
  BEFORE INSERT ON public.franchises
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_generate_franchise_id();