CREATE TABLE public.departments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL DEFAULT auth.uid(), nome text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.consultants (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL DEFAULT auth.uid(), department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL, nome text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id, nome));
CREATE TABLE public.goals (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL DEFAULT auth.uid(), consultant_id uuid NOT NULL REFERENCES public.consultants(id) ON DELETE CASCADE, mes text NOT NULL, servicos numeric NOT NULL DEFAULT 0, pecas numeric NOT NULL DEFAULT 0, UNIQUE(consultant_id, mes));
CREATE TABLE public.month_params (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL DEFAULT auth.uid(), mes text NOT NULL, du_totais int NOT NULL DEFAULT 22, du_decorridos int NOT NULL DEFAULT 1, dc_totais int NOT NULL DEFAULT 30, dc_decorridos int NOT NULL DEFAULT 1, base text NOT NULL DEFAULT 'uteis', UNIQUE(user_id, mes));
CREATE TABLE public.daily_sales (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL DEFAULT auth.uid(), consultant_id uuid NOT NULL REFERENCES public.consultants(id) ON DELETE CASCADE, dia date NOT NULL, servicos numeric NOT NULL DEFAULT 0, pecas numeric NOT NULL DEFAULT 0, UNIQUE(consultant_id, dia));
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['departments','consultants','goals','month_params','daily_sales'] LOOP
EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
EXECUTE format('CREATE POLICY "own rows" ON public.%I FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)', t);
END LOOP; END $$;