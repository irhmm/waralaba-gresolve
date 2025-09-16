-- Update RLS policy for worker_income to allow users to read data for their franchise
DROP POLICY IF EXISTS "worker_income_select_policy" ON public.worker_income;

CREATE POLICY "worker_income_select_policy" 
ON public.worker_income 
FOR SELECT 
USING (
  is_super_admin() OR 
  (franchise_id = get_user_franchise_id())
);