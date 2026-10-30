CREATE TABLE public.agendamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT public.data_owner(),
  data date NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('d1','d0')),
  hora text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT '',
  cliente text NOT NULL DEFAULT '',
  os text NOT NULL DEFAULT '',
  celular text NOT NULL DEFAULT '',
  consultor text NOT NULL DEFAULT '',
  produto text NOT NULL DEFAULT '',
  placa text NOT NULL DEFAULT '',
  segmento text NOT NULL DEFAULT 'carro',
  categoria text NOT NULL DEFAULT 'revisao',
  obs text NOT NULL DEFAULT '',
  arquivo text NOT NULL DEFAULT '',
  importado_por text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, tipo, data, placa, hora)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agendamentos TO authenticated;
GRANT ALL ON public.agendamentos TO service_role;
ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team read" ON public.agendamentos FOR SELECT TO authenticated USING (user_id = public.data_owner());
CREATE POLICY "team insert" ON public.agendamentos FOR INSERT TO authenticated WITH CHECK (user_id = public.data_owner() AND public.can_edit());
CREATE POLICY "team update" ON public.agendamentos FOR UPDATE TO authenticated USING (user_id = public.data_owner() AND public.can_edit());
CREATE POLICY "team delete" ON public.agendamentos FOR DELETE TO authenticated USING (user_id = public.data_owner() AND public.can_edit());

CREATE TABLE public.agendamento_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT public.data_owner(),
  agendamento_id uuid NOT NULL REFERENCES public.agendamentos(id) ON DELETE CASCADE,
  aceito_por text NOT NULL DEFAULT '',
  aceito_em timestamptz,
  confirmacao text CHECK (confirmacao IN ('sim','nao','faltou')),
  confirmado_por text NOT NULL DEFAULT '',
  confirmado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agendamento_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agendamento_followups TO authenticated;
GRANT ALL ON public.agendamento_followups TO service_role;
ALTER TABLE public.agendamento_followups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team read" ON public.agendamento_followups FOR SELECT TO authenticated USING (user_id = public.data_owner());
CREATE POLICY "team insert" ON public.agendamento_followups FOR INSERT TO authenticated WITH CHECK (user_id = public.data_owner() AND public.can_edit());
CREATE POLICY "team update" ON public.agendamento_followups FOR UPDATE TO authenticated USING (user_id = public.data_owner() AND public.can_edit());
CREATE POLICY "team delete" ON public.agendamento_followups FOR DELETE TO authenticated USING (user_id = public.data_owner() AND public.can_edit());

CREATE TABLE public.agenda_metas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT public.data_owner(),
  mes text NOT NULL,
  segmento text NOT NULL CHECK (segmento IN ('carro','moto')),
  categoria text NOT NULL CHECK (categoria IN ('revisao','diagnostico','recall')),
  qtd_diaria integer NOT NULL DEFAULT 0,
  UNIQUE (user_id, mes, segmento, categoria)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agenda_metas TO authenticated;
GRANT ALL ON public.agenda_metas TO service_role;
ALTER TABLE public.agenda_metas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team read" ON public.agenda_metas FOR SELECT TO authenticated USING (user_id = public.data_owner());
CREATE POLICY "team insert" ON public.agenda_metas FOR INSERT TO authenticated WITH CHECK (user_id = public.data_owner() AND public.can_edit());
CREATE POLICY "team update" ON public.agenda_metas FOR UPDATE TO authenticated USING (user_id = public.data_owner() AND public.can_edit());
CREATE POLICY "team delete" ON public.agenda_metas FOR DELETE TO authenticated USING (user_id = public.data_owner() AND public.can_edit());