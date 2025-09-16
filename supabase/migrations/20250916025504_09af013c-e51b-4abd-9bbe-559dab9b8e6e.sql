-- Create table for franchise profit sharing settings
CREATE TABLE public.franchise_profit_sharing (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  franchise_id UUID NOT NULL REFERENCES public.franchises(id) ON DELETE CASCADE,
  month_year TEXT NOT NULL, -- Format: 'YYYY-MM'
  admin_percentage NUMERIC(5,2) NOT NULL DEFAULT 20.00, -- Percentage for Super Admin
  franchise_percentage NUMERIC(5,2) NOT NULL DEFAULT 80.00, -- Percentage for Franchise
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  
  -- Ensure one record per franchise per month
  UNIQUE(franchise_id, month_year)
);

-- Enable RLS
ALTER TABLE public.franchise_profit_sharing ENABLE ROW LEVEL SECURITY;

-- RLS Policies for franchise_profit_sharing
CREATE POLICY "Super admin can manage all profit sharing settings" 
ON public.franchise_profit_sharing 
FOR ALL 
USING (is_super_admin());

CREATE POLICY "Franchise can view their own profit sharing settings" 
ON public.franchise_profit_sharing 
FOR SELECT 
USING (franchise_id = get_user_franchise_id());

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_franchise_profit_sharing_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_franchise_profit_sharing_updated_at
  BEFORE UPDATE ON public.franchise_profit_sharing
  FOR EACH ROW
  EXECUTE FUNCTION public.update_franchise_profit_sharing_updated_at();

-- Function to get or create default profit sharing for a franchise and month
CREATE OR REPLACE FUNCTION public.get_franchise_profit_sharing(
  target_franchise_id UUID,
  target_month TEXT DEFAULT to_char(now(), 'YYYY-MM')
)
RETURNS TABLE(
  admin_percentage NUMERIC,
  franchise_percentage NUMERIC,
  month_year TEXT
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Try to get existing record
  RETURN QUERY
  SELECT 
    fps.admin_percentage,
    fps.franchise_percentage,
    fps.month_year
  FROM public.franchise_profit_sharing fps
  WHERE fps.franchise_id = target_franchise_id 
    AND fps.month_year = target_month;
  
  -- If no record found, return default values
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      20.00::NUMERIC as admin_percentage,
      80.00::NUMERIC as franchise_percentage,
      target_month as month_year;
  END IF;
END;
$$;