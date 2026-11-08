/**
 * Motor de comissões (regras das fichas individuais FUN/AC/MEC).
 * Puro e testado: telas de colaborador e espelho da gestão usam as mesmas funções.
 */
import { feriadosNacionais } from "@/lib/dias-uteis";

const chave = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** DSR de um mês (convenção Sincodiv): (domingos + feriados) ÷ dias úteis (seg–sáb sem feriado). */
export function dsrDoMes(mes: string): number {
  const [y, m] = mes.split("-").map(Number) as [number, number];
  const fer = feriadosNacionais(y);
  const dias = new Date(y, m, 0).getDate();
  let rep = 0, ut = 0;
  for (let d = 1; d <= dias; d++) {
    const dom = new Date(y, m - 1, d).getDay() === 0;
    if (dom || fer.has(chave(y, m, d))) rep++; else ut++;
  }
  return ut ? rep / ut : 0;
}

/** A comissão de um mês é paga com o DSR do mês seguinte. */
export function dsrComissao(mes: string): number {
  const [y, m] = mes.split("-").map(Number) as [number, number];
  return dsrDoMes(m === 12 ? `${y + 1}-01` : chave(y, m + 1, 1).slice(0, 7));
}

export type Degrau = [limite: number, premio: number];
/** Escada de premiação: maior degrau atingido + quanto falta para o próximo. */
export function escada(valor: number | null | undefined, degraus: Degrau[]) {
  const ord = [...degraus].sort((a, b) => a[0] - b[0]);
  if (valor == null || !Number.isFinite(valor)) return { premio: 0, atingido: null as Degrau | null, proximo: ord[0] ?? null, falta: null as number | null };
  let atingido: Degrau | null = null;
  for (const dg of ord) if (valor >= dg[0]) atingido = dg;
  const proximo = ord.find((dg) => valor < dg[0]) ?? null;
  return { premio: atingido?.[1] ?? 0, atingido, proximo, falta: proximo ? proximo[0] - valor : null };
}

/**
 * Trava punitiva do NPS (% promotores): não soma, só valida premiações.
 * Carro: 50% BMW + 50% MINI (meta 85%); marca sem pesquisa conta como atingida. Moto: 100% Motorrad (88%).
 */
export function fatorNps(seg: "carro" | "moto", bmw: number | null, mini: number | null = null): number {
  if (seg === "moto") return bmw == null ? 1 : bmw >= 0.88 ? 1 : 0;
  const ok = (v: number | null) => (v == null || v >= 0.85 ? 0.5 : 0);
  return ok(bmw) + ok(mini);
}

export type Metricas = {
  mo?: number; pecas?: number; margemPct?: number | null; acessorios?: number; ppf?: number;
  ticket?: number | null; volume?: number; fastRepair?: number; limparOk?: boolean | null;
  metaOficinaOk?: boolean | null; npsBmw?: number | null; npsMini?: number | null;
};
export type Premio =
  | { id: string; rotulo: string; tipo: "escada"; metrica: keyof Metricas; degraus: Degrau[]; fmt?: "brl" | "pct" }
  | { id: string; rotulo: string; tipo: "auto"; metrica: keyof Metricas; valor: number }
  | { id: string; rotulo: string; tipo: "gatilho"; valor: number };
export type Perfil = {
  chave: string; nome: string; cargo: string; segmento: "carro" | "moto";
  fixo: number; comissoes: { rotulo: string; base: keyof Metricas; pct: number }[];
  premios: Premio[]; travaNps: boolean; npsAuto?: boolean; dsrSobreComissao: boolean;
};

const MARGEM_SG: Degrau[] = [[0.33, 300], [0.36, 500], [0.4, 700]];
const MARGEM_MOTO: Degrau[] = [[0.31, 300], [0.33, 400], [0.35, 600]];
const MO_MOTO: Degrau[] = [[55000, 300], [66000, 400], [79200, 600]];
const PECAS_TEC: Degrau[] = [[230000, 200], [253000, 300], [276000, 400], [300000, 500]];

