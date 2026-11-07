ALTER TABLE public.team_members DROP CONSTRAINT team_members_papel_check;
ALTER TABLE public.team_members ADD CONSTRAINT team_members_papel_check CHECK (papel = ANY (ARRAY['viewer','editor','vendedor','tecnico','chefe_oficina','controlador','tunap','acessorios','estetica']));

CREATE OR REPLACE FUNCTION public.data_owner()
 RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.team_members WHERE lower(email)=lower(coalesce(auth.jwt()->>'email','')) AND papel IN ('vendedor','tecnico','chefe_oficina','controlador','tunap','acessorios','estetica')) THEN NULL
    ELSE coalesce((SELECT owner_id FROM public.team_members WHERE lower(email) = lower(coalesce(auth.jwt()->>'email','')) LIMIT 1), auth.uid())
  END
$$;

CREATE OR REPLACE FUNCTION public.dep_owner()
 RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT owner_id FROM public.team_members WHERE lower(email)=lower(coalesce(auth.jwt()->>'email','')) AND papel IN ('acessorios','estetica') LIMIT 1 $$;

CREATE OR REPLACE FUNCTION public.meu_dep()
 RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT upper(papel) FROM public.team_members WHERE lower(email)=lower(coalesce(auth.jwt()->>'email','')) AND papel IN ('acessorios','estetica') LIMIT 1 $$;

ALTER TABLE public.vendas_complementares ALTER COLUMN user_id SET DEFAULT coalesce(public.data_owner(), public.dep_owner());
ALTER TABLE public.vendedores_showroom ALTER COLUMN user_id SET DEFAULT coalesce(public.data_owner(), public.dep_owner());
ALTER TABLE public.rvd_volumes_mes ALTER COLUMN user_id SET DEFAULT coalesce(public.data_owner(), public.dep_owner());

CREATE POLICY "dep all" ON public.vendas_complementares FOR ALL TO authenticated
  USING (user_id = public.dep_owner() AND departamento = public.meu_dep())
  WITH CHECK (user_id = public.dep_owner() AND departamento = public.meu_dep());
CREATE POLICY "dep all" ON public.vendedores_showroom FOR ALL TO authenticated
  USING (user_id = public.dep_owner()) WITH CHECK (user_id = public.dep_owner());
CREATE POLICY "dep all" ON public.rvd_volumes_mes FOR ALL TO authenticated
  USING (user_id = public.dep_owner()) WITH CHECK (user_id = public.dep_owner());

-- Faturamento oficial (DMS) e O.S. para conciliação, sem expor outras tabelas às vendedoras.
CREATE OR REPLACE FUNCTION public.dep_painel(p_mes text)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE o uuid := coalesce(public.data_owner(), public.dep_owner()); ini date := (p_mes||'-01')::date; fim date := ((p_mes||'-01')::date + interval '1 month')::date;
BEGIN
  IF auth.uid() IS NULL OR o IS NULL THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'dms', (SELECT coalesce(jsonb_object_agg(k, v), '{}'::jsonb) FROM (
      SELECT dep k, jsonb_build_object(
        'fat', coalesce((SELECT sum(s.servicos+s.pecas) FROM daily_sales s JOIN consultants c ON c.id=s.consultant_id JOIN departments d ON d.id=c.department_id WHERE s.user_id=o AND upper(translate(d.nome,'ÁÉÍÓÚÂÊÔÃÕÇ','AEIOUAEOAOC')) LIKE '%'||dep||'%' AND s.dia>=ini AND s.dia<fim),0),
        'margem', coalesce((SELECT sum(s.margem_pecas) FROM daily_sales s JOIN consultants c ON c.id=s.consultant_id JOIN departments d ON d.id=c.department_id WHERE s.user_id=o AND upper(translate(d.nome,'ÁÉÍÓÚÂÊÔÃÕÇ','AEIOUAEOAOC')) LIKE '%'||dep||'%' AND s.dia>=ini AND s.dia<fim),0),
        'meta', coalesce((SELECT sum(g.servicos+g.pecas) FROM goals g JOIN consultants c ON c.id=g.consultant_id JOIN departments d ON d.id=c.department_id WHERE g.user_id=o AND upper(translate(d.nome,'ÁÉÍÓÚÂÊÔÃÕÇ','AEIOUAEOAOC')) LIKE '%'||dep||'%' AND g.mes=p_mes),0)) v
      FROM unnest(ARRAY['ACESSORIOS','ESTETICA']) dep WHERE public.meu_dep() IS NULL OR dep = public.meu_dep()) x),
    'abertas', coalesce((SELECT jsonb_agg(i->>'n') FROM jsonb_array_elements((SELECT itens FROM os_imports WHERE user_id=o ORDER BY at DESC LIMIT 1)) i),'[]'::jsonb),
    'faturadas', coalesce((SELECT jsonb_agg(os_n) FROM os_acompanhamento WHERE user_id=o AND coalesce((acoes->'__encerrado'->>'feito')::boolean,false)),'[]'::jsonb),
    'params', (SELECT to_jsonb(m) FROM (SELECT du_totais,du_decorridos,dc_totais,dc_decorridos,base FROM month_params WHERE user_id=o AND mes=p_mes LIMIT 1) m));
END $$;
GRANT EXECUTE ON FUNCTION public.dep_painel(text) TO authenticated;