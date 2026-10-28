CREATE TABLE public.nps_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT public.data_owner(),
  at timestamptz NOT NULL DEFAULT now(),
  nome text NOT NULL DEFAULT '',
  arquivo text NOT NULL DEFAULT '',
  itens jsonb NOT NULL DEFAULT '[]'::jsonb
);
GRANT SELECT, INSERT, DELETE ON public.nps_imports TO authenticated;
GRANT ALL ON public.nps_imports TO service_role;
ALTER TABLE public.nps_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team read" ON public.nps_imports FOR SELECT TO authenticated USING (user_id = public.data_owner());
CREATE POLICY "team insert" ON public.nps_imports FOR INSERT TO authenticated WITH CHECK (user_id = public.data_owner() AND public.can_edit());
CREATE POLICY "team delete" ON public.nps_imports FOR DELETE TO authenticated USING (user_id = public.data_owner() AND public.can_edit());

-- Leitura restrita de NPS para vendedor (só os seus) e chefe de oficina (somente Carro).
CREATE OR REPLACE FUNCTION public.meu_nps()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE tm record; nome_c text; itens jsonb;
BEGIN
  SELECT * INTO tm FROM team_members WHERE lower(email)=lower(coalesce(nullif(auth.jwt()->>'email',''),(SELECT email FROM auth.users WHERE id=auth.uid()))) AND papel IN ('vendedor','chefe_oficina') LIMIT 1;
  IF tm IS NULL THEN RETURN NULL; END IF;
  SELECT n.itens INTO itens FROM nps_imports n WHERE n.user_id=tm.owner_id ORDER BY n.at DESC LIMIT 1;
  IF itens IS NULL THEN RETURN jsonb_build_object('papel',tm.papel,'itens','[]'::jsonb); END IF;
  IF tm.papel='vendedor' THEN
    SELECT upper(trim(nome)) INTO nome_c FROM consultants WHERE id=tm.consultant_id;
    RETURN jsonb_build_object('papel',tm.papel,'itens',coalesce((SELECT jsonb_agg(e) FROM jsonb_array_elements(itens) e WHERE upper(trim(e->>'consultor'))=nome_c),'[]'::jsonb));
  END IF;
  RETURN jsonb_build_object('papel',tm.papel,'itens',coalesce((SELECT jsonb_agg(e) FROM jsonb_array_elements(itens) e WHERE e->>'loja_padrao'='1' AND e->>'segmento'='carro'),'[]'::jsonb));
END $$;
GRANT EXECUTE ON FUNCTION public.meu_nps() TO authenticated;