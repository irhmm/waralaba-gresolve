-- Fix ambiguous column references in get_franchise_profit_sharing_data function
CREATE OR REPLACE FUNCTION public.get_franchise_profit_sharing_data(target_month_year text DEFAULT to_char(now(), 'YYYY-MM'::text))
 RETURNS TABLE(franchise_id uuid, franchise_name text, total_revenue numeric, admin_percentage numeric, share_nominal numeric, payment_status text)
 LANGUAGE plpgsql
 VOLATILE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- First, ensure data is calculated for the target month
  PERFORM public.calculate_franchise_profit_sharing(target_month_year);
  
  -- Return the data with proper column qualification
  RETURN QUERY
  SELECT 
    fps.franchise_id,
    f.name as franchise_name,
    fps.total_revenue,
    fps.admin_percentage,
    COALESCE(fps.share_nominal, fps.total_revenue * fps.admin_percentage / 100) as share_nominal,
    fps.payment_status
  FROM public.franchise_profit_sharing fps
  JOIN public.franchises f ON fps.franchise_id = f.id
  WHERE fps.month_year = target_month_year
  ORDER BY f.name;
END;
$function$;

-- Update calculate_franchise_profit_sharing to use per-franchise settings with fallbacks
CREATE OR REPLACE FUNCTION public.calculate_franchise_profit_sharing(target_month_year text DEFAULT to_char(now(), 'YYYY-MM'::text))
 RETURNS TABLE(franchise_id uuid, franchise_name text, total_revenue numeric, admin_percentage numeric, share_nominal numeric, payment_status text)
 LANGUAGE plpgsql
 VOLATILE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  global_admin_pct NUMERIC;
  global_franchise_pct NUMERIC;
BEGIN
  -- Get global settings as fallback
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
  ),
  franchise_settings AS (
    SELECT 
      f.id AS fr_id,
      COALESCE(fps.admin_percentage, global_admin_pct) AS admin_pct,
      COALESCE(fps.franchise_percentage, global_franchise_pct) AS franchise_pct
    FROM public.franchises f
    LEFT JOIN public.franchise_profit_settings fps ON f.id = fps.franchise_id
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
    fs.admin_pct AS admin_percentage,
    fs.franchise_pct AS franchise_percentage,
    COALESCE(r.total_revenue, 0) * fs.admin_pct / 100 AS share_nominal,
    'unpaid' AS payment_status,
    auth.uid() AS created_by
  FROM public.franchises f
  LEFT JOIN revenue r ON f.id = r.fr_id
  LEFT JOIN franchise_settings fs ON f.id = fs.fr_id
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
$function$;