const consultor = (chave: string, nome: string, seg: "carro" | "moto", voc: number, extra: Premio[]): Perfil => ({
  chave, nome, cargo: seg === "moto" ? "Consultor SG Moto" : "Consultor SG Carro", segmento: seg, fixo: 0, travaNps: true, dsrSobreComissao: true,
  comissoes: seg === "moto"
    ? [{ rotulo: "Mão de obra", base: "mo", pct: 0.04 }, { rotulo: "Peças", base: "pecas", pct: 0.01 }]
    : [{ rotulo: "Mão de obra", base: "mo", pct: 0.02 }, { rotulo: "Peças", base: "pecas", pct: 0.005 }, { rotulo: "Acessórios", base: "acessorios", pct: 0.03 }, { rotulo: "PPF", base: "ppf", pct: 0.03 }],
  premios: [
    { id: "margem", rotulo: "Margem de peças", tipo: "escada", metrica: "margemPct", degraus: seg === "moto" ? MARGEM_MOTO : MARGEM_SG, fmt: "pct" },
    ...(seg === "moto" ? [{ id: "mo", rotulo: "Escada de M.O. moto", tipo: "escada", metrica: "mo", degraus: MO_MOTO, fmt: "brl" } as Premio] : []),
    { id: "voc", rotulo: "VOC / NPS", tipo: "gatilho", valor: voc },
    ...extra,
  ],
});

