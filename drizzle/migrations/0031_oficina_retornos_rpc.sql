CREATE OR REPLACE FUNCTION public.oficina_retornos(p_mes text)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE tm record;
BEGIN
  SELECT * INTO tm FROM _membro(ARRAY['chefe_oficina','controlador']);
  IF tm.id IS NULL THEN RETURN '[]'::jsonb; END IF;
  RETURN coalesce((SELECT retornos FROM oficina_mes WHERE user_id=tm.owner_id AND mes=p_mes LIMIT 1),'[]'::jsonb);
END $$;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.oficina_retornos(text) FROM PUBLIC, anon;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.oficina_retornos(text) TO authenticated;
