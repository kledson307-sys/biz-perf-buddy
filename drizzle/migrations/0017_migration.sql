ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS tecnico_nome text;
ALTER TABLE public.team_members DROP CONSTRAINT team_members_papel_check;
ALTER TABLE public.team_members ADD CONSTRAINT team_members_papel_check CHECK (papel = ANY (ARRAY['viewer','editor','vendedor','tecnico']));

CREATE OR REPLACE FUNCTION public.data_owner()
 RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.team_members WHERE lower(email)=lower(coalesce(auth.jwt()->>'email','')) AND papel IN ('vendedor','tecnico')) THEN NULL
    ELSE coalesce((SELECT owner_id FROM public.team_members WHERE lower(email) = lower(coalesce(auth.jwt()->>'email','')) LIMIT 1), auth.uid())
  END
$$;

CREATE OR REPLACE FUNCTION public.meu_desempenho_tecnico(p_mes text)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE tm record; r record; res jsonb; pos int; tot int; lider numeric; perf numeric;
BEGIN
  SELECT * INTO tm FROM team_members WHERE lower(email)=lower(coalesce(auth.jwt()->>'email','')) AND papel='tecnico' LIMIT 1;
  IF tm IS NULL OR tm.tecnico_nome IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO r FROM mech_month WHERE user_id=tm.owner_id AND mes=p_mes AND upper(nome)=upper(tm.tecnico_nome) LIMIT 1;
  WITH g AS (
    SELECT nome, (servicos+pecas)/NULLIF(meta_servicos+meta_pecas,0) p FROM mech_month
    WHERE user_id=tm.owner_id AND mes=p_mes AND grupo=coalesce(r.grupo,'outros') AND meta_servicos+meta_pecas>0
      AND upper(nome) NOT IN ('VINICIUS','DELMIR','LUIS SANDRO')
  ), rk AS (SELECT nome, p, rank() OVER (ORDER BY p DESC) rn FROM g)
  SELECT (SELECT rn FROM rk WHERE upper(nome)=upper(tm.tecnico_nome)), (SELECT count(*) FROM g), (SELECT max(p) FROM g)
  INTO pos, tot, lider;
  RETURN jsonb_build_object(
    'nome', tm.tecnico_nome, 'grupo', coalesce(r.grupo,'outros'),
    'servicos', coalesce(r.servicos,0), 'pecas', coalesce(r.pecas,0), 'passagens', coalesce(r.passagens,0),
    'meta_servicos', coalesce(r.meta_servicos,0), 'meta_pecas', coalesce(r.meta_pecas,0),
    'posicao', pos, 'participantes', tot, 'perf_lider', lider,
    'params', (SELECT to_jsonb(m) FROM (SELECT du_totais,du_decorridos,dc_totais,dc_decorridos,base FROM month_params WHERE user_id=tm.owner_id AND mes=p_mes LIMIT 1) m));
END $$;
REVOKE ALL ON FUNCTION public.meu_desempenho_tecnico(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.meu_desempenho_tecnico(text) TO authenticated;