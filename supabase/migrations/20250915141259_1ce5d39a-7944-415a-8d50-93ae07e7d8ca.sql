-- Fix: Remove policy on view and create proper anonymous access
-- Drop the failed policy attempt
-- CREATE POLICY "worker_income_public_select" ON public.worker_income_public

-- Grant select access to anonymous users on the view
GRANT SELECT ON public.worker_income_public TO anon;
GRANT SELECT ON public.worker_income_public TO authenticated;

-- Also ensure the underlying tables can be accessed through the view by anonymous users
-- We need to allow anonymous users to access the view data, but this is tricky with RLS
-- Let's create a security definer function instead

-- Create a function that bypasses RLS for public worker income data
CREATE OR REPLACE FUNCTION public.get_worker_income_public(franchise_slug_param TEXT DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  code TEXT,
  jobdesk TEXT,
  fee NUMERIC,
  worker_name TEXT,
  tanggal TIMESTAMPTZ,
  franchise_slug TEXT,
  franchise_name TEXT
) AS $$
BEGIN
  RETURN QUERY
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
  JOIN public.franchises f ON wi.franchise_id = f.id
  WHERE (franchise_slug_param IS NULL OR f.slug = franchise_slug_param);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- Grant execute permission to anonymous users
GRANT EXECUTE ON FUNCTION public.get_worker_income_public(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_worker_income_public(TEXT) TO authenticated;