/** Fichas oficiais por login (consultores/vendedoras/balcão) ou chave especial. */
export const PERFIS: Record<string, Perfil> = {
  "ANDRESSA.O": consultor("ANDRESSA.O", "Andressa", "carro", 900, [
    { id: "pac", rotulo: "Objetivos PAC (Excellence)", tipo: "gatilho", valor: 1000 },
    { id: "pneus", rotulo: "Venda de pneus (meta 50)", tipo: "gatilho", valor: 400 },
    { id: "limpar", rotulo: "Agregado Limpar (meta)", tipo: "auto", metrica: "limparOk", valor: 500 },
  ]),
  "WESLEY.F": consultor("WESLEY.F", "Wesley", "carro", 650, [
    { id: "pac", rotulo: "Objetivos PAC (Excellence)", tipo: "gatilho", valor: 1000 },
    { id: "limpar", rotulo: "Agregado Limpar (meta)", tipo: "auto", metrica: "limparOk", valor: 500 },
  ]),
  "GILBERTO.S": consultor("GILBERTO.S", "Gilberto", "moto", 600, [{ id: "agreg", rotulo: "Agregados moto", tipo: "gatilho", valor: 400 }]),
  "P.BENIGNO": consultor("P.BENIGNO", "Pedro", "moto", 1000, [{ id: "agreg", rotulo: "Agregados moto", tipo: "gatilho", valor: 400 }]),
  "RENAN.O": {
    chave: "RENAN.O", nome: "Renan", cargo: "Consultor SC Funilaria", segmento: "carro", fixo: 0, travaNps: true, dsrSobreComissao: true,
    comissoes: [{ rotulo: "Mão de obra", base: "mo", pct: 0.02 }, { rotulo: "Peças", base: "pecas", pct: 0.005 }, { rotulo: "Acessórios", base: "acessorios", pct: 0.03 }, { rotulo: "PPF", base: "ppf", pct: 0.05 }],
    premios: [
      { id: "margem", rotulo: "Margem de peças", tipo: "escada", metrica: "margemPct", degraus: [[0.21, 200], [0.23, 300], [0.25, 400]], fmt: "pct" },
      { id: "fast", rotulo: "Fast Repair particular", tipo: "escada", metrica: "fastRepair", degraus: [[20000, 400], [30000, 600]], fmt: "brl" },
      { id: "videos", rotulo: "Share vídeos / cliente conectado", tipo: "gatilho", valor: 500 },
      { id: "notas", rotulo: "Notas lançadas em até 7 dias", tipo: "gatilho", valor: 500 },
      { id: "voc", rotulo: "VOC / NPS", tipo: "gatilho", valor: 900 },
    ],
  },
  NAILTON: {
    chave: "NAILTON", nome: "Nailton", cargo: "Supervisor de Peças (Balcão)", segmento: "carro", fixo: 1600, travaNps: false, dsrSobreComissao: true,
    comissoes: [{ rotulo: "Peças balcão", base: "pecas", pct: 0.03 }],
    premios: [
      { id: "meta", rotulo: "Peças ≥ R$ 90 mil", tipo: "escada", metrica: "pecas", degraus: [[90000, 100]], fmt: "brl" },
      { id: "margem", rotulo: "Margem consolidada ≥ 34%", tipo: "escada", metrica: "margemPct", degraus: [[0.34, 200]], fmt: "pct" },
    ],
  },
  THIERRY: {
    chave: "THIERRY", nome: "Thierry", cargo: "Estoquista (Balcão)", segmento: "carro", fixo: 1600, travaNps: false, dsrSobreComissao: true,
    comissoes: [{ rotulo: "Peças balcão", base: "pecas", pct: 0.015 }],
    premios: [
      { id: "meta", rotulo: "Peças ≥ R$ 90 mil", tipo: "escada", metrica: "pecas", degraus: [[90000, 100]], fmt: "brl" },
      { id: "margem", rotulo: "Margem consolidada", tipo: "escada", metrica: "margemPct", degraus: [[0.33, 150], [0.34, 200]], fmt: "pct" },
    ],
  },
  "GEOVANA.M": {
    chave: "GEOVANA.M", nome: "Geovana", cargo: "Vendedora de Acessórios", segmento: "carro", fixo: 0, travaNps: false, dsrSobreComissao: true,
    comissoes: [{ rotulo: "Acessórios", base: "volume", pct: 0.03 }],
    premios: [
      { id: "ticket", rotulo: "Ticket médio acessórios", tipo: "escada", metrica: "ticket", degraus: [[6000, 100], [6600, 200], [7260, 300], [7986, 400]], fmt: "brl" },
      { id: "margem", rotulo: "Margem de acessórios", tipo: "escada", metrica: "margemPct", degraus: [[0.33, 100], [0.35, 200], [0.36, 300], [0.38, 400]], fmt: "pct" },
      { id: "volume", rotulo: "Meta de venda de acessórios", tipo: "escada", metrica: "volume", degraus: [[204000, 100], [224400, 200], [246840, 300], [271524, 400]], fmt: "brl" },
    ],
  },
  "MARCELA.S": {
    chave: "MARCELA.S", nome: "Marcela", cargo: "Consultora de Estética", segmento: "carro", fixo: 0, travaNps: false, dsrSobreComissao: true,
    comissoes: [{ rotulo: "Estética faturada", base: "volume", pct: 0.025 }], premios: [],
  },
  DELMIR: {
    chave: "DELMIR", nome: "Delmir Xavier", cargo: "Chefe de Oficina Carro", segmento: "carro", fixo: 7000, travaNps: false, dsrSobreComissao: false,
    comissoes: [],
    premios: [
      { id: "meta", rotulo: "Oficina de carro bate a meta", tipo: "auto", metrica: "metaOficinaOk", valor: 500 },
      { id: "nps", rotulo: "NPS carro ≥ 85%", tipo: "auto", metrica: "npsBmw", valor: 500 },
      { id: "videos", rotulo: "Meta de vídeos visualizados", tipo: "gatilho", valor: 500 },
    ],
  },
};

const sa = (s: string) => s.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

