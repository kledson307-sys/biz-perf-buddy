CREATE TABLE public.os_acompanhamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT public.data_owner(),
  os_n text NOT NULL,
  acoes jsonb NOT NULL DEFAULT '{}'::jsonb,
  prev_manual date,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, os_n)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.os_acompanhamento TO authenticated;
GRANT ALL ON public.os_acompanhamento TO service_role;
ALTER TABLE public.os_acompanhamento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team read" ON public.os_acompanhamento FOR SELECT TO authenticated USING (user_id = public.data_owner());
CREATE POLICY "team insert" ON public.os_acompanhamento FOR INSERT TO authenticated WITH CHECK (user_id = public.data_owner() AND public.can_edit());
CREATE POLICY "team update" ON public.os_acompanhamento FOR UPDATE TO authenticated USING (user_id = public.data_owner() AND public.can_edit()) WITH CHECK (user_id = public.data_owner() AND public.can_edit());
CREATE POLICY "team delete" ON public.os_acompanhamento FOR DELETE TO authenticated USING (user_id = public.data_owner() AND public.can_edit());