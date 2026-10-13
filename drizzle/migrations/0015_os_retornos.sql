CREATE TABLE public.os_retornos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT public.data_owner(),
  os_n text NOT NULL,
  consultor text NOT NULL DEFAULT '',
  data_ref date NOT NULL,
  nota text NOT NULL DEFAULT '',
  feito_por text NOT NULL DEFAULT '',
  feito_at timestamptz NOT NULL DEFAULT now(),
  visto boolean NOT NULL DEFAULT false,
  UNIQUE (user_id, os_n, data_ref)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.os_retornos TO authenticated;
GRANT ALL ON public.os_retornos TO service_role;
ALTER TABLE public.os_retornos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team read" ON public.os_retornos FOR SELECT TO authenticated USING (user_id = public.data_owner());
CREATE POLICY "team insert" ON public.os_retornos FOR INSERT TO authenticated WITH CHECK (user_id = public.data_owner() AND public.can_edit());
CREATE POLICY "team update" ON public.os_retornos FOR UPDATE TO authenticated USING (user_id = public.data_owner()) WITH CHECK (user_id = public.data_owner());
CREATE POLICY "team delete" ON public.os_retornos FOR DELETE TO authenticated USING (user_id = public.data_owner() AND public.can_edit());

CREATE OR REPLACE FUNCTION public.minhas_os()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE o uuid; c uuid; nm text; snap record;
BEGIN
  SELECT owner_id, consultant_id INTO o, c FROM team_members
   WHERE lower(email)=lower(coalesce(auth.jwt()->>'email','')) AND papel='vendedor' LIMIT 1;
  IF o IS NULL THEN RETURN NULL; END IF;
  SELECT upper(trim(nome)) INTO nm FROM consultants WHERE id=c;
  SELECT at, itens INTO snap FROM os_imports WHERE user_id=o ORDER BY at DESC LIMIT 1;
  IF snap IS NULL THEN RETURN jsonb_build_object('itens','[]'::jsonb,'acomp','[]'::jsonb,'retornos','[]'::jsonb); END IF;
  RETURN jsonb_build_object(
    'at', snap.at,
    'itens', coalesce((SELECT jsonb_agg(i) FROM jsonb_array_elements(snap.itens) i WHERE upper(trim(i->>'cons'))=nm),'[]'::jsonb),
    'acomp', coalesce((SELECT jsonb_agg(jsonb_build_object('os_n',a.os_n,'prev_manual',a.prev_manual)) FROM os_acompanhamento a WHERE a.user_id=o),'[]'::jsonb),
    'retornos', coalesce((SELECT jsonb_agg(jsonb_build_object('os_n',r.os_n,'data_ref',r.data_ref)) FROM os_retornos r WHERE r.user_id=o AND upper(r.consultor)=nm),'[]'::jsonb)
  );
END $$;

CREATE OR REPLACE FUNCTION public.registrar_retorno(p_os text, p_data date, p_nota text)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE o uuid; c uuid; nm text;
BEGIN
  SELECT owner_id, consultant_id INTO o, c FROM team_members
   WHERE lower(email)=lower(coalesce(auth.jwt()->>'email','')) AND papel='vendedor' LIMIT 1;
  IF o IS NULL THEN RAISE EXCEPTION 'sem acesso'; END IF;
  SELECT upper(trim(nome)) INTO nm FROM consultants WHERE id=c;
  IF NOT EXISTS (SELECT 1 FROM os_imports s, jsonb_array_elements(s.itens) i
     WHERE s.id=(SELECT id FROM os_imports WHERE user_id=o ORDER BY at DESC LIMIT 1)
       AND i->>'n'=p_os AND upper(trim(i->>'cons'))=nm) THEN
    RAISE EXCEPTION 'O.S. não pertence ao vendedor';
  END IF;
  INSERT INTO os_retornos(user_id, os_n, consultor, data_ref, nota, feito_por)
  VALUES (o, p_os, nm, p_data, left(coalesce(p_nota,''),1000), coalesce(auth.jwt()->>'email',''))
  ON CONFLICT (user_id, os_n, data_ref) DO UPDATE SET nota=excluded.nota, feito_por=excluded.feito_por, feito_at=now(), visto=false;
END $$;
REVOKE ALL ON FUNCTION public.minhas_os() FROM public, anon;
REVOKE ALL ON FUNCTION public.registrar_retorno(text,date,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.minhas_os() TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_retorno(text,date,text) TO authenticated;