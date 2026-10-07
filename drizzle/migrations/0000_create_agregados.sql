CREATE TABLE public.agg_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  consultant_id uuid NOT NULL REFERENCES public.consultants(id) ON DELETE CASCADE,
  dia date NOT NULL,
  item text NOT NULL,
  qtd numeric NOT NULL DEFAULT 0,
  valor numeric NOT NULL DEFAULT 0,
  UNIQUE (consultant_id, dia, item)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agg_sales TO authenticated;
GRANT ALL ON public.agg_sales TO service_role;
ALTER TABLE public.agg_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own rows" ON public.agg_sales FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.agg_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  consultant_id uuid NOT NULL REFERENCES public.consultants(id) ON DELETE CASCADE,
  mes text NOT NULL,
  item text NOT NULL,
  meta_qtd numeric NOT NULL DEFAULT 0,
  meta_valor numeric NOT NULL DEFAULT 0,
  UNIQUE (consultant_id, mes, item)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agg_goals TO authenticated;
GRANT ALL ON public.agg_goals TO service_role;
ALTER TABLE public.agg_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own rows" ON public.agg_goals FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.agg_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  consultant_id uuid NOT NULL REFERENCES public.consultants(id) ON DELETE CASCADE,
  dia date NOT NULL,
  passagens numeric NOT NULL DEFAULT 0,
  UNIQUE (consultant_id, dia)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agg_visits TO authenticated;
GRANT ALL ON public.agg_visits TO service_role;
ALTER TABLE public.agg_visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own rows" ON public.agg_visits FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);