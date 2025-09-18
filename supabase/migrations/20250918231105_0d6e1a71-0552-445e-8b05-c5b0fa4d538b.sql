-- Add worker_name column to worker_income table and make worker_id nullable
ALTER TABLE public.worker_income 
ADD COLUMN worker_name TEXT;

-- Make worker_id nullable
ALTER TABLE public.worker_income 
ALTER COLUMN worker_id DROP NOT NULL;

-- Add constraint to ensure either worker_id or worker_name is provided
ALTER TABLE public.worker_income 
ADD CONSTRAINT worker_income_worker_reference_check 
CHECK (
  (worker_id IS NOT NULL AND worker_name IS NULL) OR 
  (worker_id IS NULL AND worker_name IS NOT NULL)
);