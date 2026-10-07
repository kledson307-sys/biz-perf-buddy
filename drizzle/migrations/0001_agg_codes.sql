CREATE TABLE public.agg_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  item text NOT NULL,
  codigos text NOT NULL DEFAULT '',
  UNIQUE (user_id, item)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agg_codes TO authenticated;
GRANT ALL ON public.agg_codes TO service_role;
ALTER TABLE public.agg_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own rows" ON public.agg_codes FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);