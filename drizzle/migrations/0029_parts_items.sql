CREATE TABLE public.parts_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT public.data_owner(),
  mes text NOT NULL,
  at timestamptz NOT NULL DEFAULT now(),
  nome text NOT NULL DEFAULT '',
  itens jsonb NOT NULL DEFAULT '[]'::jsonb,
  UNIQUE (user_id, mes)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parts_items TO authenticated;
GRANT ALL ON public.parts_items TO service_role;
ALTER TABLE public.parts_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team read" ON public.parts_items FOR SELECT TO authenticated USING (user_id = public.data_owner());
CREATE POLICY "team insert" ON public.parts_items FOR INSERT TO authenticated WITH CHECK (user_id = public.data_owner() AND public.can_edit());
CREATE POLICY "team update" ON public.parts_items FOR UPDATE TO authenticated USING (user_id = public.data_owner() AND public.can_edit());
CREATE POLICY "team delete" ON public.parts_items FOR DELETE TO authenticated USING (user_id = public.data_owner() AND public.can_edit());