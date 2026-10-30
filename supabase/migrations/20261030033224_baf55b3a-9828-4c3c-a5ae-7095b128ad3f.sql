REVOKE EXECUTE ON FUNCTION public._membro(text[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.painel_oficina(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.tunap_painel(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.painel_oficina(text), public.tunap_painel(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public._membro(text[]) FROM authenticated;