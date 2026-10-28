/** NPS BMW: leitura da planilha da montadora, métricas, metas e ações recomendadas. */

export type Segmento = "carro" | "moto";
export type NpsItem = {
  loja: string; loja_padrao: "1" | "0"; cliente: string; chassi: string; consultor: string;
  fechamento: string; recebimento: string; nota: number | null; status: string;
  telefone: string; obs: string; rac: boolean; motivo: string; veiculo: string; segmento: Segmento; pj: boolean;
};

export const LOJA_PADRAO = "SALVADOR";
/** % mínimo de promotores exigido pela montadora. */
export const META_PROMOTOR: Record<Segmento, number> = { carro: 0.85, moto: 0.88 };

const norm = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();

/** Cliente pessoa jurídica (não é pesquisado pela montadora). */
export function ehPJ(cliente: string, doc = ""): boolean {
  const d = doc.replace(/\D/g, "");
  if (d.length === 14) return true;
  if (d.length === 11) return false;
  return /\b(LTDA|EIRELI|S\/?A|ME|EPP|MEI|CIA|COMERCIO|SERVICOS|LOCADORA|LOCACAO|TRANSPORTES|CONSTRUTORA|ENGENHARIA|EMPREENDIMENTOS|PARTICIPACOES|HOLDING|INDUSTRIA|ASSOCIACAO|CONDOMINIO|GRUPO|AUTOMOVEIS|VEICULOS)\b/.test(norm(cliente));
}

/** Moto BMW Motorrad: chassi WB1/WB3/99Z ou veículo com modelo de moto. */
export function segmentoDe(chassi: string, veiculo: string): Segmento {
  const c = norm(chassi);
  if (/^(WB1|WB3|WB2|99Z)/.test(c)) return "moto";
  if (/\b(R ?1[0-9]{3}|S ?1000|F ?[789]00|G ?310|C ?400|CE ?0[24]|K ?1600|M ?1000|GSA?|RT|XR|RR)\b/.test(norm(veiculo))) return "moto";
  return "carro";
}

