import { norm, parseNum } from "@/components/painel-ui";

export type MecRow = { nome: string; servicos: number; pecas: number };
export type MecReport = { rows: MecRow[]; periodo: { ini: string; fim: string } | null };

export type Grupo = "carro" | "moto" | "outros";

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
  carro: "Mecânicos de Carro",
  moto: "Mecânicos de Moto",
  outros: "Sem grupo definido",
};

/** Grupo de um mecânico pela lista; quem não está em nenhuma das duas fica "outros". */
export function grupoDe(nome: string): Grupo {
  const k = lab(nome);
  if (MOTO.some(x => lab(x) === k)) return "moto";
  if (CARRO.some(x => lab(x) === k)) return "carro";
  return "outros";
}

const lab = (v: unknown) => norm(String(v ?? "").trim()).replace(/\s+/g, " ").toUpperCase();

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
  if (!rows.length) throw new Error("Não encontrei mecânicos. O cabeçalho deve ter Produtivo e Srv Total/Peças.");
  return { rows, periodo };
}
