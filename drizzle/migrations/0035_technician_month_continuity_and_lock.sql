CREATE OR REPLACE FUNCTION public.inicializar_tecnicos_mes(p_mes text)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE o uuid := public.data_owner(); n integer := 0; anterior text;
BEGIN
 IF auth.uid() IS NULL OR o IS NULL OR NOT public.can_edit() THEN RETURN 0; END IF;
 IF p_mes IS NULL OR p_mes !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' THEN RAISE EXCEPTION 'Mês inválido'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(o::text || ':tecnicos:' || p_mes, 0));
 IF EXISTS (SELECT 1 FROM public.month_locks WHERE user_id=o AND mes=p_mes) THEN RETURN 0; END IF;
 IF EXISTS (SELECT 1 FROM public.mech_month WHERE user_id=o AND mes=p_mes) THEN RETURN 0; END IF;
 anterior := to_char((p_mes || '-01')::date - interval '1 month','YYYY-MM');
 INSERT INTO public.mech_month(user_id,mes,nome,grupo,meta_servicos,meta_pecas,servicos,pecas,passagens,composicao)
 SELECT o,p_mes,nome,grupo,meta_servicos,meta_pecas,0,0,0,'{}'::jsonb FROM public.mech_month WHERE user_id=o AND mes=anterior
 ON CONFLICT (user_id,mes,nome) DO NOTHING;
 GET DIAGNOSTICS n = ROW_COUNT; RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.inicializar_tecnicos_mes(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inicializar_tecnicos_mes(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.copiar_metas_tecnicos(p_mes text)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE o uuid := public.data_owner(); n integer; anterior text;
BEGIN
 IF auth.uid() IS NULL OR o IS NULL OR NOT public.can_edit() THEN RAISE EXCEPTION 'Não autorizado'; END IF;
 IF p_mes IS NULL OR p_mes !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' THEN RAISE EXCEPTION 'Mês inválido'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(o::text || ':tecnicos:' || p_mes, 0));
 IF EXISTS (SELECT 1 FROM public.month_locks WHERE user_id=o AND mes=p_mes) THEN RAISE EXCEPTION 'Mês fechado'; END IF;
 anterior := to_char((p_mes || '-01')::date - interval '1 month','YYYY-MM');
 UPDATE public.mech_month atual SET meta_servicos=ant.meta_servicos,meta_pecas=ant.meta_pecas,updated_at=now()
 FROM public.mech_month ant WHERE atual.user_id=o AND atual.mes=p_mes AND ant.user_id=o AND ant.mes=anterior AND atual.nome=ant.nome;
 GET DIAGNOSTICS n = ROW_COUNT; RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.copiar_metas_tecnicos(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.copiar_metas_tecnicos(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.proteger_mes_tecnicos()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
 IF auth.uid() IS NOT NULL THEN
 IF TG_OP <> 'INSERT' AND EXISTS (SELECT 1 FROM public.month_locks WHERE user_id=OLD.user_id AND mes=OLD.mes) THEN RAISE EXCEPTION 'Mês fechado: alterações de técnicos bloqueadas'; END IF;
 IF TG_OP <> 'DELETE' AND EXISTS (SELECT 1 FROM public.month_locks WHERE user_id=NEW.user_id AND mes=NEW.mes) THEN RAISE EXCEPTION 'Mês fechado: alterações de técnicos bloqueadas'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER proteger_mes_tecnicos BEFORE INSERT OR UPDATE OR DELETE ON public.mech_month FOR EACH ROW EXECUTE FUNCTION public.proteger_mes_tecnicos();
REVOKE ALL ON FUNCTION public.proteger_mes_tecnicos() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.proteger_mes_tecnicos() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.sou_editor_de(uuid), public.minha_performance(text), public.meu_nps() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sou_editor_de(uuid), public.minha_performance(text), public.meu_nps() TO authenticated, service_role;