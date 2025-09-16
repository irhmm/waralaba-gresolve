-- Add missing columns to franchise_profit_sharing table
ALTER TABLE public.franchise_profit_sharing 
ADD COLUMN IF NOT EXISTS total_revenue NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS share_nominal NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('paid', 'unpaid'));

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_franchise_profit_sharing_month_year 
ON public.franchise_profit_sharing (month_year);

-- Create index for payment status filtering
CREATE INDEX IF NOT EXISTS idx_franchise_profit_sharing_payment_status 
ON public.franchise_profit_sharing (payment_status);