-- Rewrite calculate_franchise_profit_sharing with explicit aliases to avoid ambiguous column errors
CREATE OR REPLACE FUNCTION public.calculate_franchise_profit_sharing(
  target_month_year TEXT DEFAULT to_char(now(), 'YYYY-MM')
)
RETURNS TABLE(
  franchise_id UUID,
  franchise_name TEXT,
  total_revenue NUMERIC,
  admin_percentage NUMERIC,
  share_nominal NUMERIC,
  payment_status TEXT
)
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
  settings AS (
    SELECT 
      fps.franchise_id AS fr_id,
      fps.admin_percentage,
      fps.franchise_percentage,
      fps.payment_status
    FROM public.franchise_profit_sharing fps
    WHERE fps.month_year = target_month_year
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
    COALESCE(s.admin_percentage, 20.00) AS admin_percentage,
    COALESCE(s.franchise_percentage, 80.00) AS franchise_percentage,
    COALESCE(r.total_revenue, 0) * COALESCE(s.admin_percentage, 20.00) / 100 AS share_nominal,
    COALESCE(s.payment_status, 'unpaid') AS payment_status,
    auth.uid() AS created_by
  FROM public.franchises f
  LEFT JOIN revenue r ON f.id = r.fr_id
  LEFT JOIN settings s ON f.id = s.fr_id
  ON CONFLICT ON CONSTRAINT franchise_profit_sharing_franchise_id_month_year_key
  DO UPDATE SET
    total_revenue = EXCLUDED.total_revenue,
    -- keep existing percentages, just refresh share based on latest revenue
    share_nominal = EXCLUDED.total_revenue * public.franchise_profit_sharing.admin_percentage / 100,
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