const dataISO = (v: unknown): string => {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number" && v > 20000) return new Date(Math.round((v - 25569) * 86400000)).toISOString().slice(0, 10);
  const m = String(v ?? "").match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) return `${m[3]!.length === 2 ? "20" + m[3] : m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
  const iso = String(v ?? "").match(/\d{4}-\d{2}-\d{2}/);
  return iso ? iso[0] : "";
};

/** Lê uma aba (linhas brutas) da planilha NPS; reconhece a fonte pelos cabeçalhos. */
export function lerAbaNps(raw: unknown[][], aba: string): NpsItem[] {
  const hi = raw.findIndex((r) => r.some((c) => norm(c) === "NOTA PSI") && r.some((c) => norm(c) === "CONSULTOR"));
  if (hi < 0) return [];
  const h = raw[hi]!.map(norm);
  const col = (...n: string[]) => h.findIndex((x) => n.includes(x));
  const c = {
    loja: col("LOJA"), cli: col("CLIENTE"), chassi: col("CHASSI"), cons: col("CONSULTOR"), fech: col("FECHAMENTO DA OS", "FECHAMENTO"),
    rec: col("DATA DE RECEBIMENTO", "RECEBIMENTO"), nota: col("NOTA PSI"), tel: col("TELEFONE"), obs: col("OBSERVACAO"),
    rac: col("RAC ABERTA"), mot: col("MOTIVO DA RAC"), vei: col("VEICULO"), doc: col("CPF/CNPJ", "CNPJ", "CPF", "DOCUMENTO"),
  };
  const g = (r: unknown[], i: number) => (i >= 0 ? r[i] : "");
  const out: NpsItem[] = [];
  for (const r of raw.slice(hi + 1)) {
    const cliente = String(g(r, c.cli) ?? "").trim();
    if (!cliente) continue;
    const notaRaw = String(g(r, c.nota) ?? "").trim();
    const n = Number(notaRaw.replace(",", "."));
    const nota = notaRaw !== "" && Number.isFinite(n) && n >= 0 && n <= 10 ? n : null;
    const chassi = String(g(r, c.chassi) ?? "").trim(), veiculo = String(g(r, c.vei) ?? "").trim();
    const lojaAba = norm(aba);
    out.push({
      loja: lojaAba, loja_padrao: lojaAba === LOJA_PADRAO ? "1" : "0", cliente, chassi,
      consultor: norm(g(r, c.cons)), fechamento: dataISO(g(r, c.fech)), recebimento: dataISO(g(r, c.rec)),
      nota, status: nota === null ? norm(notaRaw) : "", telefone: String(g(r, c.tel) ?? "").replace(/\D/g, ""),
      obs: String(g(r, c.obs) ?? "").trim(), rac: norm(g(r, c.rac)) === "SIM", motivo: norm(g(r, c.mot)),
      veiculo, segmento: segmentoDe(chassi, veiculo), pj: ehPJ(cliente, String(g(r, c.doc) ?? "")),
    });
  }
  return out;
}

export type Classe = "promotor" | "neutro" | "detrator";
/** BMW: 1–6 detrator, 7–8 neutro, 9–10 promotor. */
export const classe = (n: number): Classe => (n >= 9 ? "promotor" : n >= 7 ? "neutro" : "detrator");

/** Base válida do NPS: sem pessoa jurídica (não pesquisada). */
export const baseNps = (l: NpsItem[]) => l.filter((x) => !x.pj);

export type Resumo = { avaliados: number; prom: number; neu: number; det: number; nps: number; pctProm: number; racs: number };
export function resumir(l: NpsItem[]): Resumo {
  const b = baseNps(l), av = b.filter((x) => x.nota !== null);
  const prom = av.filter((x) => classe(x.nota!) === "promotor").length, det = av.filter((x) => classe(x.nota!) === "detrator").length;
  const n = av.length;
  return { avaliados: n, prom, neu: n - prom - det, det, nps: n ? (prom - det) / n : 0, pctProm: n ? prom / n : 0, racs: b.filter((x) => x.rac).length };
}

/** Ações de reversão/encantamento conforme o motivo verbalizado. */
const REGRAS: [RegExp, string][] = [
  [/CAFE|AGUA|LANCHE|COPA|RECEP/, "Ao acomodar o cliente, ofereça café e pergunte como ele gosta (forte ou fraco, com ou sem açúcar). Registre a preferência para as próximas visitas."],
  [/DEMORA|PRAZO|ATRAS|ESPERA|TEMPO/, "Combine prazo realista na abertura, mande atualizações proativas pelo WhatsApp e avise antes de qualquer atraso."],
  [/PECA|ESTOQUE/, "Confirme a disponibilidade de peças antes de agendar; se faltar, informe o prazo de chegada e acompanhe até a entrega."],
  [/PRECO|CARO|VALOR|ORCAMENTO/, "Apresente o orçamento detalhado item a item, explique o valor de cada serviço e mostre alternativas e condições de pagamento."],
  [/CONTINUA|RETRABALHO|VOLTOU|NAO RESOLV|DEFEITO/, "Faça teste com o técnico responsável antes da entrega, mostre ao cliente o que foi feito e agende um retorno de confirmação."],
  [/LAVAGEM|LIMP|SUJ/, "Confira a limpeza do veículo antes da entrega e entregue o carro/moto pessoalmente."],
  [/SEMINOV|AVALIA|TROCA/, "Acione o gestor de seminovos para rever a avaliação e retorne ao cliente com a resposta."],
  [/ATENDIMENTO|EDUCA|ATENC|LIGA|CONTATO|RETORNO/, "Faça a recepção pelo nome, explique cada etapa e ligue no dia seguinte à entrega para confirmar a satisfação."],
];
export function acaoReversao(texto: string): string {
  const t = norm(texto);
  return REGRAS.find(([r]) => r.test(t))?.[1] ?? "Ligue para entender a insatisfação, registre o motivo e prepare uma recepção personalizada na próxima visita.";
}
/** Follow-up D-2: conferência, acolhimento e reforço de pessoalidade da nota. */
export function acaoFollowUp(texto: string): string {
  const base = "Ligue para o cliente, confirme que está tudo bem e reforce que a nota avalia exclusivamente o seu atendimento; existe um campo próprio para relatar qualquer situação de outro setor.";
  const t = norm(texto);
  if (/SEMINOV|AVALIA/.test(t)) return "Verifique com seminovos se a avaliação pode ser melhorada e acione o gestor do setor. " + base;
  if (!t) return base;
  return acaoReversao(texto) + " " + base;
}

const dias = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
/** Pesquisas que chegam ao cliente em até 2 dias (sem nota ainda). */
export function filaFollowUp(l: NpsItem[], hoje: string): NpsItem[] {
  return baseNps(l).filter((x) => x.nota === null && x.recebimento && dias(hoje, x.recebimento) >= 0 && dias(hoje, x.recebimento) <= 2)
    .sort((a, b) => a.recebimento.localeCompare(b.recebimento));
}
/** Clientes detratores com nº de passagens e detratações (agrupados por chassi). */
export function historicoDetratores(l: NpsItem[]) {
  const m = new Map<string, { item: NpsItem; passagens: number; detr: number; textos: string[] }>();
  for (const x of baseNps(l)) {
    const k = x.chassi || x.cliente;
    const e = m.get(k) ?? { item: x, passagens: 0, detr: 0, textos: [] };
    e.passagens++;
    if (x.nota !== null && classe(x.nota) === "detrator") { e.detr++; if (x.obs) e.textos.push(x.obs); e.item = x; }
    m.set(k, e);
  }
  return [...m.values()].filter((e) => e.detr > 0).map((e) => ({ ...e, acao: acaoReversao(e.textos.join(" ") + " " + e.item.motivo) }))
    .sort((a, b) => b.detr - a.detr);
}
