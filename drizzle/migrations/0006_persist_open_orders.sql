CREATE TABLE public.open_order_snapshots (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL DEFAULT public.data_owner(),
 mes text NOT NULL,
 valores jsonb NOT NULL DEFAULT '{}'::jsonb,
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id, mes)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.open_order_snapshots TO authenticated;
GRANT ALL ON public.open_order_snapshots TO service_role;
ALTER TABLE public.open_order_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team read" ON public.open_order_snapshots FOR SELECT TO authenticated USING (user_id = public.data_owner());
CREATE POLICY "team insert" ON public.open_order_snapshots FOR INSERT TO authenticated WITH CHECK (user_id = public.data_owner() AND public.can_edit());
CREATE POLICY "team update" ON public.open_order_snapshots FOR UPDATE TO authenticated USING (user_id = public.data_owner() AND public.can_edit()) WITH CHECK (user_id = public.data_owner() AND public.can_edit());
CREATE POLICY "team delete" ON public.open_order_snapshots FOR DELETE TO authenticated USING (user_id = public.data_owner() AND public.can_edit());