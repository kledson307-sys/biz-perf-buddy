CREATE TABLE public.parts_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT public.data_owner(),
  mes text NOT NULL,
  consultant_id uuid NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  motivo text,
  nf text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parts_returns TO authenticated;
GRANT ALL ON public.parts_returns TO service_role;
ALTER TABLE public.parts_returns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team read" ON public.parts_returns FOR SELECT TO authenticated USING (user_id = public.data_owner());
CREATE POLICY "team insert" ON public.parts_returns FOR INSERT TO authenticated WITH CHECK (user_id = public.data_owner() AND public.can_edit());
CREATE POLICY "team delete" ON public.parts_returns FOR DELETE TO authenticated USING (user_id = public.data_owner() AND public.can_edit());