-- Create a new table for global franchise profit sharing settings
CREATE TABLE public.franchise_profit_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  franchise_id UUID NOT NULL REFERENCES public.franchises(id) ON DELETE CASCADE,
  admin_percentage NUMERIC NOT NULL DEFAULT 20.00 CHECK (admin_percentage >= 0 AND admin_percentage <= 100),
  franchise_percentage NUMERIC NOT NULL DEFAULT 80.00 CHECK (franchise_percentage >= 0 AND franchise_percentage <= 100),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL DEFAULT auth.uid(),
  UNIQUE(franchise_id),
  CONSTRAINT check_percentage_sum CHECK (admin_percentage + franchise_percentage = 100)
);

-- Enable RLS
ALTER TABLE public.franchise_profit_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for franchise_profit_settings
CREATE POLICY "Super admin can manage all profit settings" 
ON public.franchise_profit_settings 
FOR ALL 
USING (is_super_admin());

CREATE POLICY "Franchise can view their own profit settings" 
ON public.franchise_profit_settings 
FOR SELECT 
USING (franchise_id = get_user_franchise_id());

-- Create trigger for updated_at
CREATE TRIGGER update_franchise_profit_settings_updated_at
BEFORE UPDATE ON public.franchise_profit_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_franchise_profit_sharing_updated_at();

-- Create function to get global profit sharing settings
CREATE OR REPLACE FUNCTION public.get_global_franchise_profit_settings(target_franchise_id UUID)
RETURNS TABLE(admin_percentage NUMERIC, franchise_percentage NUMERIC)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Try to get existing settings
  RETURN QUERY
  SELECT 
    fps.admin_percentage,
    fps.franchise_percentage
  FROM public.franchise_profit_settings fps
  WHERE fps.franchise_id = target_franchise_id;
  
  -- If no settings found, return default values
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      20.00::NUMERIC as admin_percentage,
      80.00::NUMERIC as franchise_percentage;
  END IF;
END;
$$;

-- Insert default settings for existing franchises
INSERT INTO public.franchise_profit_settings (franchise_id, admin_percentage, franchise_percentage, created_by)
SELECT 
  f.id,
  20.00,
  80.00,
  (SELECT auth.uid() LIMIT 1)
FROM public.franchises f
ON CONFLICT (franchise_id) DO NOTHING;

-- Update the calculate_franchise_profit_sharing function to use global settings
CREATE OR REPLACE FUNCTION public.calculate_franchise_profit_sharing(target_month_year TEXT DEFAULT to_char(now(), 'YYYY-MM'))
RETURNS TABLE(franchise_id UUID, franchise_name TEXT, total_revenue NUMERIC, admin_percentage NUMERIC, share_nominal NUMERIC, payment_status TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
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
  ),
  global_settings AS (
    SELECT 
      fps.franchise_id AS fr_id,
      fps.admin_percentage,
      fps.franchise_percentage
    FROM public.franchise_profit_settings fps
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
    COALESCE(gs.admin_percentage, 20.00) AS admin_percentage,
    COALESCE(gs.franchise_percentage, 80.00) AS franchise_percentage,
    COALESCE(r.total_revenue, 0) * COALESCE(gs.admin_percentage, 20.00) / 100 AS share_nominal,
    'unpaid' AS payment_status,
    auth.uid() AS created_by
  FROM public.franchises f
  LEFT JOIN revenue r ON f.id = r.fr_id
  LEFT JOIN global_settings gs ON f.id = gs.fr_id
  ON CONFLICT ON CONSTRAINT franchise_profit_sharing_franchise_id_month_year_key
  DO UPDATE SET
    total_revenue = EXCLUDED.total_revenue,
    admin_percentage = EXCLUDED.admin_percentage,
    franchise_percentage = EXCLUDED.franchise_percentage,
    share_nominal = EXCLUDED.total_revenue * EXCLUDED.admin_percentage / 100,
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