/** Ficha de técnico/assistente pelo nome cadastrado na oficina. */
export function perfilTecnico(nome: string, grupo: string): Perfil {
  const n = sa(nome), seg = grupo === "moto" ? "moto" : "carro";
  const base = { chave: `TEC:${n}`, nome, segmento: seg as "carro" | "moto", travaNps: false, dsrSobreComissao: true };
  if (n.startsWith("VICTOR")) return { ...base, cargo: "Assistente de mecânico", fixo: 1600, comissoes: [{ rotulo: "Mão de obra", base: "mo", pct: 0.06 }], premios: [{ id: "pecas", rotulo: "Peças aplicadas", tipo: "escada", metrica: "pecas", degraus: [[120000, 100], [145000, 400]], fmt: "brl" }] };
  if (n.includes("MATHEUS") && (n.includes("PAZ") || n.includes("GONCALVES"))) return { ...base, cargo: "Assistente de mecânico", fixo: 1650, comissoes: [{ rotulo: "Mão de obra", base: "mo", pct: 0.01 }], premios: [] };
  if (n.includes("MATHEUS") && n.includes("FELIX")) return { ...base, cargo: "Assistente de mecânico", fixo: 1600, comissoes: [{ rotulo: "Mão de obra", base: "mo", pct: 0.01 }], premios: [] };
  return { ...base, cargo: "Técnico", fixo: 0, comissoes: [{ rotulo: "Mão de obra produzida", base: "mo", pct: 0.1 }], premios: seg === "carro" ? [{ id: "pecas", rotulo: "Peças aplicadas", tipo: "escada", metrica: "pecas", degraus: PECAS_TEC, fmt: "brl" }] : [] };
}

/** Vendas faturadas de Acessórios & Estética somadas por vendedor (login do consultor) e por departamento. */
export type Complementares = { porVendedor: Record<string, { ACESSORIOS: number; ESTETICA: number }>; total: { ACESSORIOS: number; ESTETICA: number } };
export function somaComplementares(vendas: { departamento: string; vendedor: string; valor: number | string; devolucao?: number | string | null; status: string }[]): Complementares {
  const out: Complementares = { porVendedor: {}, total: { ACESSORIOS: 0, ESTETICA: 0 } };
  for (const v of vendas) {
    if (v.status !== "FATURADO" || (v.departamento !== "ACESSORIOS" && v.departamento !== "ESTETICA")) continue;
    const d = v.departamento as "ACESSORIOS" | "ESTETICA";
    const liq = (+v.valor || 0) - (+(v.devolucao ?? 0) || 0);
    const k = sa(v.vendedor);
    const p = (out.porVendedor[k] ??= { ACESSORIOS: 0, ESTETICA: 0 });
    p[d] += liq; out.total[d] += liq;
  }
  return out;
}

/** Resolve a ficha de um login de consultor (balcão compartilhado vira duas fichas). */
export function perfisDoLogin(login: string): Perfil[] {
  const k = sa(login);
  if (k.includes("NAILTON") || k.includes("THIERRY")) return [PERFIS["NAILTON"]!, PERFIS["THIERRY"]!];
  return PERFIS[k] ? [PERFIS[k]!] : [];
}

export type LinhaPremio = { id: string; rotulo: string; valor: number; status: "ok" | "nao" | "pendente"; info: string; falta: number | null; proximo: Degrau | null; fmt?: "brl" | "pct" | undefined };
export type Extrato = {
  perfil: Perfil; fixo: number; comissoes: { rotulo: string; base: number; pct: number; valor: number }[];
  comissao: number; dsrPct: number; dsr: number; premios: LinhaPremio[]; premiosBrutos: number;
  fator: number; corteNps: number; premiosValidos: number; total: number;
};

