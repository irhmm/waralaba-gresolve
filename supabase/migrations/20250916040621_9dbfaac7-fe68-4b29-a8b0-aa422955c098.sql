-- Update calculate_franchise_profit_sharing function to include worker income
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
  -- Calculate and insert/update profit sharing data for all franchises
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
    f.id as franchise_id,
    target_month_year as month_year,
    COALESCE(revenue_data.total_revenue, 0) as total_revenue,
    COALESCE(existing_settings.admin_percentage, 20.00) as admin_percentage,
    COALESCE(existing_settings.franchise_percentage, 80.00) as franchise_percentage,
    COALESCE(revenue_data.total_revenue, 0) * COALESCE(existing_settings.admin_percentage, 20.00) / 100 as share_nominal,
    COALESCE(existing_settings.payment_status, 'unpaid') as payment_status,
    auth.uid() as created_by
  FROM public.franchises f
  LEFT JOIN (
    SELECT 
      franchise_id,
      (COALESCE(admin_income_total, 0) + COALESCE(worker_income_total, 0)) as total_revenue
    FROM (
      SELECT 
        f.id as franchise_id,
        ai_data.admin_income_total,
        wi_data.worker_income_total
      FROM public.franchises f
      LEFT JOIN (
        SELECT 
          ai.franchise_id,
          SUM(ai.nominal) as admin_income_total
        FROM public.admin_income ai
        WHERE ai.tanggal >= (target_month_year || '-01')::DATE
          AND ai.tanggal < ((target_month_year || '-01')::DATE + INTERVAL '1 month')
        GROUP BY ai.franchise_id
      ) ai_data ON f.id = ai_data.franchise_id
      LEFT JOIN (
        SELECT 
          wi.franchise_id,
          SUM(wi.fee) as worker_income_total
        FROM public.worker_income wi
        WHERE wi.tanggal >= (target_month_year || '-01')::DATE
          AND wi.tanggal < ((target_month_year || '-01')::DATE + INTERVAL '1 month')
        GROUP BY wi.franchise_id
      ) wi_data ON f.id = wi_data.franchise_id
    ) combined_revenue
  ) revenue_data ON f.id = revenue_data.franchise_id
  LEFT JOIN (
    SELECT 
      fps.franchise_id,
      fps.admin_percentage,
      fps.franchise_percentage,
      fps.payment_status
    FROM public.franchise_profit_sharing fps
    WHERE fps.month_year = target_month_year
  ) existing_settings ON f.id = existing_settings.franchise_id
  ON CONFLICT ON CONSTRAINT franchise_profit_sharing_franchise_id_month_year_key
  DO UPDATE SET
    total_revenue = EXCLUDED.total_revenue,
    share_nominal = EXCLUDED.total_revenue * public.franchise_profit_sharing.admin_percentage / 100,
    updated_at = now();

  -- Return the calculated data
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
$$;