import { TIPOS_INTERNOS } from "@/lib/mecanicos";

/** Item de peça agregado no mês (relatório "Faturamento de peças"). */
export type ItemPeca = { cod: string; desc: string; qtd: number; valor: number; margem: number; giro: string; grupo: string; os: number };
export type ItemAbc = ItemPeca & { pct: number; acum: number; classe: "A" | "B" | "C" };

const n = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
const num = (v: unknown) => typeof v === "number" ? v : Number(String(v ?? "").replace(/\./g, "").replace(",", ".")) || 0;

/** Reconhece pelo cabeçalho: Cód. Item + Preço Final + Quantidade. */
export const ehFaturamentoPecas = (raw: unknown[][]) => raw.slice(0, 15).some((r) => { const h = r.map(n); return h.includes("cod. item") && h.includes("preco final") && h.includes("quantidade"); });

/** Agrupa por código de item, excluindo O.S. internas. */
export function lerItensPecas(raw: unknown[][]): ItemPeca[] {
  const hi = raw.findIndex((r) => { const h = r.map(n); return h.includes("cod. item") && h.includes("preco final"); });
  if (hi < 0) return [];
  const h = raw[hi]!.map(n); const c = (x: string) => h.indexOf(x);
  const k = { cod: c("cod. item"), desc: c("descricao"), qtd: c("quantidade"), val: c("preco final"), mg: c("marg. liq."), giro: c("giro"), grupo: c("grupo interno"), tipo: c("tipo os"), os: c("o.s.") };
  const m = new Map<string, ItemPeca & { oss: Set<string> }>();
  for (const r of raw.slice(hi + 1)) {
    const cod = String(r[k.cod] ?? "").trim(); if (!cod) continue;
    if (k.tipo >= 0 && TIPOS_INTERNOS.has(String(r[k.tipo] ?? "").trim().toUpperCase())) continue;
    const it = m.get(cod) ?? { cod, desc: String(r[k.desc] ?? "").trim(), qtd: 0, valor: 0, margem: 0, giro: String(r[k.giro] ?? "").trim(), grupo: String(r[k.grupo] ?? "").trim(), os: 0, oss: new Set<string>() };
    it.qtd += num(r[k.qtd]); it.valor += num(r[k.val]); it.margem += k.mg >= 0 ? num(r[k.mg]) : 0;
    const os = k.os >= 0 ? String(r[k.os] ?? "").trim() : ""; if (os && os !== "0") it.oss.add(os);
    m.set(cod, it);
  }
  return [...m.values()].map(({ oss, ...i }) => ({ ...i, os: oss.size }));
}

/** Curva ABC por faturamento: A até 80%, B até 95%, C restante. */
export function curvaAbc(itens: ItemPeca[]): ItemAbc[] {
  const tot = itens.reduce((a, i) => a + i.valor, 0) || 1;
  let acc = 0;
  return [...itens].sort((a, b) => b.valor - a.valor).map((i) => {
    const antes = acc; acc += i.valor / tot;
    return { ...i, pct: i.valor / tot, acum: acc, classe: antes < 0.8 ? "A" : antes < 0.95 ? "B" : "C" };
  });
}
