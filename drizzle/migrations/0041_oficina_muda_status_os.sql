ALTER TABLE public.os_acompanhamento ALTER COLUMN user_id SET DEFAULT coalesce(public.data_owner(), public.oficina_owner());
DROP POLICY IF EXISTS "oficina insert" ON public.os_acompanhamento;
DROP POLICY IF EXISTS "oficina update" ON public.os_acompanhamento;
CREATE POLICY "oficina insert" ON public.os_acompanhamento FOR INSERT TO authenticated WITH CHECK (user_id = public.oficina_owner() AND os_n NOT LIKE 'nps:%');
CREATE POLICY "oficina update" ON public.os_acompanhamento FOR UPDATE TO authenticated USING (user_id = public.oficina_owner() AND os_n NOT LIKE 'nps:%') WITH CHECK (user_id = public.oficina_owner() AND os_n NOT LIKE 'nps:%');