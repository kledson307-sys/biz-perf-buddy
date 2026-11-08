import { TIPOS_INTERNOS } from "@/lib/mecanicos";
import { nomeVendedor } from "@/lib/sales-report";

/** Item de peça agregado no mês (relatório "Faturamento de peças"). */
export type ItemPeca = { cod: string; desc: string; qtd: number; valor: number; margem: number; giro: string; grupo: string; os: number; vend?: Record<string, number>; desc$?: Record<string, [number, number]> };

/** Desconto por vendedor: [valor de tabela (unitário × qtd), desconto em R$]. */
export function descontoPorVendedor(itens: ItemPeca[]): Record<string, { tabela: number; desconto: number; pct: number }> {
  const acc: Record<string, [number, number]> = {};
  for (const i of itens) for (const [lg, [t, d]] of Object.entries(i.desc$ ?? {})) { const a = acc[lg] ?? [0, 0]; acc[lg] = [a[0] + t, a[1] + d]; }
  return Object.fromEntries(Object.entries(acc).map(([lg, [t, d]]) => [lg, { tabela: t, desconto: d, pct: t ? d / t : 0 }]));
}
/** Semáforo de desconto: verde ≤6%, amarelo ≤10%, vermelho acima. */
export const toneDesconto = (p: number) => (p <= 0.06 ? "text-success" : p <= 0.1 ? "text-warning" : "text-coral");
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
  const k = { cod: c("cod. item"), desc: c("descricao"), qtd: c("quantidade"), val: c("preco final"), mg: c("marg. liq."), giro: c("giro"), grupo: c("grupo interno"), tipo: c("tipo os"), os: c("o.s."), vend: c("vendedor"), unit: c("unitario") };
  const m = new Map<string, ItemPeca & { oss: Set<string> }>();
  for (const r of raw.slice(hi + 1)) {
    const cod = String(r[k.cod] ?? "").trim(); if (!cod) continue;
    if (k.tipo >= 0 && TIPOS_INTERNOS.has(String(r[k.tipo] ?? "").trim().toUpperCase())) continue;
    const it = m.get(cod) ?? { cod, desc: String(r[k.desc] ?? "").trim(), qtd: 0, valor: 0, margem: 0, giro: String(r[k.giro] ?? "").trim(), grupo: String(r[k.grupo] ?? "").trim(), os: 0, oss: new Set<string>() };
    it.qtd += num(r[k.qtd]); it.valor += num(r[k.val]); it.margem += k.mg >= 0 ? num(r[k.mg]) : 0;
    if (k.vend >= 0) { const lg = nomeVendedor(String(r[k.vend] ?? "").trim()); if (lg) {
      it.vend ??= {}; it.vend[lg] = (it.vend[lg] ?? 0) + num(r[k.qtd]);
      if (k.unit >= 0) { const tab = num(r[k.unit]) * num(r[k.qtd]), fin = num(r[k.val]); it.desc$ ??= {}; const d = it.desc$[lg] ?? [0, 0]; it.desc$[lg] = [d[0] + Math.max(tab, fin), d[1] + Math.max(tab - fin, 0)]; }
    } }
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

const FAMILIAS: [string, RegExp][] = [
  ["Químicos (Tunap & Brazzo)", /tunap|brazzo|quimic/],
  ["Pneus & Rodas", /pneu|roda|aro |camara/],
  ["Filtros & Revisão", /filtro|vela|palheta|elemento|correia/],
  ["Lubrificantes & Fluidos", /oleo|lubrif|fluido|aditivo|graxa|twinpower|advantec|arrefec.*liq|liquido/],
  ["Freios & Desgaste", /freio|pastilha|disco|pinca|lona/],
  ["Suspensão & Direção", /amortec|bucha|braco|bieleta|coxim|suspens|direcao|terminal|pivo|mola/],
  ["Baterias & Elétrica", /bateria|alternador|lampada|chicote|sensor|modulo|fusivel|rele|motor de arranque/],
  ["Carroceria & Iluminação", /farol|lanterna|para-?choque|vidro|retrovisor|porta|capo|paralama|grade|emblema|friso/],
  ["Motor & Arrefecimento", /bomba|radiador|termostat|junta|retentor|pistao|valvula|mangueira|turbo/],
];

/** Família funcional pela descrição/grupo (substitui o "Grupo Interno" cru do DMS). */
export function familiaPeca(i: Pick<ItemPeca, "desc" | "grupo">): string {
  const t = n(`${i.grupo} ${i.desc}`);
  for (const [f, re] of FAMILIAS) if (re.test(t)) return f;
  return "Outras peças";
}

/** Faixas executivas de giro pela curva ABC. */
export function faixasGiro(curva: ItemAbc[]) {
  const tot = curva.reduce((a, i) => a + i.valor, 0) || 1;
  return (["A", "B", "C"] as const).map((c) => {
    const l = curva.filter((i) => i.classe === c), v = l.reduce((a, i) => a + i.valor, 0);
    return { classe: c, itens: l.length, valor: v, pct: v / tot, pctItens: curva.length ? l.length / curva.length : 0 };
  });
}

/** Pneus vendidos (unidades) por login do vendedor, pela descrição do item. */
export const ehPneu = (i: Pick<ItemPeca, "desc">) => /\bpneu/.test(n(i.desc));
export function pneusPorVendedor(itens: ItemPeca[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const i of itens) if (ehPneu(i)) for (const [lg, q] of Object.entries(i.vend ?? {})) out[lg] = (out[lg] ?? 0) + q;
  return out;
}