/** Extrato completo. gatilhos = confirmações manuais da gestão (id → sim/não; ausente = pendente). */
export function calcularComissao(perfil: Perfil, m: Metricas, dsrPct: number, gatilhos: Record<string, boolean> = {}): Extrato {
  const comissoes = perfil.comissoes.map((c) => { const base = +(m[c.base] as number ?? 0) || 0; return { rotulo: c.rotulo, base, pct: c.pct, valor: base * c.pct }; });
  const comissao = comissoes.reduce((s, c) => s + c.valor, 0);
  const dsr = perfil.dsrSobreComissao ? comissao * dsrPct : 0;
  const premios: LinhaPremio[] = perfil.premios.map((p) => {
    if (p.tipo === "escada") {
      const v = m[p.metrica] as number | null | undefined;
      const e = escada(v, p.degraus);
      return { id: p.id, rotulo: p.rotulo, valor: e.premio, status: v == null ? "pendente" : e.premio > 0 ? "ok" : "nao", info: v == null ? "aguardando dado" : "", falta: e.falta, proximo: e.proximo, fmt: p.fmt };
    }
    if (p.tipo === "auto") {
      const raw = m[p.metrica];
      const ok = p.metrica === "npsBmw" ? (raw == null ? null : (raw as number) >= 0.85) : (raw as boolean | null | undefined) ?? null;
      if (ok === null && gatilhos[p.id] !== undefined) return { id: p.id, rotulo: p.rotulo, valor: gatilhos[p.id] ? p.valor : 0, status: gatilhos[p.id] ? "ok" : "nao", info: "confirmado pela gestão", falta: null, proximo: null };
      return { id: p.id, rotulo: p.rotulo, valor: ok ? p.valor : 0, status: ok === null ? "pendente" : ok ? "ok" : "nao", info: ok === null ? "aguardando dado" : "", falta: null, proximo: null };
    }
    // VOC dos consultores é calculado pelo NPS quando disponível.
    if (p.id === "voc" && perfil.npsAuto !== false && (m.npsBmw != null || m.npsMini != null) && gatilhos["voc"] === undefined) {
      const f = fatorNps(perfil.segmento, m.npsBmw ?? null, m.npsMini ?? null);
      return { id: p.id, rotulo: p.rotulo, valor: p.valor * f, status: f > 0 ? "ok" : "nao", info: "pelo NPS do mês", falta: null, proximo: null };
    }
    const g = gatilhos[p.id];
    return { id: p.id, rotulo: p.rotulo, valor: g ? p.valor : 0, status: g === undefined ? "pendente" : g ? "ok" : "nao", info: g === undefined ? `vale ${p.valor} · a confirmar pela gestão` : "confirmado pela gestão", falta: null, proximo: null };
  });
  const premiosBrutos = premios.reduce((s, p) => s + p.valor, 0);
  const fator = perfil.travaNps ? fatorNps(perfil.segmento, m.npsBmw ?? null, m.npsMini ?? null) : 1;
  const premiosValidos = premiosBrutos * fator;
  return { perfil, fixo: perfil.fixo, comissoes, comissao, dsrPct, dsr, premios, premiosBrutos, fator, corteNps: premiosBrutos - premiosValidos, premiosValidos, total: perfil.fixo + comissao + dsr + premiosValidos };
}

/** % de promotores por marca (MINI pelo veículo), sem PJ, para um consultor ou todos. */
export function npsPorMarca(itens: { consultor: string; nota: number | null; pj: boolean; veiculo: string; segmento: string; recebimento: string; fechamento: string }[], mes: string, consultor?: string) {
  const l = itens.filter((x) => !x.pj && x.nota !== null && (x.recebimento || x.fechamento).startsWith(mes) && (!consultor || sa(x.consultor) === sa(consultor)));
  const pp = (arr: typeof l) => (arr.length ? arr.filter((x) => (x.nota ?? 0) >= 9).length / arr.length : null);
  const mini = l.filter((x) => /MINI/i.test(x.veiculo));
  const bmw = l.filter((x) => !/MINI/i.test(x.veiculo));
  return { bmw: pp(bmw), mini: pp(mini), carro: pp(l.filter((x) => x.segmento === "carro")), avaliados: l.length, promotores: l.filter((x) => (x.nota ?? 0) >= 9).length };
}

/** Promotores extras necessários para atingir a meta de % promotores. */
export function promotoresFaltando(avaliados: number, promotores: number, meta: number): number {
  if (!avaliados || promotores / avaliados >= meta) return 0;
  // (p + x) / (n + x) >= meta  →  x >= (meta·n − p) / (1 − meta)
  return Math.ceil((meta * avaliados - promotores) / (1 - meta) - 1e-9);
}
