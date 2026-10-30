
ALTER TABLE public.team_members DROP CONSTRAINT team_members_papel_check;
ALTER TABLE public.team_members ADD CONSTRAINT team_members_papel_check CHECK (papel = ANY (ARRAY['viewer','editor','vendedor','tecnico','chefe_oficina','controlador','tunap']));

CREATE OR REPLACE FUNCTION public.data_owner()
 RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.team_members WHERE lower(email)=lower(coalesce(auth.jwt()->>'email','')) AND papel IN ('vendedor','tecnico','chefe_oficina','controlador','tunap')) THEN NULL
    ELSE coalesce((SELECT owner_id FROM public.team_members WHERE lower(email) = lower(coalesce(auth.jwt()->>'email','')) LIMIT 1), auth.uid())
  END
$$;

CREATE OR REPLACE FUNCTION public._membro(p_papeis text[])
 RETURNS public.team_members LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT * FROM team_members WHERE lower(email)=lower(coalesce(nullif(auth.jwt()->>'email',''),(SELECT email FROM auth.users WHERE id=auth.uid()))) AND papel = ANY(p_papeis) LIMIT 1
$$;
REVOKE EXECUTE ON FUNCTION public._membro(text[]) FROM anon;

CREATE OR REPLACE FUNCTION public.tecnicos_carro(p_mes text)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE tm record;
BEGIN
  SELECT * INTO tm FROM _membro(ARRAY['chefe_oficina','controlador']);
  IF tm.id IS NULL THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'tecnicos', coalesce((SELECT jsonb_agg(jsonb_build_object('nome',nome,'servicos',servicos,'pecas',pecas,'passagens',passagens,'meta_servicos',meta_servicos,'meta_pecas',meta_pecas,'composicao',composicao) ORDER BY nome) FROM mech_month WHERE user_id=tm.owner_id AND mes=p_mes AND grupo='carro'),'[]'::jsonb),
    'params', (SELECT to_jsonb(m) FROM (SELECT du_totais,du_decorridos,dc_totais,dc_decorridos,base FROM month_params WHERE user_id=tm.owner_id AND mes=p_mes LIMIT 1) m));
END $$;

CREATE OR REPLACE FUNCTION public.meu_nps()
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE tm record; nome_c text; itens jsonb;
BEGIN
  SELECT * INTO tm FROM _membro(ARRAY['vendedor','chefe_oficina','controlador']);
  IF tm.id IS NULL THEN RETURN NULL; END IF;
  SELECT n.itens INTO itens FROM nps_imports n WHERE n.user_id=tm.owner_id ORDER BY n.at DESC LIMIT 1;
  IF itens IS NULL THEN RETURN jsonb_build_object('papel',tm.papel,'itens','[]'::jsonb); END IF;
  IF tm.papel='vendedor' THEN
    SELECT upper(trim(nome)) INTO nome_c FROM consultants WHERE id=tm.consultant_id;
    RETURN jsonb_build_object('papel',tm.papel,'itens',coalesce((SELECT jsonb_agg(e) FROM jsonb_array_elements(itens) e WHERE upper(trim(e->>'consultor'))=nome_c),'[]'::jsonb));
  END IF;
  RETURN jsonb_build_object('papel',tm.papel,'itens',coalesce((SELECT jsonb_agg(e) FROM jsonb_array_elements(itens) e WHERE e->>'loja_padrao'='1' AND e->>'segmento'='carro'),'[]'::jsonb));
END $$;

