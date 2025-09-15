-- Fix Security Issues

-- 1. Fix Security Definer View - recreate view with security_invoker=on
DROP VIEW public.worker_income_public;

CREATE VIEW public.worker_income_public 
WITH (security_invoker=on) AS
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

-- 2. Fix Function search_path - recreate functions with proper search_path
-- Fix generate_franchise_id function
CREATE OR REPLACE FUNCTION public.generate_franchise_id()
RETURNS TEXT AS $$
DECLARE
  next_num INTEGER;
  result TEXT;
BEGIN
  -- Get the next sequence number
  SELECT COALESCE(MAX(CAST(SUBSTRING(franchise_id FROM 4) AS INTEGER)), 0) + 1
  INTO next_num
  FROM public.franchises
  WHERE franchise_id ~ '^FR-[0-9]+$';
  
  -- Format as FR-001, FR-002, etc.
  result := 'FR-' || LPAD(next_num::TEXT, 3, '0');
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = '';

-- Fix auto_generate_franchise_id function
CREATE OR REPLACE FUNCTION public.auto_generate_franchise_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.franchise_id IS NULL OR NEW.franchise_id = '' THEN
    NEW.franchise_id := public.generate_franchise_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Grant permissions on the view again after recreation
GRANT SELECT ON public.worker_income_public TO anon;
GRANT SELECT ON public.worker_income_public TO authenticated;