CREATE TABLE IF NOT EXISTS public.update_log (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL DEFAULT auth.uid(), at timestamptz NOT NULL DEFAULT now(), nome text NOT NULL, origem text NOT NULL);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.update_log TO authenticated;
GRANT ALL ON public.update_log TO service_role;
ALTER TABLE public.update_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own rows" ON public.update_log;
CREATE POLICY "own rows" ON public.update_log FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);