import { div, norm, parseNum } from "@/components/painel-ui";

export type MecRow = { nome: string; servicos: number; pecas: number };
export type MecReport = { rows: MecRow[]; periodo: { ini: string; fim: string } | null };

export type Grupo = "carro" | "moto" | "outros";

/** Linha de mecânico de um mês (tabela mech_month). */
export type Mec = {
  id?: string; nome: string; grupo: Grupo;
  servicos: number; pecas: number; passagens: number;
  meta_servicos: number; meta_pecas: number;
  composicao?: Composicao;
};

/** O.S. distintas por categoria de passagem. */
export type Composicao = { bs?: string[]; rev?: string[]; pagos?: string[]; c4?: string[]; funilaria?: string[] };
export const CATEGORIAS = [
  { k: "bs", nome: "BSI", desc: "O.S. do tipo BS" },
  { k: "rev", nome: "REVISÃO C7", desc: "O.S. C7/M7 com código 0000105" },
  { k: "pagos", nome: "C7 - PAGOS", desc: "O.S. C7 que não são Revisão C7" },
  { k: "c4", nome: "C4 - GARANTIA", desc: "O.S. dos tipos C4 e MG" },
  { k: "funilaria", nome: "FUNILARIA", desc: "O.S. dos tipos CF, C5, MF e MS" },
] as const;
export type CatKey = (typeof CATEGORIAS)[number]["k"];
const CAT_KEYS: CatKey[] = CATEGORIAS.map(c => c.k);
/** Tipos de O.S. internas: não contam passagem para ninguém. */
export const TIPOS_INTERNOS = new Set(["IO", "IP", "IU", "IN", "NN", "ID"]);
const COD_REV = new Set(["0000105", "00001050"]);
const C4_T = new Set(["C4", "MG"]);
const FUN_T = new Set(["CF", "C5", "MF", "MS"]);

/** Classifica as linhas (O.S., tipo, código) em O.S. distintas por categoria; cada O.S. conta uma vez. */
export function classificar(linhas: { os: string; tipo: string; cod: string }[]): Required<Composicao> {
  const tipo = new Map<string, string>(); const rev = new Set<string>();
  for (const l of linhas) {
    const t = l.tipo.trim().toUpperCase(); if (t && !tipo.has(l.os)) tipo.set(l.os, t);
    const c = l.cod.replace(/[.\s]/g, "");
    if ((t === "C7" || t === "M7") && COD_REV.has(c)) rev.add(l.os);
  }
  const de = (f: (t: string) => boolean) => [...tipo].filter(([, v]) => f(v)).map(([k]) => k);
  return {
    bs: de(t => t === "BS"), rev: [...rev], pagos: de(t => t === "C7").filter(o => !rev.has(o)),
    c4: de(t => C4_T.has(t)), funilaria: de(t => FUN_T.has(t)),
  };
}

export function somarComposicao(lst: (Composicao | undefined)[]): Required<Composicao> {
  const o = { bs: [] as string[], rev: [] as string[], pagos: [] as string[], c4: [] as string[], funilaria: [] as string[] };
  for (const c of lst) for (const k of CAT_KEYS) o[k].push(...(c?.[k] ?? []));
  for (const k of CAT_KEYS) o[k] = [...new Set(o[k])];
  return o;
}

export const CAMPOS = ["servicos", "pecas", "passagens", "meta_servicos", "meta_pecas"] as const;
export type MecCampo = (typeof CAMPOS)[number];

export type MecX = { real: number; meta: number; perf: number; proj: number; projP: number; nec: number; dia: number };
export type MecCalc = { r: Mec; s: MecX; p: MecX; t: MecX };
export type MecBloco = { calcs: MecCalc[]; S: MecX; P: MecX; T: MecX; pass: number; n: number };

/** Mecânicos de carro informados por Kledson (08/10). */
const CARRO = [
  "FLAVIO PINHEIRO",
  "DELMIR",
  "JONATAS MORAES",
  "LUIS SANDRO",
  "MATHEUS DA PAZ",
  "ORLANDO",
  "SERGIO CARVALHO",
  "VICTOR FILIPE SILVA ROCHA",
  "VINICIUS",
  "WELLINGTON DA SILVA TELES",
  "WELLIGTON DA SILVA TELES", // grafia usada pelo sistema
];

