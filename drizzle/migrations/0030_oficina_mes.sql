CREATE TABLE public.oficina_mes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT data_owner(),
  mes text NOT NULL,
  diario jsonb NOT NULL DEFAULT '{}'::jsonb,
  retornos jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, mes)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.oficina_mes TO authenticated;
GRANT ALL ON public.oficina_mes TO service_role;
ALTER TABLE public.oficina_mes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team read" ON public.oficina_mes FOR SELECT TO authenticated USING (user_id = data_owner());
CREATE POLICY "team insert" ON public.oficina_mes FOR INSERT TO authenticated WITH CHECK (user_id = data_owner() AND can_edit());
CREATE POLICY "team update" ON public.oficina_mes FOR UPDATE TO authenticated USING (user_id = data_owner() AND can_edit()) WITH CHECK (user_id = data_owner() AND can_edit());
CREATE POLICY "team delete" ON public.oficina_mes FOR DELETE TO authenticated USING (user_id = data_owner() AND can_edit());