CREATE OR REPLACE FUNCTION public.data_owner() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.team_members WHERE lower(email)=lower(coalesce(auth.jwt()->>'email','')) AND papel IN ('vendedor','tecnico','chefe_oficina','controlador','tunap','acessorios','estetica','pecas')) THEN NULL
    ELSE coalesce((SELECT owner_id FROM public.team_members WHERE lower(email) = lower(coalesce(auth.jwt()->>'email','')) LIMIT 1), auth.uid())
  END
$$;
CREATE OR REPLACE FUNCTION public.pecas_owner() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT owner_id FROM public.team_members WHERE lower(email)=lower(coalesce(auth.jwt()->>'email','')) AND papel = 'pecas' LIMIT 1
$$;
REVOKE EXECUTE ON FUNCTION public.pecas_owner() FROM anon;
ALTER TABLE public.os_acompanhamento ALTER COLUMN user_id SET DEFAULT coalesce(data_owner(), oficina_owner(), pecas_owner());
CREATE POLICY "pecas read" ON public.os_imports FOR SELECT TO authenticated USING (user_id = pecas_owner());
CREATE POLICY "pecas read" ON public.os_acompanhamento FOR SELECT TO authenticated USING (user_id = pecas_owner() AND os_n NOT LIKE 'nps:%');
CREATE POLICY "pecas insert" ON public.os_acompanhamento FOR INSERT TO authenticated WITH CHECK (user_id = pecas_owner() AND os_n NOT LIKE 'nps:%');
CREATE POLICY "pecas update" ON public.os_acompanhamento FOR UPDATE TO authenticated USING (user_id = pecas_owner() AND os_n NOT LIKE 'nps:%') WITH CHECK (user_id = pecas_owner() AND os_n NOT LIKE 'nps:%');