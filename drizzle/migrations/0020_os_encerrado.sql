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
       AND NOT EXISTS (SELECT 1 FROM os_acompanhamento a WHERE a.user_id=o AND a.os_n=i->>'n' AND (coalesce((a.acoes->'__judicial'->>'feito')::boolean,false) OR coalesce((a.acoes->'__encerrado'->>'feito')::boolean,false)))),'[]'::jsonb),
    'acomp', coalesce((SELECT jsonb_agg(jsonb_build_object('os_n',a.os_n,'prev_manual',a.prev_manual)) FROM os_acompanhamento a WHERE a.user_id=o),'[]'::jsonb),
    'retornos', coalesce((SELECT jsonb_agg(jsonb_build_object('os_n',r.os_n,'data_ref',r.data_ref)) FROM os_retornos r WHERE r.user_id=o AND upper(r.consultor)=nm),'[]'::jsonb)
  );
END $$;