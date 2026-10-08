CREATE TABLE public.supervisor_day (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT data_owner(),
  consultant_id uuid NOT NULL REFERENCES public.consultants(id),
  dia date NOT NULL,
  obj_servicos numeric NOT NULL DEFAULT 0,
  obj_pecas numeric NOT NULL DEFAULT 0,
  real_servicos numeric NOT NULL DEFAULT 0,
  real_pecas numeric NOT NULL DEFAULT 0,
  obs text NOT NULL DEFAULT ''::text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, consultant_id, dia)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supervisor_day TO authenticated;
GRANT ALL ON public.supervisor_day TO service_role;
ALTER TABLE public.supervisor_day ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team read" ON public.supervisor_day FOR SELECT TO authenticated USING (user_id = data_owner());
CREATE POLICY "team insert" ON public.supervisor_day FOR INSERT TO authenticated WITH CHECK (user_id = data_owner() AND can_edit());
CREATE POLICY "team update" ON public.supervisor_day FOR UPDATE TO authenticated USING (user_id = data_owner() AND can_edit()) WITH CHECK (user_id = data_owner() AND can_edit());
CREATE POLICY "team delete" ON public.supervisor_day FOR DELETE TO authenticated USING (user_id = data_owner() AND can_edit());