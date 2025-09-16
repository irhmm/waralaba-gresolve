-- Make get_franchise_profit_sharing_data VOLATILE so it can perform writes via calculate_*
CREATE OR REPLACE FUNCTION public.get_franchise_profit_sharing_data(
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
VOLATILE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- First, ensure data is calculated for the target month
  PERFORM public.calculate_franchise_profit_sharing(target_month_year);
  
  -- Return the data with proper coalesce for share_nominal
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