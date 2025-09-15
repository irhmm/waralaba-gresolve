-- Create function to automatically assign default user role
CREATE OR REPLACE FUNCTION public.ensure_default_user_role(target_user_id uuid DEFAULT auth.uid())
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  existing_role json;
  result json;
BEGIN
  -- Check if user already has a role
  SELECT json_build_object(
    'role', ur.role,
    'franchise_id', ur.franchise_id,
    'exists', true
  )
  INTO existing_role
  FROM public.user_roles ur
  WHERE ur.user_id = target_user_id;
  
  -- If user has a role, return it
  IF existing_role IS NOT NULL THEN
    RETURN existing_role;
  END IF;
  
  -- If no role exists, assign default 'user' role
  INSERT INTO public.user_roles (user_id, role, franchise_id)
  VALUES (target_user_id, 'user', NULL)
  ON CONFLICT (user_id, role) DO NOTHING;
  
  -- Return the newly created role
  result := json_build_object(
    'role', 'user',
    'franchise_id', null,
    'exists', true
  );
  
  RETURN result;
END;
$$;