/** Mecânicos de moto informados por Kledson (08/10). */
const MOTO = [
  "INOCENCIO RIBEIRO NETO",
  "JAIR ALVES DOS ANJOS",
  "JOÃO PAULO",
  "MATHEUS FELIX DA SILVA",
];

export const GRUPO_NOME: Record<Grupo, string> = {
  carro: "Técnicos de Carro",
  moto: "Técnicos de Moto",
  outros: "Sem grupo definido",
};

/** Técnicos de diagnóstico: sem meta, ocultos da lista, mas o faturamento entra nos totais. */
const OCULTOS = ["VINICIUS", "DELMIR", "LUIS SANDRO"];

export function ocultoDaLista(nome: string): boolean {
  return OCULTOS.some(x => lab(x) === lab(nome));
}

const lab = (v: unknown) => norm(String(v ?? "").trim()).replace(/\s+/g, " ").toUpperCase();

/** Grupo de um mecânico pela lista; quem não está em nenhuma das duas fica "outros". */
export function grupoDe(nome: string): Grupo {
  const k = lab(nome);
  if (MOTO.some(x => lab(x) === k)) return "moto";
  if (CARRO.some(x => lab(x) === k)) return "carro";
  return "outros";
}

/** real, meta, performance, projeção, projeção vs. meta, necessidade diária e média por dia. */
export function calcMec(real: number, meta: number, dec: number, tot: number): MecX {
  const proj = div(real, dec) * tot;
  const rest = Math.max(tot - dec, 1);
  return { real, meta, perf: div(real, meta), proj, projP: div(proj, meta), nec: Math.max(meta - real, 0) / rest, dia: div(real, dec) };
}

/** Junta um grupo de mecânicos: linhas individuais + totais do grupo. */
export function blocoMec(lst: Mec[], dec: number, tot: number): MecBloco {
  const calcs = lst
    .map(r => ({
      r,
      s: calcMec(r.servicos, r.meta_servicos, dec, tot),
      p: calcMec(r.pecas, r.meta_pecas, dec, tot),
      t: calcMec(r.servicos + r.pecas, r.meta_servicos + r.meta_pecas, dec, tot),
    }))
    .sort((a, b) => b.t.real - a.t.real);
  const sum = (k: MecCampo) => lst.reduce((a, r) => a + Number(r[k]), 0);
  const S = calcMec(sum("servicos"), sum("meta_servicos"), dec, tot);
  const P = calcMec(sum("pecas"), sum("meta_pecas"), dec, tot);
  const T = calcMec(S.real + P.real, S.meta + P.meta, dec, tot);
  return { calcs, S, P, T, pass: sum("passagens"), n: lst.length };
}

const money = (v: unknown) => (typeof v === "number" ? v : parseNum(String(v ?? "")));
const iso = (s: string) => { const [d, m, y] = s.split("/"); return `${y}-${m}-${d}`; };

/** Lê o relatório "Faturamento Líquido dos Produtivos" (Produtivo | MDO | ... | Srv Total | Peças). */
export function lerMecanicos(raw: unknown[][]): MecReport {
  const text = norm(raw.map(r => r.join(" ")).join("\n"));
  const p = text.match(/period\w*[^\d\n]*(\d{2}\/\d{2}\/\d{4})\s+a\s+(\d{2}\/\d{2}\/\d{4})/);
  const periodo = p?.[1] && p[2] ? { ini: iso(p[1]), fim: iso(p[2]) } : null;
  let cols: { n: number; s: number; p: number } | null = null;
  const map = new Map<string, MecRow>();
  for (const row of raw) {
    const h = row.map(x => norm(String(x ?? "").trim()).replace(/\s+/g, " "));
    const n = h.findIndex(x => /^(produtivo|mecanico|tecnico)$/.test(x));
    if (n >= 0) {
      let s = h.findIndex(x => x === "srv total");
      if (s < 0) s = h.findIndex(x => /^(servicos?|mdo)$/.test(x));
      cols = { n, s, p: h.findIndex(x => /^pecas?$/.test(x)) };
      continue;
    }
    if (!cols) continue;
    const nome = String(row[cols.n] ?? "").trim();
    if (!nome || /^(sem apontamento|total|empresa|filial|pagina)/.test(norm(nome))) continue;
    const sv = cols.s >= 0 ? row[cols.s] : 0, pv = cols.p >= 0 ? row[cols.p] : 0;
    if (![sv, pv].some(v => typeof v === "number" || /\d/.test(String(v ?? "")))) continue;
    const k = norm(nome).replace(/\s+/g, " ");
    const r = map.get(k) ?? { nome: nome.toUpperCase(), servicos: 0, pecas: 0 };
    r.servicos += money(sv); r.pecas += money(pv);
    map.set(k, r);
  }
  const rows = [...map.values()];
  if (!rows.length) throw new Error("Não encontrei técnicos. O cabeçalho deve ter Produtivo e Srv Total/Peças.");
  return { rows, periodo };
}

