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
  { k: "rev", nome: "REVISÃO C7", desc: "C7/M7 com 0000105 · Moto: N* com 0000111/0000119" },
  { k: "pagos", nome: "C7 - PAGOS", desc: "C7 (Moto: N7/N5/NF) que não são revisão" },
  { k: "c4", nome: "C4 - GARANTIA", desc: "O.S. dos tipos C4, MG e NG (Moto)" },
  { k: "funilaria", nome: "FUNILARIA", desc: "O.S. dos tipos CF, C5, MF e MS" },
] as const;
export type CatKey = (typeof CATEGORIAS)[number]["k"];
const CAT_KEYS: CatKey[] = CATEGORIAS.map(c => c.k);
/** Tipos de O.S. internas: não contam passagem para ninguém. */
export const TIPOS_INTERNOS = new Set(["IO", "IP", "IU", "IN", "NN", "ID"]);
const COD_REV = new Set(["0000105", "00001050"]);
const C4_T = new Set(["C4", "MG"]);
const FUN_T = new Set(["CF", "C5", "MF", "MS"]);
/** Moto: reparo pago N7/N5/NF; garantia NG. */
const REP_MOTO = new Set(["N7", "N5", "NF"]);
const REV_MOTO = new Set(["0000111", "0000119"]);

/** Classifica as linhas (O.S., tipo, código) em O.S. distintas por categoria; cada O.S. conta uma vez. */
export function classificar(linhas: { os: string; tipo: string; cod: string }[]): Required<Composicao> {
  const tipo = new Map<string, string>(); const rev = new Set<string>();
  for (const l of linhas) {
    const t = l.tipo.trim().toUpperCase(); if (t && !tipo.has(l.os)) tipo.set(l.os, t);
    const c = l.cod.replace(/[.\s]/g, "");
    if ((t === "C7" || t === "M7") && COD_REV.has(c)) rev.add(l.os);
    if (/^N/.test(t) && REV_MOTO.has(c)) rev.add(l.os); // Revisão Moto (0000111/0000119)
  }
  const de = (f: (t: string) => boolean) => [...tipo].filter(([, v]) => f(v)).map(([k]) => k);
  return {
    bs: de(t => t === "BS"), rev: [...rev], pagos: de(t => t === "C7" || REP_MOTO.has(t)).filter(o => !rev.has(o)),
    c4: de(t => C4_T.has(t) || t === "NG"), funilaria: de(t => FUN_T.has(t)),
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

export type PassReport = { temTipo?: boolean; osIds?: string[]; mecanicos: { nome: string; passagens: number; composicao?: Composicao }[]; consultores: { nome: string; passagens: number; mix?: MixCons }[] };

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
  const linhasC = new Map<string, { os: string; tipo: string; cod: string }[]>();
  const seenM = new Map<string, Set<string>>(); // produtivo -> conjunto de O.S.
  const seenC = new Map<string, Set<string>>(); // consultor -> conjunto de O.S.
  const nomes = new Map<string, string>();
  const ids = new Set<string>();
  // 1ª leitura: produtivo de cada O.S. (para amarrar linhas com Produtivo vazio ao técnico da mesma O.S.)
  const prodDaOs = new Map<string, string>();
  { let c: { os: number; prod: number } | null = null;
    for (const row of raw) {
      const h = row.map(x => norm(String(x ?? "").trim()).replace(/\s+/g, " "));
      const o = h.findIndex(x => /^id ?o\.?s\.?$/.test(x));
      if (o >= 0) { c = { os: o, prod: h.findIndex(x => x === "produtivo") }; continue; }
      if (!c || c.prod < 0) continue;
      const id = String(row[c.os] ?? "").trim(), p = String(row[c.prod] ?? "").trim();
      if (id && p && !prodDaOs.has(id)) prodDaOs.set(id, p);
    } }
  for (const row0 of raw) {
    let row = row0;
    const h = row.map(x => norm(String(x ?? "").trim()).replace(/\s+/g, " "));
    const os = h.findIndex(x => /^id ?o\.?s\.?$/.test(x));
    if (os >= 0) { cols = { os, cons: h.findIndex(x => x === "consultor"), prod: h.findIndex(x => x === "produtivo"), tipo: h.findIndex(x => /^tipo( ?(de )?o\.?s\.?)?$/.test(x)), cod: h.findIndex(x => /^(cod|codigo|cod\.? ?(do )?serv\w*|codigo (do )?servico|servico|operacao|tmo ?ref\.?)$/.test(x)) }; continue; }
    if (!cols) continue;
    const id = String(row[cols.os] ?? "").trim();
    if (!id || !/\d/.test(id)) continue;
    if (cols.tipo >= 0 && TIPOS_INTERNOS.has(String(row[cols.tipo] ?? "").trim().toUpperCase())) continue;
    ids.add(id);
    if (cols.prod >= 0 && !String(row[cols.prod] ?? "").trim() && prodDaOs.has(id)) { row = [...row]; row[cols.prod] = prodDaOs.get(id); }
    for (const [ci, map] of [[cols.cons, seenC], [cols.prod, seenM]] as const) {
      const nome = String(row[ci] ?? "").trim();
      if (!nome) continue;
      const k = norm(nome).replace(/\s+/g, " ");
      nomes.set(k, nome.toUpperCase());
      (map.get(k) ?? map.set(k, new Set()).get(k)!).add(id);
      if (ci === cols.cons && cols.tipo >= 0) (linhasC.get(k) ?? linhasC.set(k, []).get(k)!).push({ os: id, tipo: String(row[cols.tipo] ?? ""), cod: cols.cod >= 0 ? String(row[cols.cod] ?? "") : "" });
      if (ci === cols.prod && cols.tipo >= 0) (linhas.get(k) ?? linhas.set(k, []).get(k)!).push({ os: id, tipo: String(row[cols.tipo] ?? ""), cod: cols.cod >= 0 ? String(row[cols.cod] ?? "") : "" });
    }
  }
  const out = (m: Map<string, Set<string>>) => [...m.entries()].map(([k, s]) => ({ nome: nomes.get(k)!, passagens: s.size })).sort((a, b) => a.nome.localeCompare(b.nome));
  const temTipo = cols?.tipo !== undefined && cols.tipo >= 0;
  const r = { temTipo, osIds: [...ids], mecanicos: out(seenM).map(m => temTipo ? { ...m, composicao: classificar(linhas.get(norm(m.nome).replace(/\s+/g, " ")) ?? []) } : m), consultores: out(seenC).map(c => temTipo ? { ...c, mix: classificarConsultor(linhasC.get(norm(c.nome).replace(/\s+/g, " ")) ?? [], consultorMoto(c.nome)) } : c) };
  if (!r.mecanicos.length && !r.consultores.length) throw new Error("Não encontrei passagens. O cabeçalho deve ter ID O.S., Consultor e Produtivo.");
  return r;
}

/** Mix de passagens por consultor (O.S. distintas). */
export type MixCons = { bsi: string[]; rev: string[]; gar: string[]; rep: string[] };
/** Pedro e Gilberto atendem Moto (regras próprias, sem BSI). */
export const consultorMoto = (nome: string) => /\b(PEDRO|P\.?\s?BENIGNO|BENIGNO|GILBERTO)/.test(nome.toUpperCase());
export function classificarConsultor(linhas: { os: string; tipo: string; cod: string }[], moto: boolean): MixCons {
  const tipo = new Map<string, string>(); const rev = new Set<string>();
  for (const l of linhas) {
    const t = l.tipo.trim().toUpperCase(); if (t && !tipo.has(l.os)) tipo.set(l.os, t);
    const c = l.cod.replace(/[.\s]/g, "");
    if (moto ? REV_MOTO.has(c) && /^N/.test(t) : (t === "C7" || t === "M7") && COD_REV.has(c)) rev.add(l.os);
  }
  const de = (f: (t: string) => boolean) => [...tipo].filter(([, v]) => f(v)).map(([k]) => k);
  if (moto) return { bsi: [], rev: [...rev], gar: de(t => t === "NG"), rep: de(t => ["N7", "N5", "NF"].includes(t)).filter(o => !rev.has(o)) };
  return { bsi: de(t => t === "BS"), rev: [...rev], gar: de(t => C4_T.has(t)), rep: de(t => t === "C7").filter(o => !rev.has(o)) };
}

export type FatTecnicos = { rows: { nome: string; servicos: number; pecas: number }[]; semApontamento: { servicos: number; pecas: number } };

/** Do relatório analítico "O.S. Fechadas" (Produtivo | Tipo | Serv. Líquido | Itens Líquido): M.O. e peças por técnico, sem O.S. internas.
 *  Linhas sem Produtivo ficam em "Sem apontamento" (igual ao "Faturamento Líquido dos Produtivos" da DMS). */
export function tecnicosDoFatServicos(raw: unknown[][]): FatTecnicos | null {
  const low = (x: unknown) => norm(String(x ?? "").trim()).replace(/\s+/g, " ");
  const hi = raw.findIndex(r => { const h = r.map(low); return h.includes("produtivo") && h.some(x => /^serv\.? liq/.test(x)) && h.some(x => /^itens liq/.test(x)); });
  if (hi < 0) return null;
  const h = raw[hi]!.map(low);
  const cP = h.indexOf("produtivo"), cS = h.findIndex(x => /^serv\.? liq/.test(x)), cI = h.findIndex(x => /^itens liq/.test(x)), cT = h.indexOf("tipo");
  const map = new Map<string, { nome: string; servicos: number; pecas: number }>(); const sem = { servicos: 0, pecas: 0 };
  for (const r of raw.slice(hi + 1)) {
    if (cT >= 0 && TIPOS_INTERNOS.has(String(r[cT] ?? "").trim().toUpperCase())) continue;
    const s = money(r[cS]), p = money(r[cI]);
    if (!s && !p) continue;
    const nome = String(r[cP] ?? "").trim();
    if (!nome) { sem.servicos += s; sem.pecas += p; continue; }
    const k = low(nome); const cur = map.get(k) ?? { nome: nome.toUpperCase(), servicos: 0, pecas: 0 };
    cur.servicos += s; cur.pecas += p; map.set(k, cur);
  }
  const rows = [...map.values()].map(x => ({ ...x, servicos: Math.round(x.servicos * 100) / 100, pecas: Math.round(x.pecas * 100) / 100 }));
  return rows.length ? { rows, semApontamento: sem } : null;
}
