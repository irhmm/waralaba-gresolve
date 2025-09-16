-- Create a new table for global franchise profit sharing settings
CREATE TABLE public.franchise_profit_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  franchise_id UUID NOT NULL REFERENCES public.franchises(id) ON DELETE CASCADE,
  admin_percentage NUMERIC NOT NULL DEFAULT 20.00 CHECK (admin_percentage >= 0 AND admin_percentage <= 100),
  franchise_percentage NUMERIC NOT NULL DEFAULT 80.00 CHECK (franchise_percentage >= 0 AND franchise_percentage <= 100),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  UNIQUE(franchise_id),
  CONSTRAINT check_percentage_sum CHECK (admin_percentage + franchise_percentage = 100)
);

-- Enable RLS
ALTER TABLE public.franchise_profit_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for franchise_profit_settings
CREATE POLICY "Super admin can manage all profit settings" 
ON public.franchise_profit_settings 
FOR ALL 
USING (is_super_admin());

CREATE POLICY "Franchise can view their own profit settings" 
ON public.franchise_profit_settings 
FOR SELECT 
USING (franchise_id = get_user_franchise_id());

-- Create trigger for updated_at
CREATE TRIGGER update_franchise_profit_settings_updated_at
BEFORE UPDATE ON public.franchise_profit_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_franchise_profit_sharing_updated_at();

-- Create function to get global profit sharing settings
CREATE OR REPLACE FUNCTION public.get_global_franchise_profit_settings(target_franchise_id UUID)
RETURNS TABLE(admin_percentage NUMERIC, franchise_percentage NUMERIC)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Try to get existing settings
  RETURN QUERY
  SELECT 
    fps.admin_percentage,
    fps.franchise_percentage
  FROM public.franchise_profit_settings fps
  WHERE fps.franchise_id = target_franchise_id;
  
  -- If no settings found, return default values
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      20.00::NUMERIC as admin_percentage,
      80.00::NUMERIC as franchise_percentage;
  END IF;
END;
$$;

-- Insert default settings for existing franchises
INSERT INTO public.franchise_profit_settings (franchise_id, admin_percentage, franchise_percentage)
SELECT 
  f.id,
  20.00,
  80.00
FROM public.franchises f
ON CONFLICT (franchise_id) DO NOTHING;