-- Enable realtime for the main tables
ALTER TABLE public.admin_income REPLICA IDENTITY FULL;
ALTER TABLE public.worker_income REPLICA IDENTITY FULL;
ALTER TABLE public.expenses REPLICA IDENTITY FULL;
ALTER TABLE public.franchises REPLICA IDENTITY FULL;

-- Add tables to supabase_realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_income;
ALTER PUBLICATION supabase_realtime ADD TABLE public.worker_income;
ALTER PUBLICATION supabase_realtime ADD TABLE public.expenses;
ALTER PUBLICATION supabase_realtime ADD TABLE public.franchises;