CREATE TABLE public.vendas_complementares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT public.data_owner(),
  mes text NOT NULL,
  dia date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Bahia')::date,
  departamento text NOT NULL CHECK (departamento IN ('ACESSORIOS','ESTETICA')),
  cliente text NOT NULL DEFAULT '',
  placa text NOT NULL DEFAULT '',
  vendedor text NOT NULL DEFAULT '',
  segmento text NOT NULL DEFAULT 'CARRO',
  canal text NOT NULL DEFAULT 'NOVO',
  produto text NOT NULL DEFAULT '',
  valor numeric NOT NULL DEFAULT 0,
  premiacao numeric NOT NULL DEFAULT 0,
  obsoleto boolean NOT NULL DEFAULT false,
  os_n text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'A_FATURAR',
  devolucao numeric NOT NULL DEFAULT 0,
  criado_por text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendas_complementares TO authenticated;
GRANT ALL ON public.vendas_complementares TO service_role;
ALTER TABLE public.vendas_complementares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team read" ON public.vendas_complementares FOR SELECT TO authenticated USING (user_id = public.data_owner());
CREATE POLICY "team insert" ON public.vendas_complementares FOR INSERT TO authenticated WITH CHECK (user_id = public.data_owner() AND public.can_edit());
CREATE POLICY "team update" ON public.vendas_complementares FOR UPDATE TO authenticated USING (user_id = public.data_owner() AND public.can_edit());
CREATE POLICY "team delete" ON public.vendas_complementares FOR DELETE TO authenticated USING (user_id = public.data_owner() AND public.can_edit());
CREATE INDEX ON public.vendas_complementares(user_id, mes);

CREATE TABLE public.vendedores_showroom (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT public.data_owner(),
  nome text NOT NULL,
  segmento text NOT NULL DEFAULT 'CARRO',
  canal text NOT NULL DEFAULT 'NOVO',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, nome)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendedores_showroom TO authenticated;
GRANT ALL ON public.vendedores_showroom TO service_role;
ALTER TABLE public.vendedores_showroom ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team read" ON public.vendedores_showroom FOR SELECT TO authenticated USING (user_id = public.data_owner());
CREATE POLICY "team insert" ON public.vendedores_showroom FOR INSERT TO authenticated WITH CHECK (user_id = public.data_owner() AND public.can_edit());
CREATE POLICY "team update" ON public.vendedores_showroom FOR UPDATE TO authenticated USING (user_id = public.data_owner() AND public.can_edit());
CREATE POLICY "team delete" ON public.vendedores_showroom FOR DELETE TO authenticated USING (user_id = public.data_owner() AND public.can_edit());

CREATE TABLE public.rvd_volumes_mes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT public.data_owner(),
  mes text NOT NULL,
  vendedor text NOT NULL,
  veiculos integer NOT NULL DEFAULT 0,
  target numeric NOT NULL DEFAULT 0,
  atualizado_por text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, mes, vendedor)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rvd_volumes_mes TO authenticated;
GRANT ALL ON public.rvd_volumes_mes TO service_role;
ALTER TABLE public.rvd_volumes_mes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team read" ON public.rvd_volumes_mes FOR SELECT TO authenticated USING (user_id = public.data_owner());
CREATE POLICY "team insert" ON public.rvd_volumes_mes FOR INSERT TO authenticated WITH CHECK (user_id = public.data_owner() AND public.can_edit());
CREATE POLICY "team update" ON public.rvd_volumes_mes FOR UPDATE TO authenticated USING (user_id = public.data_owner() AND public.can_edit());
CREATE POLICY "team delete" ON public.rvd_volumes_mes FOR DELETE TO authenticated USING (user_id = public.data_owner() AND public.can_edit());