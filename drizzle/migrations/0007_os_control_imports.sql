CREATE TABLE public.os_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT public.data_owner(),
  at timestamptz NOT NULL DEFAULT now(),
  nome text NOT NULL DEFAULT '',
  arquivo text NOT NULL DEFAULT '',
  itens jsonb NOT NULL DEFAULT '[]'::jsonb
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.os_imports TO authenticated;
GRANT ALL ON public.os_imports TO service_role;
ALTER TABLE public.os_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team read" ON public.os_imports FOR SELECT TO authenticated USING (user_id = public.data_owner());
CREATE POLICY "team insert" ON public.os_imports FOR INSERT TO authenticated WITH CHECK (user_id = public.data_owner() AND public.can_edit());
CREATE POLICY "team delete" ON public.os_imports FOR DELETE TO authenticated USING (user_id = public.data_owner() AND public.can_edit());
CREATE INDEX os_imports_user_at ON public.os_imports(user_id, at DESC);