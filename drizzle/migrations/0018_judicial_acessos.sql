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
    'itens', coalesce((SELECT jsonb_agg(i) FROM jsonb_array_elements(snap.itens) i WHERE upper(trim(i->>'cons'))=nm
       AND NOT EXISTS (SELECT 1 FROM os_acompanhamento a WHERE a.user_id=o AND a.os_n=i->>'n' AND coalesce((a.acoes->'__judicial'->>'feito')::boolean,false))),'[]'::jsonb),
    'acomp', coalesce((SELECT jsonb_agg(jsonb_build_object('os_n',a.os_n,'prev_manual',a.prev_manual)) FROM os_acompanhamento a WHERE a.user_id=o),'[]'::jsonb),
    'retornos', coalesce((SELECT jsonb_agg(jsonb_build_object('os_n',r.os_n,'data_ref',r.data_ref)) FROM os_retornos r WHERE r.user_id=o AND upper(r.consultor)=nm),'[]'::jsonb)
  );
END $$;

CREATE TABLE IF NOT EXISTS public.access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text NOT NULL,
  dia date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Bahia')::date,
  primeiro_at timestamptz NOT NULL DEFAULT now(),
  ultimo_at timestamptz NOT NULL DEFAULT now(),
  vezes integer NOT NULL DEFAULT 1,
  UNIQUE (user_id, email, dia)
);
GRANT SELECT ON public.access_log TO authenticated;
GRANT ALL ON public.access_log TO service_role;
ALTER TABLE public.access_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team read" ON public.access_log FOR SELECT TO authenticated USING (user_id = public.data_owner());

CREATE OR REPLACE FUNCTION public.registrar_acesso()
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE e text := lower(coalesce(auth.jwt()->>'email','')); o uuid;
BEGIN
  IF e = '' THEN RETURN; END IF;
  SELECT owner_id INTO o FROM team_members WHERE lower(email)=e LIMIT 1;
  o := coalesce(o, auth.uid());
  INSERT INTO access_log(user_id, email) VALUES (o, e)
  ON CONFLICT (user_id, email, dia) DO UPDATE SET ultimo_at=now(),
    vezes = access_log.vezes + CASE WHEN now() - access_log.ultimo_at > interval '30 minutes' THEN 1 ELSE 0 END;
END $$;
REVOKE ALL ON FUNCTION public.registrar_acesso() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.registrar_acesso() TO authenticated;