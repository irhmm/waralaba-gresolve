-- Create worker_salary_withdrawals table
CREATE TABLE public.worker_salary_withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  franchise_id uuid NOT NULL,
  worker_name text NOT NULL,
  jumlah numeric NOT NULL CHECK (jumlah > 0),
  catatan text,
  tanggal timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.worker_salary_withdrawals ENABLE ROW LEVEL SECURITY;

-- SELECT: super_admin or franchise members
CREATE POLICY "wsw_select_policy"
ON public.worker_salary_withdrawals
FOR SELECT
USING (
  is_super_admin() OR (franchise_id = get_user_franchise_id())
);

-- INSERT: super_admin or franchise role only
CREATE POLICY "wsw_insert_policy"
ON public.worker_salary_withdrawals
FOR INSERT
WITH CHECK (
  is_super_admin() OR (
    franchise_id = get_user_franchise_id()
    AND EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'franchise'::app_role
    )
    AND created_by = auth.uid()
  )
);

-- UPDATE: super_admin or franchise role only
CREATE POLICY "wsw_update_policy"
ON public.worker_salary_withdrawals
FOR UPDATE
USING (
  is_super_admin() OR (
    franchise_id = get_user_franchise_id()
    AND EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'franchise'::app_role
    )
  )
);

-- DELETE: super_admin or franchise role only
CREATE POLICY "wsw_delete_policy"
ON public.worker_salary_withdrawals
FOR DELETE
USING (
  is_super_admin() OR (
    franchise_id = get_user_franchise_id()
    AND EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'franchise'::app_role
    )
  )
);

-- Index for performance
CREATE INDEX idx_wsw_franchise_tanggal ON public.worker_salary_withdrawals(franchise_id, tanggal DESC);
CREATE INDEX idx_wsw_worker_name ON public.worker_salary_withdrawals(franchise_id, lower(worker_name));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.worker_salary_withdrawals;