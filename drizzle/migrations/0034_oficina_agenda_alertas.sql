CREATE OR REPLACE FUNCTION public.oficina_agenda_alertas()
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE tm record; d date;
BEGIN
  SELECT * INTO tm FROM _membro(ARRAY['chefe_oficina','controlador']);
  IF tm.id IS NULL THEN RETURN NULL; END IF;
  SELECT min(data) INTO d FROM agendamentos WHERE user_id=tm.owner_id AND tipo='d1' AND data >= (now() AT TIME ZONE 'America/Bahia')::date;
  IF d IS NULL THEN RETURN jsonb_build_object('data',null,'itens','[]'::jsonb); END IF;
  RETURN jsonb_build_object('data', d, 'itens', coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id',a.id,'hora',a.hora,'cliente',a.cliente,'placa',a.placa,'categoria',a.categoria,'segmento',a.segmento,'consultor',a.consultor,
      'aceito', f.aceito_em IS NOT NULL, 'confirmacao', f.confirmacao) ORDER BY a.hora)
    FROM agendamentos a LEFT JOIN agendamento_followups f ON f.agendamento_id=a.id
    WHERE a.user_id=tm.owner_id AND a.tipo='d1' AND a.data=d AND (tm.papel='controlador' OR a.segmento='carro')),'[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.oficina_agenda_alertas() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.oficina_agenda_alertas() TO authenticated;