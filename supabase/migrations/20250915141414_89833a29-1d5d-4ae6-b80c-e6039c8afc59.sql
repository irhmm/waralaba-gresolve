-- Fix security issues from linter

-- Fix function search_path for all security definer functions
DROP FUNCTION IF EXISTS public.generate_franchise_id();

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
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- Fix auto generate function
DROP FUNCTION IF EXISTS public.auto_generate_franchise_id();

CREATE OR REPLACE FUNCTION public.auto_generate_franchise_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.franchise_id IS NULL OR NEW.franchise_id = '' THEN
    NEW.franchise_id := public.generate_franchise_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;