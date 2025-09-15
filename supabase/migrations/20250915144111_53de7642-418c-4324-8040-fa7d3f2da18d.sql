-- SQL snippet examples for franchise management

-- Example: Insert new franchise
-- INSERT INTO public.franchises (name, slug, address) 
-- VALUES ('Franchise Jakarta Selatan', 'franchise-jakarta-selatan', 'Jakarta Selatan, Indonesia')
-- RETURNING id, franchise_id, slug;

-- Example: Insert user role (assign user to franchise)
-- INSERT INTO public.user_roles (user_id, role, franchise_id)
-- VALUES ('user-uuid-here', 'franchise', 'franchise-uuid-here')
-- ON CONFLICT (user_id) DO UPDATE SET 
--   role = EXCLUDED.role,
--   franchise_id = EXCLUDED.franchise_id;

-- Example: Check if user has access to franchise
-- SELECT ur.role, ur.franchise_id, f.name as franchise_name, f.slug
-- FROM public.user_roles ur
-- JOIN public.franchises f ON f.id = ur.franchise_id
-- WHERE ur.user_id = auth.uid();

-- Example: Get franchise financial summary
-- SELECT 
--   f.id,
--   f.name,
--   f.slug,
--   f.franchise_id,
--   f.address,
--   (SELECT COUNT(*) FROM public.workers w WHERE w.franchise_id = f.id AND w.status = 'active') as worker_count,
--   COALESCE((SELECT SUM(ai.nominal) FROM public.admin_income ai WHERE ai.franchise_id = f.id), 0) as total_admin_income,
--   COALESCE((SELECT SUM(wi.fee) FROM public.worker_income wi WHERE wi.franchise_id = f.id), 0) as total_worker_income,
--   COALESCE((SELECT SUM(e.nominal) FROM public.expenses e WHERE e.franchise_id = f.id), 0) as total_expenses
-- FROM public.franchises f
-- WHERE is_super_admin() OR f.id = get_user_franchise_id()
-- ORDER BY f.created_at DESC;

-- Example RLS policies demonstration
-- These policies are already implemented in the system:

-- franchises table policies (super_admin only for CUD, franchise-scoped for read)
-- CREATE POLICY "franchises_select_policy" ON public.franchises FOR SELECT
-- USING (is_super_admin() OR id = get_user_franchise_id());

-- worker_income table policies (franchise-scoped access)
-- CREATE POLICY "worker_income_select_policy" ON public.worker_income FOR SELECT  
-- USING (is_super_admin() OR franchise_id = get_user_franchise_id());

-- admin_income table policies (franchise-scoped with role restrictions)
-- CREATE POLICY "admin_income_insert_policy" ON public.admin_income FOR INSERT
-- WITH CHECK (is_super_admin() OR (
--   franchise_id = get_user_franchise_id() AND 
--   EXISTS (
--     SELECT 1 FROM user_roles 
--     WHERE user_id = auth.uid() 
--     AND role IN ('franchise', 'admin_keuangan', 'admin_marketing')
--   ) AND 
--   created_by = auth.uid()
-- ));

-- This migration contains example SQL snippets for reference only
-- No actual changes are made to the database structure
SELECT 'Migration completed - SQL examples provided for franchise management' as status;