ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS consultant_id uuid REFERENCES public.consultants(id) ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION public.data_owner()
 RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.team_members WHERE lower(email)=lower(coalesce(auth.jwt()->>'email','')) AND papel='vendedor') THEN NULL
    ELSE coalesce((SELECT owner_id FROM public.team_members WHERE lower(email) = lower(coalesce(auth.jwt()->>'email','')) LIMIT 1), auth.uid())
  END
$$;

CREATE OR REPLACE FUNCTION public.minha_performance(p_mes text)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE o uuid; c uuid; ini date; fim date; r jsonb; mp record;
BEGIN
  SELECT owner_id, consultant_id INTO o, c FROM public.team_members
   WHERE lower(email)=lower(coalesce(auth.jwt()->>'email','')) AND papel='vendedor' LIMIT 1;
  IF auth.uid() IS NULL OR c IS NULL THEN RAISE EXCEPTION 'Não autorizado'; END IF;
  ini := to_date(p_mes || '-01','YYYY-MM-DD'); fim := (ini + interval '1 month - 1 day')::date;
  SELECT * INTO mp FROM public.month_params WHERE user_id=o AND mes=p_mes LIMIT 1;
  WITH s AS (
    SELECT k.id, k.nome, k.department_id,
      coalesce((SELECT sum(servicos) FROM daily_sales d WHERE d.consultant_id=k.id AND d.dia BETWEEN ini AND fim),0) sv,
      coalesce((SELECT sum(pecas) FROM daily_sales d WHERE d.consultant_id=k.id AND d.dia BETWEEN ini AND fim),0) pc,
      coalesce((SELECT sum(margem_pecas) FROM daily_sales d WHERE d.consultant_id=k.id AND d.dia BETWEEN ini AND fim),0) mg,
      coalesce((SELECT sum(servicos) FROM goals g WHERE g.consultant_id=k.id AND g.mes=p_mes),0) ms,
      coalesce((SELECT sum(pecas) FROM goals g WHERE g.consultant_id=k.id AND g.mes=p_mes),0) mpc
    FROM consultants k WHERE k.user_id=o
  ), rk AS (
    SELECT *, (sv+pc)/nullif(ms+mpc,0) perf, rank() OVER (ORDER BY (sv+pc)/nullif(ms+mpc,0) DESC) pos
    FROM s WHERE ms+mpc > 0
  )
  SELECT jsonb_build_object(
    'nome', s.nome,
    'departamento', (SELECT nome FROM departments WHERE id=s.department_id),
    'servicos', s.sv, 'pecas', s.pc, 'margem', s.mg, 'meta_servicos', s.ms, 'meta_pecas', s.mpc,
    'posicao', (SELECT pos FROM rk WHERE rk.id=c),
    'participantes', (SELECT count(*) FROM rk),
    'perf_lider', (SELECT max(perf) FROM rk),
    'params', CASE WHEN mp IS NULL THEN NULL ELSE jsonb_build_object('du_totais',mp.du_totais,'du_decorridos',mp.du_decorridos,'dc_totais',mp.dc_totais,'dc_decorridos',mp.dc_decorridos,'base',mp.base) END,
    'passagens', coalesce((SELECT sum(passagens) FROM agg_visits v WHERE v.consultant_id=c AND v.dia BETWEEN ini AND fim),0),
    'agregados', coalesce((SELECT jsonb_agg(jsonb_build_object('item',i.item,'qtd',i.q,'valor',i.v,'meta_qtd',i.mq)) FROM (
        SELECT item, sum(q) q, sum(v) v, sum(mq) mq FROM (
          SELECT item, qtd q, valor v, 0 mq FROM agg_sales a WHERE a.consultant_id=c AND a.dia BETWEEN ini AND fim
          UNION ALL SELECT item, 0, 0, meta_qtd FROM agg_goals ag WHERE ag.consultant_id=c AND ag.mes=p_mes
        ) x GROUP BY item) i),'[]'::jsonb)
  ) INTO r FROM s WHERE s.id=c;
  RETURN r;
END $$;
GRANT EXECUTE ON FUNCTION public.minha_performance(text) TO authenticated;