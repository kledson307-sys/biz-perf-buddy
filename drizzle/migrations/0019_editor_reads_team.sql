CREATE OR REPLACE FUNCTION public.sou_editor_de(p_owner uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.team_members WHERE owner_id = p_owner AND papel = 'editor'
    AND lower(email) = lower(coalesce(auth.jwt()->>'email','')))
$$;
CREATE POLICY "editor reads team" ON public.team_members FOR SELECT TO authenticated USING (public.sou_editor_de(owner_id));