CREATE OR REPLACE FUNCTION public.painel_oficina(p_mes text)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE tm record; ini date := (p_mes||'-01')::date; snaps jsonb;
BEGIN
  SELECT * INTO tm FROM _membro(ARRAY['chefe_oficina','controlador']);
  IF tm.id IS NULL THEN RETURN NULL; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('at',at,'itens',itens) ORDER BY at DESC),'[]'::jsonb) INTO snaps
    FROM (SELECT at,itens FROM os_imports WHERE user_id=tm.owner_id ORDER BY at DESC LIMIT 2) s;
  RETURN jsonb_build_object(
    'papel', tm.papel,
    'vendas', (SELECT jsonb_build_object('servicos',coalesce(sum(s.servicos),0),'pecas',coalesce(sum(s.pecas),0))
       FROM daily_sales s JOIN consultants c ON c.id=s.consultant_id JOIN departments d ON d.id=c.department_id
       WHERE s.user_id=tm.owner_id AND d.nome='SG OFICINA' AND s.dia>=ini AND s.dia<(ini+interval '1 month')),
    'metas', (SELECT jsonb_build_object('servicos',coalesce(sum(g.servicos),0),'pecas',coalesce(sum(g.pecas),0))
       FROM goals g JOIN consultants c ON c.id=g.consultant_id JOIN departments d ON d.id=c.department_id
       WHERE g.user_id=tm.owner_id AND d.nome='SG OFICINA' AND g.mes=p_mes),
    'snapshots', snaps,
    'acomp', coalesce((SELECT jsonb_agg(jsonb_build_object('os_n',os_n,'prev',prev_manual,'judicial',acoes ? '__judicial')) FROM os_acompanhamento WHERE user_id=tm.owner_id),'[]'::jsonb));
END $$;
REVOKE EXECUTE ON FUNCTION public.painel_oficina(text) FROM anon;

CREATE OR REPLACE FUNCTION public.tunap_painel(p_mes text)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE tm record; ini date := (p_mes||'-01')::date; fim date := ((p_mes||'-01')::date + interval '1 month')::date;
BEGIN
  SELECT * INTO tm FROM _membro(ARRAY['tunap']);
  IF tm.id IS NULL THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'consultores', coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'nome',c.nome,'dep',d.nome)) FROM consultants c LEFT JOIN departments d ON d.id=c.department_id WHERE c.user_id=tm.owner_id),'[]'::jsonb),
    'vendas', coalesce((SELECT jsonb_agg(jsonb_build_object('c',consultant_id,'codigo',codigo,'qtd',qtd,'valor',valor)) FROM agg_sales WHERE user_id=tm.owner_id AND item='tunap' AND dia>=ini AND dia<fim),'[]'::jsonb),
    'metas', coalesce((SELECT jsonb_agg(jsonb_build_object('c',consultant_id,'qtd',meta_qtd,'valor',meta_valor)) FROM agg_goals WHERE user_id=tm.owner_id AND item='tunap' AND mes=p_mes),'[]'::jsonb),
    'mix', coalesce((SELECT jsonb_agg(jsonb_build_object('nome',nome,'composicao',composicao)) FROM cons_mix WHERE user_id=tm.owner_id AND mes=p_mes),'[]'::jsonb),
    'passagens', coalesce((SELECT jsonb_agg(jsonb_build_object('c',consultant_id,'p',t)) FROM (SELECT consultant_id, sum(passagens) t FROM agg_visits WHERE user_id=tm.owner_id AND dia>=ini AND dia<fim GROUP BY 1) v),'[]'::jsonb),
    'params', (SELECT to_jsonb(m) FROM (SELECT du_totais,du_decorridos,dc_totais,dc_decorridos,base FROM month_params WHERE user_id=tm.owner_id AND mes=p_mes LIMIT 1) m));
END $$;
REVOKE EXECUTE ON FUNCTION public.tunap_painel(text) FROM anon;

INSERT INTO public.team_members (owner_id, email, papel)
SELECT '0826f11e-c716-485f-b660-9ca1d0c63f8f', e, p FROM (VALUES ('marcos@hausmotors.com.br','controlador'),('tunap@tunap.com.br','tunap')) v(e,p)
WHERE NOT EXISTS (SELECT 1 FROM public.team_members t WHERE lower(t.email)=v.e);
