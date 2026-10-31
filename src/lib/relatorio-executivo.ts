/** Análise gerencial do Relatório Executivo: só usa valores já calculados pelo sistema; nada é estimado sem base. */
import { acaoReversao, classe, type NpsItem, type Resumo } from "@/lib/nps";

export type ConsRel = { nome: string; dept: string; s: number; p: number; mS: number; mP: number; perf: number; projPct: number };
export type DeptRel = { nome: string; v: number; meta: number; projPct: number };
export type AggRel = { nome: string; q: number; v: number; mq: number };
export type AgendaRel = { d1: number; d0: number; d0Atendidos: number; dias: number; metaDiaria: number; carro: number; moto: number; rev: number; diag: number; recall: number };

export type EntradaRel = {
  mes: string; geradoEm: Date; filtro: string; modo: "acompanhamento" | "fechamento"; dec: number; tot: number; base: string;
  t: { s: number; p: number; ms: number; mp: number; os: number; op: number };
  ant: { s: number; p: number } | null; diaCorte: number;
  consultores: ConsRel[]; depts: DeptRel[]; pass: number;
  mec: { s: number; p: number; ms: number; mp: number; pass: number };
  os: { abertas: number; parados: number; amarelos: number; mediaDias: number; fluxo: { st: string; n: number }[] };
  nps: Resumo | null; npsItens: NpsItem[]; agg: AggRel[]; agenda: AgendaRel | null; retornos: number | null;
};

export type Acao = { acao: string; indicador: string; alvo: string; prioridade: "Alta" | "Média"; prazo: string; resp: string };
const MOTO = /\b(PEDRO|GILBERTO)\b/i;
export const div = (a: number, b: number) => (b ? a / b : 0);
export const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
export const pct = (v: number) => `${(v * 100).toFixed(1).replace(".", ",")}%`;
export const num = (v: number, d = 2) => v.toFixed(d).replace(".", ",");
export const nomeArquivo = (mes: string) => `Relatorio_Executivo_Pos_Venda_BMW_${mes.replace("-", "")}.pdf`;
/** Projeção linear pelo ritmo de dias decorridos (mesma regra do Dashboard). */
export const projetar = (v: number, dec: number, tot: number) => (dec ? div(v, dec) * tot : 0);

