CREATE OR REPLACE FUNCTION public.registrar_acesso()
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE e text := lower(coalesce(nullif(auth.jwt()->>'email',''), (SELECT email FROM auth.users WHERE id = auth.uid()), '')); o uuid;
BEGIN
  IF e = '' OR auth.uid() IS NULL THEN RETURN; END IF;
  SELECT owner_id INTO o FROM team_members WHERE lower(email)=e LIMIT 1;
  o := coalesce(o, auth.uid());
  INSERT INTO access_log(user_id, email) VALUES (o, e)
  ON CONFLICT (user_id, email, dia) DO UPDATE SET ultimo_at=now(),
    vezes = access_log.vezes + CASE WHEN now() - access_log.ultimo_at > interval '30 minutes' THEN 1 ELSE 0 END;
END $function$;

CREATE OR REPLACE FUNCTION public.tecnicos_carro(p_mes text)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE tm record;
BEGIN
  SELECT * INTO tm FROM team_members WHERE lower(email)=lower(coalesce(nullif(auth.jwt()->>'email',''),(SELECT email FROM auth.users WHERE id=auth.uid()))) AND papel='chefe_oficina' LIMIT 1;
  IF tm IS NULL THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'tecnicos', coalesce((SELECT jsonb_agg(jsonb_build_object('nome',nome,'servicos',servicos,'pecas',pecas,'passagens',passagens,'meta_servicos',meta_servicos,'meta_pecas',meta_pecas) ORDER BY nome) FROM mech_month WHERE user_id=tm.owner_id AND mes=p_mes AND grupo='carro'),'[]'::jsonb),
    'params', (SELECT to_jsonb(m) FROM (SELECT du_totais,du_decorridos,dc_totais,dc_decorridos,base FROM month_params WHERE user_id=tm.owner_id AND mes=p_mes LIMIT 1) m));
END $function$;
REVOKE EXECUTE ON FUNCTION public.tecnicos_carro(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.tecnicos_carro(text) TO authenticated;