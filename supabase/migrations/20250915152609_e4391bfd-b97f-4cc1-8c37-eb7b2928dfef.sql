-- Create RPC function to get user role more reliably
CREATE OR REPLACE FUNCTION public.get_user_role_rpc(target_user_id uuid DEFAULT auth.uid())
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'role', ur.role,
    'franchise_id', ur.franchise_id,
    'exists', true
  )
  INTO result
  FROM public.user_roles ur
  WHERE ur.user_id = target_user_id;
  
  -- If no role found, return null result
  IF result IS NULL THEN
    result := json_build_object(
      'role', null,
      'franchise_id', null,
      'exists', false
    );
  END IF;
  
  RETURN result;
END;
$$;