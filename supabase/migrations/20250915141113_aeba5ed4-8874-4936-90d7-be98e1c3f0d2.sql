-- Remove the problematic RLS policy on view that caused the error
-- Views don't support RLS policies directly

-- Create public view for worker income (accessible by anonymous users)
-- This view already exists from previous migration, but let's make sure it's properly configured
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