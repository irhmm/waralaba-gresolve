-- Create a global profit sharing settings table (single row for all franchises)
CREATE TABLE public.global_profit_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_percentage NUMERIC NOT NULL DEFAULT 20.00 CHECK (admin_percentage >= 0 AND admin_percentage <= 100),
  franchise_percentage NUMERIC NOT NULL DEFAULT 80.00 CHECK (franchise_percentage >= 0 AND franchise_percentage <= 100),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  CONSTRAINT check_global_percentage_sum CHECK (admin_percentage + franchise_percentage = 100)
);

-- Enable RLS
ALTER TABLE public.global_profit_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for global_profit_settings
CREATE POLICY "Super admin can manage global profit settings" 
ON public.global_profit_settings 
FOR ALL 
USING (is_super_admin());

CREATE POLICY "Everyone can view global profit settings" 
ON public.global_profit_settings 
FOR SELECT 
USING (true);

-- Insert initial global settings
INSERT INTO public.global_profit_settings (admin_percentage, franchise_percentage)
VALUES (20.00, 80.00);

-- Create function to get global profit sharing settings
CREATE OR REPLACE FUNCTION public.get_global_profit_settings()
RETURNS TABLE(admin_percentage NUMERIC, franchise_percentage NUMERIC)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Get the single global setting
  RETURN QUERY
  SELECT 
    gps.admin_percentage,
    gps.franchise_percentage
  FROM public.global_profit_settings gps
  ORDER BY gps.created_at DESC
  LIMIT 1;
  
  -- If no settings found, return default values
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      20.00::NUMERIC as admin_percentage,
      80.00::NUMERIC as franchise_percentage;
  END IF;
END;
$$;

-- Update the calculate_franchise_profit_sharing function to use global settings
CREATE OR REPLACE FUNCTION public.calculate_franchise_profit_sharing(target_month_year TEXT DEFAULT to_char(now(), 'YYYY-MM'))
RETURNS TABLE(franchise_id UUID, franchise_name TEXT, total_revenue NUMERIC, admin_percentage NUMERIC, share_nominal NUMERIC, payment_status TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  global_admin_pct NUMERIC;
  global_franchise_pct NUMERIC;
BEGIN
  -- Get global settings
  SELECT admin_percentage, franchise_percentage
  INTO global_admin_pct, global_franchise_pct
  FROM public.get_global_profit_settings()
  LIMIT 1;
  
  -- If no global settings, use defaults
  IF global_admin_pct IS NULL THEN
    global_admin_pct := 20.00;
    global_franchise_pct := 80.00;
  END IF;

  WITH
  month_bounds AS (
    SELECT 
      (target_month_year || '-01')::date AS start_date,
      ((target_month_year || '-01')::date + INTERVAL '1 month')::date AS end_date
  ),
  admin_income_sum AS (
    SELECT 
      ai.franchise_id AS fr_id,
      SUM(ai.nominal) AS admin_income_total
    FROM public.admin_income ai
    CROSS JOIN month_bounds mb
    WHERE ai.tanggal >= mb.start_date
      AND ai.tanggal < mb.end_date
    GROUP BY ai.franchise_id
  ),
  worker_income_sum AS (
    SELECT 
      wi.franchise_id AS fr_id,
      SUM(wi.fee) AS worker_income_total
    FROM public.worker_income wi
    CROSS JOIN month_bounds mb
    WHERE wi.tanggal >= mb.start_date
      AND wi.tanggal < mb.end_date
    GROUP BY wi.franchise_id
  ),
  revenue AS (
    SELECT 
      f.id AS fr_id,
      COALESCE(ai.admin_income_total, 0) + COALESCE(wi.worker_income_total, 0) AS total_revenue
    FROM public.franchises f
    LEFT JOIN admin_income_sum ai ON f.id = ai.fr_id
    LEFT JOIN worker_income_sum wi ON f.id = wi.fr_id
  )
  INSERT INTO public.franchise_profit_sharing (
    franchise_id,
    month_year,
    total_revenue,
    admin_percentage,
    franchise_percentage,
    share_nominal,
    payment_status,
    created_by
  )
  SELECT 
    f.id AS franchise_id,
    target_month_year AS month_year,
    COALESCE(r.total_revenue, 0) AS total_revenue,
    global_admin_pct AS admin_percentage,
    global_franchise_pct AS franchise_percentage,
    COALESCE(r.total_revenue, 0) * global_admin_pct / 100 AS share_nominal,
    'unpaid' AS payment_status,
    auth.uid() AS created_by
  FROM public.franchises f
  LEFT JOIN revenue r ON f.id = r.fr_id
  ON CONFLICT ON CONSTRAINT franchise_profit_sharing_franchise_id_month_year_key
  DO UPDATE SET
    total_revenue = EXCLUDED.total_revenue,
    admin_percentage = global_admin_pct,
    franchise_percentage = global_franchise_pct,
    share_nominal = EXCLUDED.total_revenue * global_admin_pct / 100,
    updated_at = now();

  -- Return the calculated data
  RETURN QUERY
  SELECT 
    fps.franchise_id,
    f.name AS franchise_name,
    fps.total_revenue,
    fps.admin_percentage,
    COALESCE(fps.share_nominal, fps.total_revenue * fps.admin_percentage / 100) AS share_nominal,
    fps.payment_status
  FROM public.franchise_profit_sharing fps
  JOIN public.franchises f ON fps.franchise_id = f.id
  WHERE fps.month_year = target_month_year
  ORDER BY f.name;
END;
$$;