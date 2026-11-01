/** Desenha o Relatório Executivo em PDF (A4, layout BMW do modelo aprovado). Importar só no navegador (dynamic import). */
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { analisar, brl, div, num, pct, projetar, type EntradaRel } from "@/lib/relatorio-executivo";

type RGB = [number, number, number];
const NAVY: RGB = [8, 27, 51], NAVY2: RGB = [16, 42, 74], BLUE: RGB = [0, 102, 177], SKY: RGB = [120, 190, 240];
const PAPER: RGB = [246, 248, 251], LINE: RGB = [222, 228, 236], INK: RGB = [24, 32, 44], MUTED: RGB = [105, 115, 130];
const GREEN: RGB = [24, 160, 90], YEL: RGB = [222, 155, 0], RED: RGB = [210, 50, 50], WHITE: RGB = [255, 255, 255];
const cor = (p: number) => (p >= 1 ? GREEN : p >= 0.85 ? YEL : RED);
const mil = (v: number) => (Math.abs(v) >= 1e6 ? `R$ ${num(v / 1e6, 2)} mi` : Math.abs(v) >= 1e3 ? `R$ ${num(v / 1e3, 0)} mil` : brl(v));

export function gerarPdf(e: EntradaRel, capa?: string): Blob {
  const a = analisar(e);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, H = 297, M = 14, CW = W - 2 * M;
  const [yy, mm] = e.mes.split("-").map(Number);
  const mesNome = new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(new Date(yy!, mm! - 1, 1));
  const mesCap = `${mesNome[0]!.toUpperCase()}${mesNome.slice(1)}/${yy}`;
  const fech = e.modo === "fechamento";
  const titulo = fech ? "RELATÓRIO DE FECHAMENTO MENSAL" : "RELATÓRIO DE ACOMPANHAMENTO MENSAL";
  const gerado = e.geradoEm.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  let y = 0;

  const fill = (c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
  const txt = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);
  const font = (s: number, b = false) => { doc.setFont("helvetica", b ? "bold" : "normal"); doc.setFontSize(s); };
  const alpha = (o: number) => doc.setGState(new (doc as unknown as { GState: new (x: object) => object }).GState({ opacity: o }) as never);
  const roundel = (cx: number, cy: number, r: number, claro = true) => {
    fill(claro ? WHITE : NAVY); doc.circle(cx, cy, r, "F");
    fill(claro ? NAVY : WHITE); doc.circle(cx, cy, r * 0.86, "F");
    fill(WHITE); doc.circle(cx, cy, r * 0.6, "F");
    fill(BLUE); doc.triangle(cx, cy, cx, cy - r * 0.6, cx - r * 0.6, cy, "F"); doc.circle(cx, cy, 0, "F");
    // quadrantes azuis (sup. esq. e inf. dir.) aproximados por setores
    doc.lines([[0, -r * 0.6], [0, 0]], cx, cy);
    sector(cx, cy, r * 0.6, Math.PI, 1.5 * Math.PI); sector(cx, cy, r * 0.6, 0, 0.5 * Math.PI);
    doc.setDrawColor(150, 160, 175); doc.setLineWidth(0.15); doc.circle(cx, cy, r * 0.6, "S");
    txt(claro ? WHITE : NAVY); font(r * 1.15, true);
    doc.text("B", cx - r * 0.45, cy - r * 0.62, { angle: 28 }); doc.text("M", cx - r * 0.13, cy - r * 0.68); doc.text("W", cx + r * 0.3, cy - r * 0.58, { angle: -28 });
  };
  const sector = (cx: number, cy: number, r: number, a0: number, a1: number) => {
    fill(BLUE); const n = 16; for (let i = 0; i < n; i++) { const t0 = a0 + ((a1 - a0) * i) / n, t1 = a0 + ((a1 - a0) * (i + 1)) / n; doc.triangle(cx, cy, cx + r * Math.cos(t0), cy + r * Math.sin(t0), cx + r * Math.cos(t1), cy + r * Math.sin(t1), "F"); }
  };
  const header = () => {
    fill(WHITE); doc.rect(0, 0, W, H, "F");
    roundel(M + 7, 15, 7, false);
    txt(NAVY); font(12, true); doc.text("BMW", M + 18, 14); font(10); doc.text("PÓS-VENDA", M + 18, 19);
    txt(MUTED); font(7.5); doc.text(titulo, W - M, 12, { align: "right" }); txt(INK); font(8, true); doc.text(`Pós-Venda BMW  |  ${mesCap}`, W - M, 17, { align: "right" });
    doc.setDrawColor(...LINE); doc.setLineWidth(0.3); doc.line(M, 26, W - M, 26); y = 35;
  };
  const nova = () => { doc.addPage(); header(); };
  const garantir = (h: number) => { if (y + h > H - 18) nova(); };
  const secao = (n: number, t: string) => { garantir(16); txt(NAVY); font(12.5, true); doc.text(`${n}.  ${t.toUpperCase()}`, M, y); y += 7; };
  const wrap = (s: string, w: number) => doc.splitTextToSize(s, w) as string[];
  const ultimo = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  const tabela = (head: string[], body: string[][], opts: Record<string, unknown> = {}) => {
    autoTable(doc, { startY: y, head: [head], body, margin: { left: M, right: M, top: 32, bottom: 18 }, theme: "plain",
      styles: { fontSize: 7.8, cellPadding: { top: 2.4, bottom: 2.4, left: 2.2, right: 2.2 }, textColor: INK, lineColor: LINE, lineWidth: { bottom: 0.25 } as never, valign: "middle" },
      headStyles: { fillColor: PAPER, textColor: NAVY, fontStyle: "bold", lineWidth: { bottom: 0.4 } as never, lineColor: BLUE },
      rowPageBreak: "avoid", willDrawPage: (d: { pageNumber: number }) => { if (d.pageNumber > 1) header(); }, ...opts });
    y = ultimo() + 7;
  };

  // ===== Página 1 — capa e resumo =====
  const BH = 74;
  fill(NAVY); doc.rect(0, 0, W, BH, "F");
  if (capa) { alpha(0.9); doc.addImage(capa, "JPEG", 0, 0, W, BH); alpha(1); }
  for (let i = 0; i < 30; i++) { alpha(0.92 - i * 0.03); fill(NAVY); doc.rect(i * 4, 0, 4.2, BH, "F"); }
  alpha(1);
  fill(BLUE); doc.rect(0, BH, W, 1, "F");
  roundel(M + 9, 17, 9);
  txt(WHITE); font(15, true); doc.text("BMW", M + 22, 15.5); font(12); doc.text("PÓS-VENDA", M + 22, 22);
  font(6.5, true); doc.text(["MAIS QUE", "UM SERVIÇO,", "UMA RELAÇÃO", "DE CONFIANÇA."], W - M, 10, { align: "right" });
  doc.setDrawColor(255, 255, 255); doc.setLineWidth(0.15); doc.line(0, 33, 120, 33);
  font(19, true); doc.text(wrap(titulo, 120), M, 45);
  font(11); doc.text(`Pós-Venda BMW  |  ${mesCap}`, M, 62); font(8); doc.text(`Haus Salvador · Filtro: ${e.filtro} · Gerado em ${gerado}`, M, 68.5);

  y = BH + 12;
  secao(1, "Resumo executivo");
  const colL = 98, cardX = M + colL + 6, cardW = CW - colL - 6, yRes = y - 6;
  font(8.4); txt(INK);
  const resumo = [...a.fato.slice(0, 3), ...a.interp.slice(0, 1)];
  let yl = y; for (const s of resumo) { const l = wrap(s, colL); doc.text(l, M, yl); yl += l.length * 3.9 + 2.2; }
  // cartão faturamento total
  fill(NAVY); doc.roundedRect(cardX, yRes, cardW, 46, 1.5, 1.5, "F");
  txt(SKY); font(6.5, true); doc.text("FATURAMENTO TOTAL", cardX + 5, yRes + 7);
  txt(WHITE); font(15, true); doc.text(mil(a.total), cardX + 5, yRes + 15);
  font(7.5); txt(GREEN); doc.text(a.meta ? `${pct(a.ating)} da meta` : "sem meta", cardX + 5, yRes + 20.5);
  const antT = e.ant ? e.ant.s + e.ant.p : 0;
  txt(WHITE); if (antT) doc.text(`|  ${a.total >= antT ? "+" : ""}${pct(div(a.total, antT) - 1)} vs. mês ant.`, cardX + 26, yRes + 20.5);
  doc.setDrawColor(60, 85, 120); doc.line(cardX + 4, yRes + 25, cardX + cardW - 4, yRes + 25); doc.line(cardX + cardW / 2, yRes + 27, cardX + cardW / 2, yRes + 43);
  const mini = (x: number, rot: string, v: number, m: number) => { txt(SKY); font(6, true); doc.text(rot, x, yRes + 31); txt(WHITE); font(10.5, true); doc.text(mil(v), x, yRes + 37.5); font(6.5); txt(m ? cor(div(v, m)) : MUTED); doc.text(m ? `${pct(div(v, m))} da meta` : "sem meta", x, yRes + 42); };
  mini(cardX + 5, "SERVIÇOS", e.t.s, e.t.ms); mini(cardX + cardW / 2 + 4, "PEÇAS", e.t.p, e.t.mp);
  y = Math.max(yl, yRes + 46) + 6;

  // faixa de KPIs (2 × 4)
  const kpis: [string, string][] = [
    [fech ? "RESULTADO" : "PROJEÇÃO", fech ? mil(a.total) : mil(a.pT)], ["TICKET MÉDIO", e.pass ? brl(div(a.total, e.pass)) : "—"],
    ["PASSAGENS", e.pass ? String(e.pass) : "—"], ["PEÇAS / R$1 M.O.", e.t.s ? `R$ ${num(a.ratio)}` : "—"],
    ["NPS", e.nps ? pct(e.nps.nps) : "—"], ["PROMOTORES", e.nps ? pct(e.nps.pctProm) : "—"],
    ["O.S. NO PÁTIO", e.os.abertas ? String(e.os.abertas) : "—"], ["AGENDA (VEÍC.)", e.agenda ? String(e.agenda.d0) : "—"],
  ];
  const kw = CW / 4, kh = 15;
  fill(NAVY); doc.roundedRect(M, y, CW, kh * 2, 1.5, 1.5, "F");
  kpis.forEach(([r, v], i) => { const x = M + (i % 4) * kw, yy2 = y + Math.floor(i / 4) * kh; txt(SKY); font(6, true); doc.text(r, x + 4, yy2 + 5.5); txt(WHITE); font(10, true); doc.text(v, x + 4, yy2 + 11.5); });
  doc.setDrawColor(45, 70, 105); doc.setLineWidth(0.2); for (let i = 1; i < 4; i++) doc.line(M + i * kw, y + 2, M + i * kw, y + kh * 2 - 2); doc.line(M + 2, y + kh, M + CW - 2, y + kh);
  y += kh * 2 + 10;

  secao(2, "Desempenho por setor");
  const setores: { n: string; f: string; m: string; at: number | null; d: string; p: string }[] = [
    { n: "Serviços", f: mil(e.t.s), m: e.t.ms ? mil(e.t.ms) : "—", at: e.t.ms ? div(e.t.s, e.t.ms) : null, d: fech ? `Diferença ${mil(e.t.s - e.t.ms)}` : `Projeção ${mil(a.pS)}`, p: e.t.ms && div(a.pS, e.t.ms) < 1 ? `Faltam ${mil(Math.max(e.t.ms - e.t.s, 0))}` : "No ritmo da meta" },
    { n: "Peças", f: mil(e.t.p), m: e.t.mp ? mil(e.t.mp) : "—", at: e.t.mp ? div(e.t.p, e.t.mp) : null, d: e.t.s ? `R$ ${num(a.ratio)} por R$1 de M.O.` : "—", p: e.t.s && a.ratio < 2.5 ? "Abaixo da faixa BMW 2,50–3,50" : "Dentro da faixa BMW" },
    { n: "Oficina", f: e.mec.ms ? mil(e.mec.s) : "—", m: e.mec.ms ? mil(e.mec.ms) : "—", at: e.mec.ms ? div(e.mec.s, e.mec.ms) : null, d: e.retornos === null ? "Retornos indisponíveis" : `${e.retornos} retorno(s) até 60 dias`, p: e.mec.ms ? "" : "Sem dados de técnicos" },
    { n: "Clientes / NPS", f: "—", m: "85% prom.", at: e.nps ? div(e.nps.pctProm, 0.85) : null, d: e.nps ? `NPS ${pct(e.nps.nps)} · ${e.nps.avaliados} avaliações` : "Sem pesquisa importada", p: e.nps ? `${e.nps.det} detrator(es) · ${e.nps.racs} RAC(s)` : "" },
    { n: "Ordens de Serviço", f: e.os.os + e.os.op ? mil(e.os.os + e.os.op) : "—", m: "—", at: null, d: e.os.abertas ? `${e.os.abertas} abertas · média ${num(e.os.mediaDias, 0)} dias` : "Sem Controle O.S.", p: e.os.parados ? `${e.os.parados} O.S. > 30 dias` : "" },
    { n: "Agendamentos", f: "—", m: e.agenda?.metaDiaria ? `${e.agenda.metaDiaria}/dia` : "—", at: e.agenda?.metaDiaria ? div(div(e.agenda.d0, e.agenda.dias), e.agenda.metaDiaria) : null, d: e.agenda ? `${num(div(e.agenda.d0, e.agenda.dias), 1)} veíc./dia · Carros ${e.agenda.carro} · Motos ${e.agenda.moto}` : "Sem agenda importada", p: e.agenda?.d0 ? `Aproveitamento ${pct(div(e.agenda.d0Atendidos, e.agenda.d0))}` : "" },
  ];
  tabela(["Setor", "Faturamento", "Meta", "Atingimento", "Principais destaques", "Pontos de atenção"], setores.map((s) => [s.n, s.f, s.m, s.at === null ? "—" : pct(s.at), s.d, s.p || "—"]), {
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 28 }, 1: { cellWidth: 22 }, 2: { cellWidth: 20 }, 3: { cellWidth: 20, halign: "center", fontStyle: "bold" } },
    didParseCell: (d: { section: string; column: { index: number }; row: { index: number }; cell: { styles: { textColor: unknown } } }) => { if (d.section === "body" && d.column.index === 3) { const at = setores[d.row.index]?.at; if (at !== null && at !== undefined) d.cell.styles.textColor = cor(at); } },
  });

  // ===== Página 2 — consultores e análise por aba =====
  nova();
  secao(3, "Desempenho individual dos consultores");
  const cons = [...e.consultores].filter((c) => c.s + c.p + c.mS + c.mP > 0).sort((x, z) => z.perf - x.perf);
  const aval = (c: (typeof cons)[number]) => c.mS + c.mP === 0 ? "Sem meta cadastrada." : c.projPct >= 1 ? (c.perf === cons[0]?.perf ? "Destaque geral." : "No ritmo da meta.") : c.projPct >= 0.85 ? "Atenção: próximo da meta, acelerar." : "Principal necessidade de acompanhamento.";
  autoTable(doc, { startY: y, margin: { left: M, right: M, top: 32, bottom: 18 }, theme: "plain",
    head: [["", "Consultor", "M.O.", "Peças", "Total", "Projeção", "Peças/M.O.", "Avaliação"]],
    body: cons.map((c) => ["", c.nome, c.mS ? pct(div(c.s, c.mS)) : brl(c.s), c.mP ? pct(div(c.p, c.mP)) : brl(c.p), brl(c.s + c.p), c.mS + c.mP ? pct(c.projPct) : "—", c.s ? `R$ ${num(div(c.p, c.s))}` : "—", aval(c)]),
    styles: { fontSize: 7.8, cellPadding: { top: 3, bottom: 3, left: 2, right: 2 }, textColor: INK, valign: "middle", lineColor: LINE, lineWidth: { bottom: 0.25 } as never },
    headStyles: { fillColor: NAVY, textColor: WHITE, fontStyle: "bold" }, rowPageBreak: "avoid",
    columnStyles: { 0: { cellWidth: 9 }, 1: { fontStyle: "bold", cellWidth: 30 }, 2: { halign: "center" }, 3: { halign: "center" }, 5: { halign: "center", fontStyle: "bold" }, 7: { cellWidth: 46 } },
    willDrawPage: (d: { pageNumber: number }) => { if (d.pageNumber > 1) header(); },
    didParseCell: (d: { section: string; column: { index: number }; row: { index: number }; cell: { styles: { textColor: unknown } } }) => {
      const c = cons[d.row.index]; if (d.section !== "body" || !c) return;
      if (d.column.index === 2 && c.mS) d.cell.styles.textColor = cor(div(c.s, c.mS));
      if (d.column.index === 3 && c.mP) d.cell.styles.textColor = cor(div(c.p, c.mP));
      if (d.column.index === 5 && c.mS + c.mP) d.cell.styles.textColor = cor(c.projPct);
    },
    didDrawCell: (d: { section: string; column: { index: number }; row: { index: number }; cell: { x: number; y: number; height: number } }) => {
      const c = cons[d.row.index]; if (d.section !== "body" || d.column.index !== 0 || !c) return;
      const cx = d.cell.x + 4.5, cy = d.cell.y + d.cell.height / 2; fill(NAVY); doc.circle(cx, cy, 3.3, "F"); txt(WHITE); font(6, true); doc.text(c.nome.slice(0, 2).toUpperCase(), cx, cy + 0.9, { align: "center" });
      fill(cor(c.mS + c.mP ? c.projPct : 1)); doc.circle(d.cell.x + d.cell.height * 0 + 7.6, cy - 2.4, 0.9, "F");
    } });
  y = ultimo() + 9;

  secao(4, "Análise por aba");
  const cards: { t: string; c: RGB; b: [string, boolean][] }[] = [
    { t: "DASHBOARD", c: BLUE, b: [[a.meta ? `Resultado em ${pct(a.ating)} da meta.` : "Meta não cadastrada.", a.ating >= (fech ? 1 : a.ritmo)], [antT ? `${a.total >= antT ? "Crescimento" : "Queda"} de ${pct(Math.abs(div(a.total, antT) - 1))} vs. mês anterior.` : "Sem base do mês anterior.", a.total >= antT], [fech ? `Fechamento em ${mil(a.total)}.` : `Projeção de ${mil(a.pT)}.`, div(a.pT, a.meta) >= 1]] },
    { t: "CENTRAL DE GESTÃO", c: [20, 150, 110], b: [[`${a.deptGap.length} departamento(s) abaixo da meta projetada.`, !a.deptGap.length], [e.os.os + e.os.op ? `${mil(e.os.os + e.os.op)} em O.S. abertas a faturar.` : "Sem O.S. abertas importadas.", true], [`${a.abaixo.length} consultor(es) abaixo de 85%.`, !a.abaixo.length]] },
    { t: "OFICINA", c: [130, 70, 190], b: [[e.mec.ms ? `Técnicos em ${pct(div(e.mec.s, e.mec.ms))} da meta de serviços.` : "Sem dados de técnicos.", e.mec.ms ? div(e.mec.s, e.mec.ms) >= 1 : false], [e.retornos === null ? "Retornos não importados." : `${e.retornos} retorno(s) em até 60 dias.`, !e.retornos], [e.os.parados ? `${e.os.parados} O.S. paradas há mais de 30 dias.` : "Nenhuma O.S. acima de 30 dias.", !e.os.parados]] },
    { t: "PEÇAS", c: [230, 140, 20], b: [[e.t.mp ? `${pct(div(e.t.p, e.t.mp))} da meta de peças.` : "Meta de peças não cadastrada.", div(e.t.p, e.t.mp) >= 1], [e.t.s ? `R$ ${num(a.ratio)} de peças por R$1 de M.O.` : "Sem M.O. no período.", a.ratio >= 2.5], [`Ticket de peças ${e.pass ? brl(div(e.t.p, e.pass)) : "indisponível"}.`, true]] },
    { t: "CLIENTES / NPS", c: [210, 40, 80], b: e.nps ? [[`NPS ${pct(e.nps.nps)} · ${pct(e.nps.pctProm)} promotores.`, e.nps.pctProm >= 0.85], [`${e.nps.prom} promotores · ${e.nps.det} detratores.`, e.nps.det === 0], [a.motivos[0] ? `Principal reclamação: ${a.motivos[0][0].toLowerCase()} (${a.motivos[0][1]}).` : "Sem reclamações registradas.", !a.motivos.length]] : [["Sem pesquisa NPS importada.", false]] },
    { t: "ORDENS DE SERVIÇO", c: NAVY2, b: e.os.abertas ? [[`${e.os.abertas} O.S. abertas no pátio.`, true], ...e.os.fluxo.slice(0, 3).map((f) => [`${f.n} ${f.st.toLowerCase()}.`, true] as [string, boolean])] : [["Sem snapshot do Controle O.S.", false]] },
  ];
  const cw3 = (CW - 8) / 3, ch = 44;
  garantir(ch * 2 + 6);
  cards.forEach((c, i) => {
    const x = M + (i % 3) * (cw3 + 4), yc = y + Math.floor(i / 3) * (ch + 4);
    fill(PAPER); doc.roundedRect(x, yc, cw3, ch, 1.5, 1.5, "F");
    fill(c.c); doc.roundedRect(x + 4, yc + 4, 8, 8, 1.2, 1.2, "F"); txt(WHITE); font(7, true); doc.text(c.t.slice(0, 1), x + 8, yc + 9.4, { align: "center" });
    txt(c.c); font(7.6, true); doc.text(c.t, x + 4, yc + 18);
    let yb = yc + 23; font(6.8);
    for (const [s, ok] of c.b) { const l = wrap(s, cw3 - 11); if (yb + l.length * 3 > yc + ch - 1) break; fill(ok ? GREEN : YEL); doc.circle(x + 5.5, yb - 0.9, 0.9, "F"); txt(INK); doc.text(l, x + 8.5, yb); yb += l.length * 3.1 + 1.6; }
  });
  y += ch * 2 + 10;

  // ===== Página 3 — oportunidades e plano =====
  nova();
  secao(5, "Principais oportunidades de melhoria");
  const ops = [...a.riscos.map((t) => ({ t, tipo: "Risco" })), ...a.oport.map((t) => ({ t, tipo: "Oportunidade" }))].slice(0, 7);
  if (!ops.length) { txt(MUTED); font(8.5); doc.text("Nenhum desvio relevante identificado com os dados disponíveis.", M, y); y += 8; }
  for (const o of ops) {
    const l = wrap(o.t, CW - 26); const h = Math.max(15, l.length * 3.8 + 9); garantir(h + 2);
    doc.setDrawColor(...LINE); doc.setLineWidth(0.25); doc.roundedRect(M, y, CW, h, 1.5, 1.5, "S");
    fill(o.tipo === "Risco" ? NAVY : BLUE); doc.circle(M + 9, y + h / 2, 5.2, "F"); txt(WHITE); font(8, true); doc.text(o.tipo === "Risco" ? "!" : "+", M + 9, y + h / 2 + 1.1, { align: "center" });
    txt(NAVY); font(8.8, true); doc.text(o.tipo, M + 18, y + 6); txt(MUTED); font(7.8); doc.text(l, M + 18, y + 10.5);
    y += h + 3;
  }
  y += 4;
  const prox = fech ? new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(new Date(yy!, mm!, 1)).toUpperCase() : mesNome.toUpperCase();
  secao(6, `Plano de ação – ${prox}`);
  if (a.acoes.length) tabela(["Prior.", "Ação recomendada", "Indicador", "Meta / esperado", "Prazo", "Responsável"], a.acoes.map((x) => [x.prioridade, x.acao, x.indicador, x.alvo, x.prazo, x.resp]), {
    columnStyles: { 0: { cellWidth: 13, fontStyle: "bold" }, 1: { cellWidth: 60 }, 3: { fontStyle: "bold" } },
    didParseCell: (d: { section: string; column: { index: number }; cell: { raw: unknown; styles: { textColor: unknown } } }) => { if (d.section === "body" && d.column.index === 0) d.cell.styles.textColor = d.cell.raw === "Alta" ? RED : YEL; },
  });
  else { txt(MUTED); font(8.5); doc.text("Nenhuma ação necessária pelos dados disponíveis.", M, y); y += 8; }
  txt(MUTED); font(6.8); doc.text("Recomendações geradas por regras sobre os desvios calculados; responsáveis atribuídos por função.", M, y - 3); y += 4;
  if (a.indisp.length) { garantir(10 + a.indisp.length * 4.5); txt(NAVY); font(9, true); doc.text("Indicadores não calculados por falta de dados", M, y); y += 5; font(7.6); txt(MUTED); for (const s of a.indisp) { doc.text(`•  ${s}`, M, y); y += 4.3; } }

  // ===== Página 4 — conclusão e assinatura =====
  doc.addPage();
  fill(NAVY); doc.rect(0, 0, W, 30, "F"); roundel(M + 8, 15, 8);
  txt(WHITE); font(13, true); doc.text("BMW", M + 20, 14); font(10.5); doc.text("PÓS-VENDA", M + 20, 20);
  font(7.5); doc.text(titulo, W - M, 13, { align: "right" }); font(8, true); doc.text(`Pós-Venda BMW  |  ${mesCap}`, W - M, 18.5, { align: "right" });
  y = 44;
  secao(7, "Conclusão gerencial");
  txt(INK); font(9.5); const cl = wrap(a.conclusao + (a.positivos[0] ? ` Destaque: ${a.positivos[0]}` : ""), CW); doc.text(cl, M, y); y += cl.length * 4.8 + 8;
  const st: [string, string, number | null][] = [
    ["Faturamento", a.meta ? (div(a.pT, a.meta) >= 1 ? "Acima da meta" : div(a.pT, a.meta) >= 0.85 ? "Atenção à meta" : "Abaixo da meta") : "Sem meta", a.meta ? div(fech ? a.total : a.pT, a.meta) : null],
    ["O.S.", e.os.abertas ? (e.os.parados ? "Necessita ação" : "Sob controle") : "Sem dados", e.os.abertas ? (e.os.parados ? 0 : 1) : null],
    ["Serviços", e.t.ms ? pct(div(fech ? e.t.s : a.pS, e.t.ms)) + " da meta" : "Sem meta", e.t.ms ? div(fech ? e.t.s : a.pS, e.t.ms) : null],
    ["Consultores", a.abaixo.length ? "Performance desigual" : "Equipe no ritmo", a.abaixo.length ? 0.9 : 1],
    ["Peças", e.t.mp ? pct(div(fech ? e.t.p : a.pP, e.t.mp)) + " da meta" : "Sem meta", e.t.mp ? div(fech ? e.t.p : a.pP, e.t.mp) : null],
    ["NPS", e.nps ? (e.nps.pctProm >= 0.85 ? "Excelente" : "Abaixo da meta") : "Sem dados", e.nps ? div(e.nps.pctProm, 0.85) : null],
    ["Oficina", e.mec.ms ? pct(div(e.mec.s, e.mec.ms)) + " da meta" : "Sem dados", e.mec.ms ? div(e.mec.s, e.mec.ms) : null],
    ["Agendamentos", e.agenda?.metaDiaria ? (div(div(e.agenda.d0, e.agenda.dias), e.agenda.metaDiaria) >= 1 ? "Na meta diária" : "Abaixo da meta diária") : "Sem dados", e.agenda?.metaDiaria ? div(div(e.agenda.d0, e.agenda.dias), e.agenda.metaDiaria) : null],
  ];
  const ph = 22 + 4 * 13;
  fill(NAVY); doc.roundedRect(M, y, CW, ph, 2, 2, "F");
  doc.setDrawColor(...SKY); doc.setLineWidth(0.5); doc.circle(M + 11, y + 10, 4.5, "S"); doc.circle(M + 11, y + 10, 2, "S");
  txt(WHITE); font(11, true); doc.text("RESUMO DA GESTÃO", M + 20, y + 11.5);
  st.forEach(([n, s, p], i) => {
    const x = M + 6 + (i % 2) * (CW / 2), yr = y + 22 + Math.floor(i / 2) * 13;
    fill(p === null ? MUTED : cor(p)); doc.circle(x + 3, yr + 1, 2.6, "F"); txt(WHITE); font(6, true); doc.text(p === null ? "-" : p >= 1 ? "OK" : "!", x + 3, yr + 2, { align: "center" });
    font(8.2); doc.text(n, x + 9, yr); txt(p === null ? [170, 180, 195] : p >= 1 ? SKY : cor(p)); font(7.8); doc.text(s, x + 9, yr + 4.5);
  });
  doc.setDrawColor(45, 70, 105); doc.setLineWidth(0.2); doc.line(M + CW / 2, y + 19, M + CW / 2, y + ph - 4);
  y += ph + 14;
  if (capa) { alpha(0.95); doc.addImage(capa, "JPEG", 0, H - 70, W, 73.5); alpha(1); for (let i = 0; i < 30; i++) { alpha(Math.max(0, 1 - i * 0.045)); fill(WHITE); doc.rect(i * 4, H - 70, 4.2, 70, "F"); } alpha(1); }
  txt(BLUE); font(22, true); doc.text("\u201C", M, y + 4); txt(MUTED); doc.setFont("helvetica", "italic"); doc.setFontSize(9.5); doc.text("Juntos por uma experiência cada vez melhor.", M + 8, y + 2);
  y += 22;
  doc.setDrawColor(...INK); doc.setLineWidth(0.3); doc.line(M, y, M + 60, y);
  txt(NAVY); font(10.5, true); doc.text("Kledson Souza", M, y + 6); txt(INK); font(8.5); doc.text("Gerente de Pós-Venda", M, y + 11); doc.text("Haus Salvador", M, y + 15.5);
  roundel(W - M - 30, H - 14, 6); txt(WHITE); font(7.5); doc.text(["Sheer", "Driving Pleasure"], W - M - 22, H - 15);

  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i); if (i === n) continue;
    doc.setDrawColor(...LINE); doc.setLineWidth(0.25); doc.line(M, H - 13, W - M, H - 13);
    txt(NAVY); font(7, true); doc.text("BMW", M, H - 8.5); txt(MUTED); font(6); doc.text("HAUS SALVADOR · dados importados no sistema; fatos, interpretações e recomendações separados", M, H - 5.5);
    txt(BLUE); font(7); doc.text(`${mesCap}  |  ${i}`, W - M, H - 8.5, { align: "right" });
  }
  void projetar;
  return doc.output("blob");
}
