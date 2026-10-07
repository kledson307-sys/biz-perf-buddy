CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  email text NOT NULL,
  papel text NOT NULL DEFAULT 'viewer' CHECK (papel IN ('viewer','editor')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (email)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_members TO authenticated;
GRANT ALL ON public.team_members TO service_role;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages" ON public.team_members FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid() AND lower(email) <> lower(coalesce(auth.jwt()->>'email','')));
CREATE POLICY "member sees own" ON public.team_members FOR SELECT TO authenticated
  USING (lower(email) = lower(coalesce(auth.jwt()->>'email','')));

CREATE OR REPLACE FUNCTION public.data_owner() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT owner_id FROM public.team_members WHERE lower(email) = lower(coalesce(auth.jwt()->>'email','')) LIMIT 1), auth.uid())
$$;
CREATE OR REPLACE FUNCTION public.can_edit() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND coalesce((SELECT papel = 'editor' FROM public.team_members WHERE lower(email) = lower(coalesce(auth.jwt()->>'email','')) LIMIT 1), true)
$$;
REVOKE ALL ON FUNCTION public.data_owner() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_edit() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.data_owner() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_edit() TO authenticated, service_role;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['agg_codes','agg_goals','agg_sales','agg_visits','consultants','daily_sales','departments','goals','month_params','update_log'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "own rows" ON public.%I', t);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN user_id SET DEFAULT public.data_owner()', t);
    EXECUTE format('CREATE POLICY "team read" ON public.%I FOR SELECT TO authenticated USING (user_id = public.data_owner())', t);
    EXECUTE format('CREATE POLICY "team insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (user_id = public.data_owner() AND public.can_edit())', t);
    EXECUTE format('CREATE POLICY "team update" ON public.%I FOR UPDATE TO authenticated USING (user_id = public.data_owner() AND public.can_edit()) WITH CHECK (user_id = public.data_owner() AND public.can_edit())', t);
    EXECUTE format('CREATE POLICY "team delete" ON public.%I FOR DELETE TO authenticated USING (user_id = public.data_owner() AND public.can_edit())', t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.import_sales_period(p_ini date, p_fim date, p_rows jsonb) RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE n integer; o uuid := public.data_owner();
BEGIN
 IF auth.uid() IS NULL OR NOT public.can_edit() THEN RAISE EXCEPTION 'Não autorizado'; END IF;
 IF p_ini IS NULL OR p_fim IS NULL OR p_ini > p_fim OR date_trunc('month', p_ini) <> date_trunc('month', p_fim) THEN RAISE EXCEPTION 'Período inválido'; END IF;
 IF jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) = 0 THEN RAISE EXCEPTION 'Sem vendas'; END IF;
 IF EXISTS (SELECT 1 FROM jsonb_to_recordset(p_rows) AS r(consultant_id uuid, servicos numeric, pecas numeric) LEFT JOIN public.consultants c ON c.id=r.consultant_id AND c.user_id=o WHERE c.id IS NULL OR r.servicos IS NULL OR r.pecas IS NULL) THEN RAISE EXCEPTION 'Consultor ou valores inválidos'; END IF;
 DELETE FROM public.daily_sales WHERE user_id=o AND dia BETWEEN p_ini AND p_fim AND consultant_id IN (SELECT r.consultant_id FROM jsonb_to_recordset(p_rows) AS r(consultant_id uuid));
 INSERT INTO public.daily_sales(consultant_id,dia,servicos,pecas,user_id) SELECT r.consultant_id,p_fim,r.servicos,r.pecas,o FROM jsonb_to_recordset(p_rows) AS r(consultant_id uuid,servicos numeric,pecas numeric);
 GET DIAGNOSTICS n = ROW_COUNT;
 RETURN n;
END; $$;