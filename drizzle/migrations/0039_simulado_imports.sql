CREATE TABLE public.simulado_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  tipo text NOT NULL,
  mes text NOT NULL,
  arquivo text NOT NULL DEFAULT '',
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, tipo, mes)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.simulado_imports TO authenticated;
GRANT ALL ON public.simulado_imports TO service_role;
ALTER TABLE public.simulado_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "simulado dono" ON public.simulado_imports FOR ALL TO authenticated
  USING (auth.uid() = user_id AND lower(auth.jwt()->>'email') = 'kledson307@gmail.com')
  WITH CHECK (auth.uid() = user_id AND lower(auth.jwt()->>'email') = 'kledson307@gmail.com');