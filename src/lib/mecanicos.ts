import { norm, parseNum } from "@/components/painel-ui";

export type MecRow = { nome: string; servicos: number; pecas: number };
export type MecReport = { rows: MecRow[]; periodo: { ini: string; fim: string } | null };

const lab = (v: unknown) => norm(String(v ?? "").trim()).replace(/\s+/g, " ");
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
    const h = row.map(lab);
    const n = h.findIndex(x => /^(produtivo|mecanico|tecnico)$/.test(x));
    if (n >= 0) {
      let s = h.findIndex(x => x === "srv total");
      if (s < 0) s = h.findIndex(x => /^(servicos?|mdo)$/.test(x));
      cols = { n, s, p: h.findIndex(x => /^pecas?$/.test(x)) };
      continue;
    }
    if (!cols) continue;
    const nome = String(row[cols.n] ?? "").trim();
    if (!nome || /^(sem apontamento|total|empresa|filial|pagina)/.test(lab(nome))) continue;
    const sv = cols.s >= 0 ? row[cols.s] : 0, pv = cols.p >= 0 ? row[cols.p] : 0;
    if (![sv, pv].some(v => typeof v === "number" || /\d/.test(String(v ?? "")))) continue;
    const k = lab(nome);
    const r = map.get(k) ?? { nome: nome.toUpperCase(), servicos: 0, pecas: 0 };
    r.servicos += money(sv); r.pecas += money(pv);
    map.set(k, r);
  }
  const rows = [...map.values()];
  if (!rows.length) throw new Error("Não encontrei mecânicos. O cabeçalho deve ter Produtivo e Srv Total/Peças.");
  return { rows, periodo };
}