export type PassReport = { temTipo?: boolean; mecanicos: { nome: string; passagens: number; composicao?: Composicao }[]; consultores: { nome: string; passagens: number }[] };

/** True quando o cabeçalho é o relatório "Passagem tecnico+consultor" (ID O.S. | Consultor | Produtivo). */
export function ehRelatorioPassagens(raw: unknown[][]): boolean {
  return raw.some(r => {
    const h = r.map(x => norm(String(x ?? "").trim()).replace(/\s+/g, " "));
    return h.some(x => /^id ?o\.?s\.?$/.test(x)) && h.includes("consultor") && h.includes("produtivo");
  });
}

/** Conta passagens = O.S. distintas por pessoa (a O.S. se repete a cada serviço codificado nela). */
export function lerPassagens(raw: unknown[][]): PassReport {
  let cols: { os: number; cons: number; prod: number; tipo: number; cod: number } | null = null;
  const linhas = new Map<string, { os: string; tipo: string; cod: string }[]>();
  const seenM = new Map<string, Set<string>>(); // produtivo -> conjunto de O.S.
  const seenC = new Map<string, Set<string>>(); // consultor -> conjunto de O.S.
  const nomes = new Map<string, string>();
  for (const row of raw) {
    const h = row.map(x => norm(String(x ?? "").trim()).replace(/\s+/g, " "));
    const os = h.findIndex(x => /^id ?o\.?s\.?$/.test(x));
    if (os >= 0) { cols = { os, cons: h.findIndex(x => x === "consultor"), prod: h.findIndex(x => x === "produtivo"), tipo: h.findIndex(x => /^tipo( ?(de )?o\.?s\.?)?$/.test(x)), cod: h.findIndex(x => /^(cod|codigo|cod\.? ?(do )?serv\w*|codigo (do )?servico|servico|operacao|tmo ?ref\.?)$/.test(x)) }; continue; }
    if (!cols) continue;
    const id = String(row[cols.os] ?? "").trim();
    if (!id || !/\d/.test(id)) continue;
    if (cols.tipo >= 0 && TIPOS_INTERNOS.has(String(row[cols.tipo] ?? "").trim().toUpperCase())) continue;
    for (const [ci, map] of [[cols.cons, seenC], [cols.prod, seenM]] as const) {
      const nome = String(row[ci] ?? "").trim();
      if (!nome) continue;
      const k = norm(nome).replace(/\s+/g, " ");
      nomes.set(k, nome.toUpperCase());
      (map.get(k) ?? map.set(k, new Set()).get(k)!).add(id);
      if (ci === cols.prod && cols.tipo >= 0) (linhas.get(k) ?? linhas.set(k, []).get(k)!).push({ os: id, tipo: String(row[cols.tipo] ?? ""), cod: cols.cod >= 0 ? String(row[cols.cod] ?? "") : "" });
    }
  }
  const out = (m: Map<string, Set<string>>) => [...m.entries()].map(([k, s]) => ({ nome: nomes.get(k)!, passagens: s.size })).sort((a, b) => a.nome.localeCompare(b.nome));
  const temTipo = cols?.tipo !== undefined && cols.tipo >= 0;
  const r = { temTipo, mecanicos: out(seenM).map(m => temTipo ? { ...m, composicao: classificar(linhas.get(norm(m.nome).replace(/\s+/g, " ")) ?? []) } : m), consultores: out(seenC) };
  if (!r.mecanicos.length && !r.consultores.length) throw new Error("Não encontrei passagens. O cabeçalho deve ter ID O.S., Consultor e Produtivo.");
  return r;
}
