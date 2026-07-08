
CREATE OR REPLACE FUNCTION public.get_franchise_ranking(target_month_year text DEFAULT to_char(now(), 'YYYY-MM'))
RETURNS TABLE(
  franchise_id uuid,
  franchise_name text,
  franchise_code text,
  admin_income numeric,
  worker_income numeric,
  expenses numeric,
  profit_share numeric,
  omset numeric,
  rank_position integer
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  WITH mb AS (
    SELECT (target_month_year || '-01')::date AS start_date,
           ((target_month_year || '-01')::date + INTERVAL '1 month')::date AS end_date
  ),
  ai AS (
    SELECT a.franchise_id AS fr_id, COALESCE(SUM(a.nominal),0) AS total
    FROM public.admin_income a, mb
    WHERE a.tanggal >= mb.start_date AND a.tanggal < mb.end_date
    GROUP BY a.franchise_id
  ),
  wi AS (
    SELECT w.franchise_id AS fr_id, COALESCE(SUM(w.fee),0) AS total
    FROM public.worker_income w, mb
    WHERE w.tanggal >= mb.start_date AND w.tanggal < mb.end_date
    GROUP BY w.franchise_id
  ),
  ex AS (
    SELECT e.franchise_id AS fr_id, COALESCE(SUM(e.nominal),0) AS total
    FROM public.expenses e, mb
    WHERE e.tanggal >= mb.start_date AND e.tanggal < mb.end_date
    GROUP BY e.franchise_id
  ),
  ps AS (
    SELECT fps.franchise_id AS fr_id, COALESCE(fps.share_nominal,0) AS total
    FROM public.franchise_profit_sharing fps
    WHERE fps.month_year = target_month_year
  ),
  base AS (
    SELECT
      f.id AS fr_id, f.name AS fr_name, f.franchise_id AS fr_code,
      COALESCE(ai.total,0) AS admin_inc,
      COALESCE(wi.total,0) AS worker_inc,
      COALESCE(ex.total,0) AS exp_total,
      COALESCE(ps.total,0) AS ps_total
    FROM public.franchises f
    LEFT JOIN ai ON ai.fr_id = f.id
    LEFT JOIN wi ON wi.fr_id = f.id
    LEFT JOIN ex ON ex.fr_id = f.id
    LEFT JOIN ps ON ps.fr_id = f.id
  )
  SELECT b.fr_id, b.fr_name, b.fr_code, b.admin_inc, b.worker_inc, b.exp_total, b.ps_total,
    (b.admin_inc + b.worker_inc - b.exp_total - b.ps_total) AS omset,
    (RANK() OVER (ORDER BY (b.admin_inc + b.worker_inc - b.exp_total - b.ps_total) DESC))::int
  FROM base b
  ORDER BY omset DESC;
END;
$$;