export function ranking(itens: NpsItem[]) {
  const m = new Map<string, number>();
  for (const x of itens) if (x.nota !== null && !x.pj && classe(x.nota) !== "promotor") { const k = (x.motivo || "Sem motivo informado").trim().toUpperCase(); m.set(k, (m.get(k) ?? 0) + 1); }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

export function analisar(e: EntradaRel) {
  const fato: string[] = [], interp: string[] = [], indisp: string[] = [];
  const total = e.t.s + e.t.p, meta = e.t.ms + e.t.mp;
  const ritmo = div(e.dec, e.tot), ating = div(total, meta);
  const pS = projetar(e.t.s, e.dec, e.tot), pP = projetar(e.t.p, e.dec, e.tot), pT = pS + pP;
  const ratio = div(e.t.p, e.t.s);
  const fechamento = e.modo === "fechamento";

  if (meta) fato.push(`Faturamento de ${brl(total)} contra meta de ${brl(meta)} (${pct(ating)} de atingimento; diferença de ${brl(meta - total)}).`);
  else indisp.push("Meta de faturamento não cadastrada para o período.");
  if (!fechamento && meta) fato.push(`Decorridos ${e.dec} de ${e.tot} dias ${e.base === "uteis" ? "úteis" : "corridos"} (${pct(ritmo)}); projeção de fechamento em ${brl(pT)} (${pct(div(pT, meta))} da meta).`);
  if (meta && !fechamento) interp.push(ating >= ritmo ? `O resultado está ${num((ating - ritmo) * 100, 1)} p.p. acima do ritmo esperado para o dia.` : `O resultado está ${num((ritmo - ating) * 100, 1)} p.p. abaixo do ritmo esperado; sem recuperação, a meta não será atingida.`);
  if (e.ant && (e.ant.s + e.ant.p)) { const v = div(total, e.ant.s + e.ant.p) - 1; fato.push(`Comparado ao mês anterior até o dia ${e.diaCorte}: ${v >= 0 ? "+" : ""}${pct(v)} (${brl(e.ant.s + e.ant.p)}).`); }
  else indisp.push("Comparação com o período anterior: sem vendas importadas no mês anterior.");
  if (e.t.s) fato.push(`Peças por R$ 1 de mão de obra: R$ ${num(ratio)} (referência BMW R$ 2,50–3,50).`);
  if (e.nps) fato.push(`NPS ${pct(e.nps.nps)} com ${pct(e.nps.pctProm)} de promotores em ${e.nps.avaliados} avaliações (${e.nps.det} detratores).`);
  else indisp.push("NPS: nenhuma pesquisa importada.");
  if (!e.agenda) indisp.push("Agendamentos: nenhum relatório de agenda importado no mês.");
  if (e.retornos === null) indisp.push("Retornos ≤ 60 dias: planilha de Passagens não importada.");
  if (!e.os.abertas) indisp.push("Ordens de serviço: nenhum snapshot do Controle O.S.");
  if (!e.pass) indisp.push("Passagens do mês não importadas (tickets médios indisponíveis).");

  const comMeta = e.consultores.filter((c) => c.mS + c.mP > 0);
  const abaixo = comMeta.filter((c) => c.projPct < 0.85).sort((a, b) => a.projPct - b.projPct);
  const destaque = [...comMeta].sort((a, b) => b.perf - a.perf).slice(0, 3);
  const deptGap = e.depts.filter((d) => d.meta > 0 && d.projPct < 1).sort((a, b) => a.projPct - b.projPct);
  const carro = e.consultores.filter((c) => !MOTO.test(c.nome)), moto = e.consultores.filter((c) => MOTO.test(c.nome));
  const seg = (l: ConsRel[]) => ({ v: l.reduce((a, c) => a + c.s + c.p, 0), meta: l.reduce((a, c) => a + c.mS + c.mP, 0) });
  const motivos = ranking(e.npsItens);

  const riscos: string[] = [], oport: string[] = [], positivos: string[] = [];
  for (const d of deptGap.slice(0, 3)) riscos.push(`${d.nome} projeta ${pct(d.projPct)} da meta (realizado ${brl(d.v)} de ${brl(d.meta)}).`);
  if (abaixo.length) riscos.push(`${abaixo.length} consultor(es) com projeção abaixo de 85%: ${abaixo.map((c) => `${c.nome} (${pct(c.projPct)})`).join(", ")}.`);
  if (e.os.parados) riscos.push(`${e.os.parados} O.S. com mais de 30 dias no pátio; ${e.os.amarelos} entre 21 e 30 dias.`);
  if (e.nps && e.nps.pctProm < 0.85) riscos.push(`Promotores NPS em ${pct(e.nps.pctProm)}, abaixo da meta BMW Carro de 85%.`);
  if (e.t.s && ratio < 2.5) oport.push(`Ratio de peças em R$ ${num(ratio)} por R$ 1 de M.O.: abaixo da faixa BMW; há espaço para orçamentos completos na recepção.`);
  if (e.os.op + e.os.os > 0) oport.push(`${brl(e.os.os + e.os.op)} em O.S. abertas podem ser faturadas no mês (serviços ${brl(e.os.os)} · peças ${brl(e.os.op)}).`);
  for (const a of e.agg.filter((x) => x.mq > 0 && projetar(x.q, e.dec, e.tot) < x.mq)) oport.push(`${a.nome}: ${Math.round(a.q)} un. vendidas, ritmo projeta ${Math.round(projetar(a.q, e.dec, e.tot))} de ${Math.round(a.mq)} na meta.`);
  if (e.agenda && e.agenda.metaDiaria) { const med = div(e.agenda.d0, e.agenda.dias); if (med < e.agenda.metaDiaria) oport.push(`Agenda média de ${num(med, 1)} veículos/dia contra meta de ${e.agenda.metaDiaria}: capacidade ociosa para captação.`); }
  for (const c of destaque) positivos.push(`${c.nome}: ${pct(c.perf)} da meta (${brl(c.s + c.p)}).`);
  if (e.nps && e.nps.pctProm >= 0.85) positivos.push(`Promotores NPS em ${pct(e.nps.pctProm)}, acima da meta.`);

  const acoes: Acao[] = [];
  for (const d of deptGap.slice(0, 2)) acoes.push({ acao: `Reforçar vendas em ${d.nome} com acompanhamento diário do gap`, indicador: "% atingimento da meta", alvo: `${brl(Math.max(d.meta - d.v, 0) / Math.max(e.tot - e.dec, 1))}/dia restante`, prioridade: d.projPct < 0.85 ? "Alta" : "Média", prazo: "Até o fim do mês", resp: "Gerente de Pós-Venda" });
  for (const c of abaixo.slice(0, 3)) acoes.push({ acao: `Conversa individual e plano de recuperação com ${c.nome}`, indicador: "Projeção do consultor", alvo: "≥ 100% da meta", prioridade: "Alta", prazo: "Esta semana", resp: "Gerente de Pós-Venda" });
  if (e.os.parados) acoes.push({ acao: "Revisar O.S. paradas há mais de 30 dias e definir prazo de saída", indicador: "O.S. > 30 dias", alvo: "0 O.S.", prioridade: "Alta", prazo: "7 dias", resp: "Controlador de Quadro" });
  if (e.t.s && ratio < 2.5) acoes.push({ acao: "Orçamento completo de peças em toda passagem", indicador: "Peças por R$ 1 de M.O.", alvo: "R$ 2,50 a R$ 3,50", prioridade: "Média", prazo: "Mês corrente", resp: "Consultores" });
  if (motivos[0]) acoes.push({ acao: acaoReversao(motivos[0][0]), indicador: `Reclamação "${motivos[0][0].toLowerCase()}"`, alvo: "Reduzir ocorrências", prioridade: "Média", prazo: "30 dias", resp: "Gerente de Pós-Venda" });
  if (e.nps && e.nps.pctProm < 0.85) acoes.push({ acao: "Follow-up D-13 com clientes antes da pesquisa BMW", indicador: "% promotores", alvo: "≥ 85% (Carro)", prioridade: "Alta", prazo: "Contínuo", resp: "Consultores" });

  const conclusao = !meta ? "Sem meta cadastrada, o relatório apresenta apenas os valores realizados."
    : fechamento ? `O período fechou com ${pct(ating)} da meta de faturamento${ating >= 1 ? ", meta atingida" : ", abaixo da meta"}. ${riscos.length ? "Os pontos de atenção listados devem orientar o planejamento do próximo mês." : ""}`
      : `Com ${pct(ritmo)} do mês decorrido, a projeção indica ${pct(div(pT, meta))} da meta. ${acoes.length ? `As ${acoes.length} ações priorizadas concentram o esforço onde o gap é maior.` : "Nenhum desvio relevante identificado."}`;

  return { total, meta, ating, ritmo, pS, pP, pT, ratio, fato, interp, indisp, abaixo, destaque, deptGap, riscos, oport, positivos, acoes, conclusao, motivos,
    segmentos: { carro: { ...seg(carro), n: carro.length }, moto: { ...seg(moto), n: moto.length } } };
}
