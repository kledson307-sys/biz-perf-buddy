CREATE TABLE public.mech_month (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL DEFAULT public.data_owner(),
 mes text NOT NULL,
 nome text NOT NULL,
 servicos numeric NOT NULL DEFAULT 0,
 pecas numeric NOT NULL DEFAULT 0,
 passagens numeric NOT NULL DEFAULT 0,
 meta_servicos numeric NOT NULL DEFAULT 0,
 meta_pecas numeric NOT NULL DEFAULT 0,
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (user_id, mes, nome)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mech_month TO authenticated;
GRANT ALL ON public.mech_month TO service_role;
ALTER TABLE public.mech_month ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team read" ON public.mech_month FOR SELECT TO authenticated USING (user_id = public.data_owner());
CREATE POLICY "team insert" ON public.mech_month FOR INSERT TO authenticated WITH CHECK (user_id = public.data_owner() AND public.can_edit());
CREATE POLICY "team update" ON public.mech_month FOR UPDATE TO authenticated USING (user_id = public.data_owner() AND public.can_edit()) WITH CHECK (user_id = public.data_owner() AND public.can_edit());
CREATE POLICY "team delete" ON public.mech_month FOR DELETE TO authenticated USING (user_id = public.data_owner() AND public.can_edit());