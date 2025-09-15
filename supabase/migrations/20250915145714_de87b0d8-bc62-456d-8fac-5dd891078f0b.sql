-- Fix RLS issues for role_changes audit table
ALTER TABLE public.role_changes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for role_changes
CREATE POLICY "Super admin can view all role changes" 
ON public.role_changes 
FOR SELECT 
USING (is_super_admin());

CREATE POLICY "Super admin can insert role changes" 
ON public.role_changes 
FOR INSERT 
WITH CHECK (is_super_admin() AND actor_id = auth.uid());

CREATE POLICY "No deletes on role changes audit log" 
ON public.role_changes 
FOR DELETE 
USING (false);

CREATE POLICY "No updates on role changes audit log" 
ON public.role_changes 
FOR UPDATE 
USING (false);