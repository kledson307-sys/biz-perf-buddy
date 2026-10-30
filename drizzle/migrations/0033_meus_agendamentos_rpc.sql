CREATE OR REPLACE FUNCTION public.meus_agendamentos(p_mes text)
RETURNS SETOF public.agendamentos
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT a.* FROM public.agendamentos a
  WHERE a.data >= to_date(p_mes || '-01','YYYY-MM-DD')
    AND a.data < (to_date(p_mes || '-01','YYYY-MM-DD') + interval '1 month')::date
    AND upper(trim(a.consultor)) = (
      SELECT upper(trim(c.nome)) FROM public.team_members tm
      JOIN public.consultants c ON c.id = tm.consultant_id
      WHERE lower(tm.email) = lower(coalesce(auth.jwt()->>'email','')) AND tm.papel = 'vendedor'
      LIMIT 1)
  ORDER BY a.data, a.hora;
$$;
REVOKE ALL ON FUNCTION public.meus_agendamentos(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.meus_agendamentos(text) TO authenticated;