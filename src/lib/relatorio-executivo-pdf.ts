/** Desenha o Relatório Executivo em PDF (A4, identidade BMW). Importar só no navegador (dynamic import). */
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { analisar, brl, div, num, pct, projetar, type EntradaRel } from "@/lib/relatorio-executivo";

const NAVY: [number, number, number] = [0, 43, 73], BLUE: [number, number, number] = [0, 102, 177], GRAY: [number, number, number] = [244, 246, 248];
const INK: [number, number, number] = [26, 26, 26], MUTED: [number, number, number] = [110, 118, 128];
const GREEN: [number, number, number] = [22, 150, 80], YEL: [number, number, number] = [214, 150, 0], RED: [number, number, number] = [200, 40, 40];
const cor = (p: number) => (p >= 1 ? GREEN : p >= 0.85 ? YEL : RED);

export function gerarPdf(e: EntradaRel): Blob {
  const a = analisar(e);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, M = 14, CW = W - 2 * M;
  const [yy, mm] = e.mes.split("-").map(Number);
  const periodo = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(yy!, mm! - 1, 1));
  const gerado = e.geradoEm.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  let y = 0;

  const header = (titulo: string) => {
    doc.setFillColor(...NAVY); doc.rect(0, 0, W, 26, "F");
    doc.setFillColor(...BLUE); doc.rect(0, 26, W, 1.2, "F");
    doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.text("HAUS SALVADOR · PÓS-VENDA BMW", M, 9);
    doc.setFontSize(15); doc.text(titulo, M, 18);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8);
    doc.text(`Período: ${periodo}${e.modo === "fechamento" ? " · fechamento" : ` · até dia ${e.dec}/${e.tot}`}`, W - M, 12, { align: "right" });
    doc.text(`Filtro: ${e.filtro} · Gerado em ${gerado}`, W - M, 18, { align: "right" });
    y = 35;
  };
  const novaPagina = (t: string) => { doc.addPage(); header(t); };
  const garantir = (h: number, t: string) => { if (y + h > 282) novaPagina(t); };
  const secao = (t: string, pag: string) => { garantir(14, pag); doc.setTextColor(...NAVY); doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.text(t.toUpperCase(), M, y); doc.setDrawColor(...BLUE); doc.setLineWidth(0.6); doc.line(M, y + 1.5, M + 18, y + 1.5); y += 7; };
  const lista = (itens: string[], pag: string, marca = "•", c: [number, number, number] = INK) => {
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    if (!itens.length) { doc.setTextColor(...MUTED); doc.text("Nenhum item identificado com os dados disponíveis.", M, y); y += 6; return; }
    for (const it of itens) { const l = doc.splitTextToSize(it, CW - 5) as string[]; garantir(l.length * 4.3 + 1, pag); doc.setTextColor(...c); doc.text(marca, M, y); doc.setTextColor(...INK); doc.text(l, M + 4, y); y += l.length * 4.3 + 1.2; }
    y += 2;
  };
  const tabela = (head: string[], body: (string | number)[][], pag: string, opts: Record<string, unknown> = {}) => {
    autoTable(doc, { startY: y, head: [head], body: body.map((r) => r.map(String)), margin: { left: M, right: M, top: 35 }, theme: "grid",
      styles: { fontSize: 8, cellPadding: 1.6, textColor: INK, lineColor: [220, 224, 230] }, headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: GRAY }, rowPageBreak: "avoid", didDrawPage: (d: { pageNumber: number }) => { if (d.pageNumber > 1 && doc.getCurrentPageInfo().pageNumber !== 1) { /* cabeçalho já existente */ } }, ...opts });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6; void pag;
  };
  const kpi = (x: number, w: number, rot: string, val: string, sub: string, p: number | null) => {
    doc.setFillColor(...GRAY); doc.roundedRect(x, y, w, 24, 2, 2, "F");
    doc.setFillColor(...(p === null ? BLUE : cor(p))); doc.rect(x, y, 1.4, 24, "F");
    doc.setTextColor(...MUTED); doc.setFontSize(7); doc.setFont("helvetica", "bold"); doc.text(rot.toUpperCase(), x + 4, y + 5.5);
    doc.setTextColor(...NAVY); doc.setFontSize(13); doc.text(val, x + 4, y + 13);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(...MUTED); doc.text(doc.splitTextToSize(sub, w - 6) as string[], x + 4, y + 18);
  };
  const barra = (x: number, w: number, p: number) => { doc.setFillColor(225, 229, 235); doc.roundedRect(x, y, w, 2.6, 1.3, 1.3, "F"); doc.setFillColor(...cor(p)); doc.roundedRect(x, y, Math.max(w * Math.min(p, 1), 1), 2.6, 1.3, 1.3, "F"); };

  // Página 1
  const P1 = "Resumo Executivo";
  header("Relatório Executivo de Pós-Venda");
  const kw = (CW - 8) / 3;
  const antTot = e.ant ? e.ant.s + e.ant.p : 0;
  kpi(M, kw, "Faturamento total", brl(a.total), a.meta ? `${pct(a.ating)} da meta ${brl(a.meta)}` : "Meta não cadastrada", a.meta ? div(a.pT, a.meta) : null);
  kpi(M + kw + 4, kw, "Mão de obra (serviços)", brl(e.t.s), e.t.ms ? `${pct(div(e.t.s, e.t.ms))} da meta ${brl(e.t.ms)}` : "Meta não cadastrada", e.t.ms ? div(a.pS, e.t.ms) : null);
  kpi(M + 2 * (kw + 4), kw, "Peças", brl(e.t.p), e.t.mp ? `${pct(div(e.t.p, e.t.mp))} da meta ${brl(e.t.mp)}` : "Meta não cadastrada", e.t.mp ? div(a.pP, e.t.mp) : null);
  y += 28;
  kpi(M, kw, "NPS", e.nps ? pct(e.nps.nps) : "—", e.nps ? `${pct(e.nps.pctProm)} promotores · ${e.nps.avaliados} avaliações` : "Sem pesquisa importada", e.nps ? div(e.nps.pctProm, 0.85) : null);
  kpi(M + kw + 4, kw, "Agenda do mês", e.agenda ? String(e.agenda.d0) : "—", e.agenda ? `${e.agenda.dias} dia(s) · meta ${e.agenda.metaDiaria || "—"}/dia` : "Sem agenda importada", e.agenda && e.agenda.metaDiaria ? div(div(e.agenda.d0, e.agenda.dias), e.agenda.metaDiaria) : null);
  kpi(M + 2 * (kw + 4), kw, "O.S. no pátio", e.os.abertas ? String(e.os.abertas) : "—", e.os.abertas ? `${e.os.parados} > 30 dias · média ${num(e.os.mediaDias, 0)} dias` : "Sem Controle O.S.", e.os.abertas ? (e.os.parados ? 0 : 1) : null);
  y += 32;

  if (e.modo === "acompanhamento" && a.meta) {
    secao("Ritmo do mês", P1);
    doc.setFontSize(9); doc.setTextColor(...INK);
    doc.text(`Mês decorrido: ${e.dec} de ${e.tot} dias ${e.base === "uteis" ? "úteis" : "corridos"} (${pct(a.ritmo)})   |   Atingimento: ${pct(a.ating)}   |   Diferença: ${a.ating >= a.ritmo ? "+" : ""}${num((a.ating - a.ritmo) * 100, 1)} p.p.`, M, y); y += 4;
    barra(M, CW, a.ating); doc.setDrawColor(...NAVY); doc.setLineWidth(0.5); doc.line(M + CW * Math.min(a.ritmo, 1), y - 1, M + CW * Math.min(a.ritmo, 1), y + 3.6); y += 9;
  }
  secao("Meta × realizado", P1);
  const proj = e.modo === "fechamento";
  tabela(["Indicador", "Realizado", "Meta", "% atingido", proj ? "Diferença" : "Projeção", "Mês anterior*"], [
    ["Mão de obra", brl(e.t.s), brl(e.t.ms), pct(div(e.t.s, e.t.ms)), proj ? brl(e.t.s - e.t.ms) : brl(a.pS), e.ant ? brl(e.ant.s) : "—"],
    ["Peças", brl(e.t.p), brl(e.t.mp), pct(div(e.t.p, e.t.mp)), proj ? brl(e.t.p - e.t.mp) : brl(a.pP), e.ant ? brl(e.ant.p) : "—"],
    ["Total Pós-Venda", brl(a.total), brl(a.meta), pct(a.ating), proj ? brl(a.total - a.meta) : brl(a.pT), antTot ? brl(antTot) : "—"],
  ], P1);
  doc.setFontSize(7); doc.setTextColor(...MUTED); doc.text(`* Mês anterior até o dia ${e.diaCorte || "—"}, mesmo critério do Dashboard.`, M, y - 3); y += 2;
  secao("Resumo gerencial", P1);
  doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor(...BLUE); doc.text("FATOS (calculados a partir dos dados)", M, y); y += 4.5;
  lista(a.fato, P1, "■", BLUE);
  if (a.interp.length) { doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor(...NAVY); doc.text("INTERPRETAÇÃO GERENCIAL", M, y); y += 4.5; lista(a.interp, P1, "›", NAVY); }

  // Página 2
  const P2 = "Desempenho Operacional e Comercial";
  novaPagina(P2);
  secao("BMW Carros × BMW Motorrad", P2);
  const sg = a.segmentos;
  tabela(["Segmento", "Consultores", "Faturamento", "Meta", "% atingido"], [
    ["Carros", sg.carro.n, brl(sg.carro.v), brl(sg.carro.meta), pct(div(sg.carro.v, sg.carro.meta))],
    ["Motos (Pedro/Gilberto)", sg.moto.n, brl(sg.moto.v), brl(sg.moto.meta), pct(div(sg.moto.v, sg.moto.meta))],
  ], P2);
  secao("Desempenho dos consultores", P2);
  tabela(["Consultor", "Depto", "Serviços", "Peças", "Total", "Meta", "% meta", "Projeção", "Peças/R$1 M.O."],
    [...e.consultores].sort((x, z) => z.perf - x.perf).map((c) => [c.nome, c.dept, brl(c.s), brl(c.p), brl(c.s + c.p), brl(c.mS + c.mP), pct(c.perf), pct(c.projPct), c.s ? `R$ ${num(div(c.p, c.s))}` : "—"]), P2,
    { didParseCell: (d: { section: string; column: { index: number }; row: { raw: unknown }; cell: { styles: { textColor: unknown; fontStyle: string } } }) => {
      if (d.section === "body" && d.column.index === 7) { const c = [...e.consultores].sort((x, z) => z.perf - x.perf)[(d.row as unknown as { index: number }).index]; if (c) { d.cell.styles.textColor = cor(c.projPct); d.cell.styles.fontStyle = "bold"; } }
    } });
  if (e.depts.length) { secao("Departamentos", P2); tabela(["Departamento", "Realizado", "Meta", "Projeção % meta"], e.depts.map((d) => [d.nome, brl(d.v), brl(d.meta), pct(d.projPct)]), P2); }
  secao("Oficina, O.S. e qualidade", P2);
  tabela(["Indicador", "Valor"], [
    ["Passagens no mês", e.pass ? String(e.pass) : "Indisponível"],
    ["Ticket médio de serviço", e.pass ? brl(div(e.t.s, e.pass)) : "Indisponível"],
    ["Ticket médio de peças", e.pass ? brl(div(e.t.p, e.pass)) : "Indisponível"],
    ["Peças por R$ 1 de M.O. (loja)", e.t.s ? `R$ ${num(a.ratio)} (ideal R$ 2,50–3,50)` : "Indisponível"],
    ["Técnicos · serviços × meta", e.mec.ms ? `${brl(e.mec.s)} de ${brl(e.mec.ms)} (${pct(div(e.mec.s, e.mec.ms))})` : "Indisponível"],
    ["Retornos ≤ 60 dias", e.retornos === null ? "Indisponível" : `${e.retornos}${e.pass ? ` (${pct(div(e.retornos, e.pass))} das passagens)` : ""}`],
    ["O.S. abertas no pátio", e.os.abertas ? `${e.os.abertas} · ${e.os.amarelos} entre 21–30 dias · ${e.os.parados} > 30 dias` : "Indisponível"],
    ...e.os.fluxo.map((f) => [`  · ${f.st}`, String(f.n)]),
    ["O.S. abertas (valor a faturar)", e.os.os + e.os.op ? brl(e.os.os + e.os.op) : "—"],
  ], P2);
  if (e.agenda) {
    secao("Agendamentos", P2);
    tabela(["Indicador", "Valor"], [
      ["Veículos na agenda do dia (acumulado)", `${e.agenda.d0} em ${e.agenda.dias} dia(s) · Carros ${e.agenda.carro} · Motos ${e.agenda.moto}`],
      ["Mix", `Revisão ${e.agenda.rev} · Diagnóstico ${e.agenda.diag} · Recall ${e.agenda.recall}`],
      ["Média diária × meta", `${num(div(e.agenda.d0, e.agenda.dias), 1)} × ${e.agenda.metaDiaria || "sem meta"}`],
      ["Aproveitamento (efetivados/encerrados)", e.agenda.d0 ? `${e.agenda.d0Atendidos} de ${e.agenda.d0} (${pct(div(e.agenda.d0Atendidos, e.agenda.d0))})` : "—"],
      ["Agendamentos D+1 importados", String(e.agenda.d1)],
    ], P2);
  }
  if (e.agg.length) { secao("Agregados", P2); tabela(["Família", "Unidades", "Faturamento", "Meta un.", "Projeção un."], e.agg.map((g) => [g.nome, String(Math.round(g.q)), brl(g.v), g.mq ? String(Math.round(g.mq)) : "—", String(Math.round(projetar(g.q, e.dec, e.tot)))]), P2); }
  secao("Destaques positivos", P2); lista(a.positivos, P2, "▲", GREEN);

  // Página 3
  const P3 = "Diagnóstico e Oportunidades";
  novaPagina(P3);
  secao("Principais desvios e riscos (fatos)", P3); lista(a.riscos, P3, "▼", RED);
  secao("Oportunidades identificadas", P3); lista(a.oport, P3, "◆", BLUE);
  if (e.nps) {
    secao("NPS · ranking de reclamações (neutros e detratores)", P3);
    if (a.motivos.length) tabela(["Motivo", "Ocorrências"], a.motivos.slice(0, 8).map(([m, n]) => [m, String(n)]), P3);
    else lista([], P3);
    doc.setFontSize(8); doc.setTextColor(...MUTED); doc.text(`Promotores ${e.nps.prom} · neutros ${e.nps.neu} · detratores ${e.nps.det} · RACs ${e.nps.racs}`, M, y - 2); y += 4;
  }
  if (a.indisp.length) { secao("Indicadores não calculados por falta de dados", P3); lista(a.indisp, P3, "○", MUTED); }

  // Página 4
  const P4 = "Plano de Ação e Encerramento";
  novaPagina(P4);
  secao("Plano de ação priorizado (recomendações)", P4);
  if (a.acoes.length) tabela(["#", "Ação recomendada", "Indicador", "Meta / esperado", "Prior.", "Prazo", "Responsável"],
    a.acoes.map((x, i) => [String(i + 1), x.acao, x.indicador, x.alvo, x.prioridade, x.prazo, x.resp]), P4,
    { columnStyles: { 0: { cellWidth: 6 }, 1: { cellWidth: 58 }, 4: { cellWidth: 12 } },
      didParseCell: (d: { section: string; column: { index: number }; cell: { raw: unknown; styles: { textColor: unknown; fontStyle: string } } }) => { if (d.section === "body" && d.column.index === 4) { d.cell.styles.textColor = d.cell.raw === "Alta" ? RED : YEL; d.cell.styles.fontStyle = "bold"; } } });
  else lista(["Nenhum desvio exigiu ação com os dados disponíveis."], P4);
  doc.setFontSize(7); doc.setTextColor(...MUTED); doc.text("Responsáveis atribuídos por função; ajuste conforme a escala da equipe.", M, y - 3); y += 3;
  secao("Conclusão executiva", P4);
  doc.setFontSize(9.5); doc.setTextColor(...INK); const cl = doc.splitTextToSize(a.conclusao, CW) as string[]; garantir(cl.length * 5, P4); doc.text(cl, M, y); y += cl.length * 5 + 10;
  garantir(40, P4);
  doc.setFillColor(...GRAY); doc.roundedRect(M, y, 90, 34, 2, 2, "F"); doc.setFillColor(...NAVY); doc.rect(M, y, 1.6, 34, "F");
  doc.setDrawColor(...MUTED); doc.setLineWidth(0.3); doc.line(M + 6, y + 15, M + 82, y + 15);
  doc.setTextColor(...NAVY); doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.text("Kledson Souza", M + 6, y + 21);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...INK); doc.text("Gerente de Pós-Venda", M + 6, y + 26); doc.text("Haus Salvador", M + 6, y + 30.5);

  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) { doc.setPage(i); doc.setFontSize(7); doc.setTextColor(...MUTED); doc.text("Relatório gerado a partir dos dados importados no sistema. Fatos, interpretações e recomendações estão identificados separadamente.", M, 291); doc.text(`Página ${i} de ${n}`, W - M, 291, { align: "right" }); }
  return doc.output("blob");
}
