CREATE TABLE public.cons_mix (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT public.data_owner(),
  mes text NOT NULL,
  nome text NOT NULL,
  composicao jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, mes, nome)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cons_mix TO authenticated;
GRANT ALL ON public.cons_mix TO service_role;
ALTER TABLE public.cons_mix ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team read" ON public.cons_mix FOR SELECT TO authenticated USING (user_id = public.data_owner());
CREATE POLICY "team insert" ON public.cons_mix FOR INSERT TO authenticated WITH CHECK (user_id = public.data_owner() AND public.can_edit());
CREATE POLICY "team update" ON public.cons_mix FOR UPDATE TO authenticated USING (user_id = public.data_owner() AND public.can_edit()) WITH CHECK (user_id = public.data_owner() AND public.can_edit());
CREATE POLICY "team delete" ON public.cons_mix FOR DELETE TO authenticated USING (user_id = public.data_owner() AND public.can_edit());