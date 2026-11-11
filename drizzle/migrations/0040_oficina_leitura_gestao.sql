CREATE OR REPLACE FUNCTION public.oficina_owner()
 RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT owner_id FROM public.team_members
  WHERE lower(email)=lower(coalesce(auth.jwt()->>'email','')) AND papel IN ('chefe_oficina','controlador') LIMIT 1
$$;
REVOKE EXECUTE ON FUNCTION public.oficina_owner() FROM anon;
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['agg_sales','agg_goals','agg_visits','agg_codes','cons_mix','consultants','departments','mech_month','month_params','os_imports','os_acompanhamento','os_retornos','agendamentos','agendamento_followups','agenda_metas','nps_imports','oficina_mes','update_log','month_locks'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "oficina read" ON public.%I', t);
    EXECUTE format('CREATE POLICY "oficina read" ON public.%I FOR SELECT TO authenticated USING (user_id = public.oficina_owner())', t);
  END LOOP;
END $$;