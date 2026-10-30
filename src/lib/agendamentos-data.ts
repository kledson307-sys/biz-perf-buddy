import { supabase } from "@/integrations/supabase/client";
import type { Categoria } from "@/lib/agendamento";

/** Linha da tabela agendamentos. */
export type AgendRow = {
  id: string; data: string; tipo: "d1" | "d0"; hora: string; status: string; cliente: string; os: string;
  celular: string; consultor: string; produto: string; placa: string; segmento: "carro" | "moto";
  categoria: Categoria; obs: string;
};
export type Followup = { id: string; agendamento_id: string; aceito_por: string; aceito_em: string | null; confirmacao: "sim" | "nao" | "faltou" | null; confirmado_por: string; confirmado_em: string | null };

/** Consultores cujos clientes entram como "passantes" na agenda do dia. */
export const CONS_PASSANTES = /\b(WESLEY|RENAN|JADNA|ANDRESSA|PEDRO|GILBERTO)\b/i;
/** Status que marcam o veículo como atendido no fechamento do dia. */
export const STATUS_ATENDIDO = /EFETIVAD|ENCERRAD|FINALIZAD/i;

export async function carregarAgendamentos(mes: string): Promise<AgendRow[]> {
  const { data, error } = await supabase.from("agendamentos").select("*").gte("data", `${mes}-01`).lt("data", `${mes}-32`).order("data").order("hora");
  if (error) throw new Error("Erro ao carregar agendamentos: " + error.message);
  return (data ?? []) as AgendRow[];
}

export async function carregarFollowups(ids: string[]): Promise<Followup[]> {
  if (!ids.length) return [];
  const { data, error } = await supabase.from("agendamento_followups").select("*").in("agendamento_id", ids);
  if (error) throw new Error("Erro ao carregar follow-ups: " + error.message);
  return (data ?? []) as Followup[];
}

export async function aceitarFollowup(agendamentoId: string, nome: string) {
  const { error } = await supabase.from("agendamento_followups").upsert(
    { agendamento_id: agendamentoId, aceito_por: nome, aceito_em: new Date().toISOString() },
    { onConflict: "agendamento_id" },
  );
  if (error) throw new Error("Erro ao aceitar follow-up: " + error.message);
}

export async function confirmarFollowup(agendamentoId: string, confirmacao: "sim" | "nao" | "faltou", nome: string) {
  const { error } = await supabase.from("agendamento_followups")
    .update({ confirmacao, confirmado_por: nome, confirmado_em: new Date().toISOString() })
    .eq("agendamento_id", agendamentoId);
  if (error) throw new Error("Erro ao confirmar sintoma: " + error.message);
}

export type Contagem = { carro: number; moto: number; porCat: Record<Categoria, { carro: number; moto: number }> };
export const contar = (itens: AgendRow[]): Contagem => {
  const porCat: Contagem["porCat"] = { revisao: { carro: 0, moto: 0 }, diagnostico: { carro: 0, moto: 0 }, recall: { carro: 0, moto: 0 } };
  let carro = 0, moto = 0;
  for (const i of itens) { porCat[i.categoria][i.segmento]++; if (i.segmento === "carro") carro++; else moto++; }
  return { carro, moto, porCat };
};

/** Agenda do dia separada em passantes (consultores do balcão de agendamento) e agendados. */
export const separarPassantes = (itens: AgendRow[]) => ({
  passantes: itens.filter((i) => CONS_PASSANTES.test(i.consultor)),
  agendados: itens.filter((i) => !CONS_PASSANTES.test(i.consultor)),
});

export type LinhaFechamento = { placa: string; cliente: string; hora: string; categoria: Categoria; segmento: string; confirmacao: string; atendido: boolean; statusD0: string };
/** Fechamento do dia: confronta o D+1 da véspera com o D0, casando por placa. */
export function fechamentoDoDia(d1: AgendRow[], d0: AgendRow[]): LinhaFechamento[] {
  const porPlaca = new Map(d0.map((i) => [i.placa, i]));
  return d1.map((a) => {
    const real = porPlaca.get(a.placa);
    return {
      placa: a.placa, cliente: a.cliente, hora: a.hora, categoria: a.categoria, segmento: a.segmento,
      confirmacao: /CONFIRM/i.test(a.status) && !/NAO|NÃO/i.test(a.status) ? "Confirmado" : "A confirmar",
      atendido: real ? STATUS_ATENDIDO.test(real.status) : false,
      statusD0: real?.status ?? "não apareceu na agenda do dia",
    };
  });
}

/** Clientes que agendaram e não compareceram (D0 com status de falta ou D1 sem par no D0). */
export function faltasDoMes(rows: AgendRow[]): { placa: string; cliente: string; faltas: number; datas: string[] }[] {
  const d1 = rows.filter((r) => r.tipo === "d1");
  const d0porDataPlaca = new Map(rows.filter((r) => r.tipo === "d0").map((r) => [`${r.data}|${r.placa}`, r]));
  const faltas = new Map<string, { placa: string; cliente: string; faltas: number; datas: string[] }>();
  for (const a of d1) {
    const real = d0porDataPlaca.get(`${a.data}|${a.placa}`);
    const faltou = real ? /NAO COMPAREC|FALTOU|FALTA/i.test(real.status) || !STATUS_ATENDIDO.test(real.status) : true;
    if (!faltou) continue;
    const k = a.placa || a.cliente;
    const e = faltas.get(k) ?? { placa: a.placa, cliente: a.cliente, faltas: 0, datas: [] };
    e.faltas++; e.datas.push(a.data); faltas.set(k, e);
  }
  return [...faltas.values()].sort((a, b) => b.faltas - a.faltas);
}

export type Falta = { placa: string; cliente: string; faltas: number; datas: string[] };
/** Fantasmas: mais de 2 agendamentos sem comparecimento. */
export const fantasmas = (faltas: Falta[]) => faltas.filter((f) => f.faltas > 2);
