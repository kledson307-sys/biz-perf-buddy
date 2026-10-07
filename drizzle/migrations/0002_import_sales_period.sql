CREATE OR REPLACE FUNCTION public.import_sales_period(p_ini date, p_fim date, p_rows jsonb) RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE n integer;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autorizado'; END IF;
 IF p_ini IS NULL OR p_fim IS NULL OR p_ini > p_fim OR date_trunc('month', p_ini) <> date_trunc('month', p_fim) THEN RAISE EXCEPTION 'Período inválido'; END IF;
 IF jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) = 0 THEN RAISE EXCEPTION 'Sem vendas'; END IF;
 IF EXISTS (SELECT 1 FROM jsonb_to_recordset(p_rows) AS r(consultant_id uuid, servicos numeric, pecas numeric) LEFT JOIN public.consultants c ON c.id=r.consultant_id AND c.user_id=auth.uid() WHERE c.id IS NULL OR r.servicos IS NULL OR r.pecas IS NULL) THEN RAISE EXCEPTION 'Consultor ou valores inválidos'; END IF;
 DELETE FROM public.daily_sales WHERE user_id=auth.uid() AND dia BETWEEN p_ini AND p_fim AND consultant_id IN (SELECT r.consultant_id FROM jsonb_to_recordset(p_rows) AS r(consultant_id uuid));
 INSERT INTO public.daily_sales(consultant_id,dia,servicos,pecas,user_id) SELECT r.consultant_id,p_fim,r.servicos,r.pecas,auth.uid() FROM jsonb_to_recordset(p_rows) AS r(consultant_id uuid,servicos numeric,pecas numeric);
 GET DIAGNOSTICS n = ROW_COUNT;
 RETURN n;
END; $$;
REVOKE ALL ON FUNCTION public.import_sales_period(date,date,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_sales_period(date,date,jsonb) TO authenticated, service_role;