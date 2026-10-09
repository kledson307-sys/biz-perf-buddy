ALTER TABLE public.daily_sales ADD COLUMN IF NOT EXISTS margem_pecas numeric NOT NULL DEFAULT 0;
CREATE OR REPLACE FUNCTION public.import_sales_period(p_ini date, p_fim date, p_rows jsonb)
 RETURNS integer LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE n integer; o uuid := public.data_owner();
BEGIN
 IF auth.uid() IS NULL OR NOT public.can_edit() THEN RAISE EXCEPTION 'Não autorizado'; END IF;
 IF p_ini IS NULL OR p_fim IS NULL OR p_ini > p_fim OR date_trunc('month', p_ini) <> date_trunc('month', p_fim) THEN RAISE EXCEPTION 'Período inválido'; END IF;
 IF jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) = 0 THEN RAISE EXCEPTION 'Sem vendas'; END IF;
 IF EXISTS (SELECT 1 FROM jsonb_to_recordset(p_rows) AS r(consultant_id uuid, servicos numeric, pecas numeric) LEFT JOIN public.consultants c ON c.id=r.consultant_id AND c.user_id=o WHERE c.id IS NULL OR r.servicos IS NULL OR r.pecas IS NULL) THEN RAISE EXCEPTION 'Consultor ou valores inválidos'; END IF;
 DELETE FROM public.daily_sales WHERE user_id=o AND dia BETWEEN p_ini AND p_fim AND consultant_id IN (SELECT r.consultant_id FROM jsonb_to_recordset(p_rows) AS r(consultant_id uuid));
 INSERT INTO public.daily_sales(consultant_id,dia,servicos,pecas,margem_pecas,user_id) SELECT r.consultant_id,p_fim,r.servicos,r.pecas,COALESCE(r.margem_pecas,0),o FROM jsonb_to_recordset(p_rows) AS r(consultant_id uuid,servicos numeric,pecas numeric,margem_pecas numeric);
 GET DIAGNOSTICS n = ROW_COUNT;
 RETURN n;
END; $function$;