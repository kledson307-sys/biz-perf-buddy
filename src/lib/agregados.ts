import { norm, parseNum } from "@/components/painel-ui";

export type Grupo = "servicos" | "pecas";

/** Catálogo de itens agregados. `cod` = códigos padrão do sistema (podem ser alterados pelo usuário na tela). */
export const ITENS: { k: string; nome: string; g: Grupo; re: RegExp; cod: string[] }[] = [
  { k: "limpar", nome: "Limpar", g: "servicos", re: /limp/, cod: ["LIMP001", "LIMPSIST", "LIMP05", "LIMP04", "LIMPFREIO", "LIMP08", "LIMP07", "LIMPCORRENTE"] },
  { k: "alinhamento", nome: "Alinhamento & Balanceamento", g: "servicos", re: /alinh|balanc/, cod: ["0000170", "ALINHA01"] },
  { k: "oxi", nome: "Oxi Capacete", g: "servicos", re: /oxi|capacete/, cod: ["LIMP10"] },
  { k: "brazzo", nome: "Brazzo", g: "pecas", re: /brazzo/, cod: [] },
  { k: "tunap", nome: "Tunap", g: "pecas", re: /tunap/, cod: [] },
];
export const GRUPO_NOME: Record<Grupo, string> = { servicos: "Serviços agregados", pecas: "Peças agregadas" };

export const normCod = (s: string) => s.trim().toUpperCase();
export const splitCods = (s: string) => s.split(/[,;\s]+/).map(normCod).filter(Boolean);

type Cell = string | number | null | undefined;
export type Servico = { codigo: string; desc: string; qtd: number; bruto: number; vendedores: { nome: string; qtd: number }[] };
export type Relatorio = { periodo: { ini: string; fim: string } | null; servicos: Servico[] };

const txt = (c: Cell) => (c == null ? "" : String(c).trim());
const val = (c: Cell) => (typeof c === "number" ? c : parseNum(txt(c)));

/** Lê o relatório "Ranking de Serviços" do sistema (linhas de serviço seguidas das linhas por vendedor). */
export function lerRanking(rows: Cell[][]): Relatorio {
  let periodo: Relatorio["periodo"] = null;
  for (const r of rows) for (const c of r) {
    const m = txt(c).match(/(\d{2})\/(\d{2})\/(\d{4})\s*a\s*(\d{2})\/(\d{2})\/(\d{4})/);
    if (m && /per[ií]odo/i.test(txt(c))) { periodo = { ini: `${m[3]}-${m[2]}-${m[1]}`, fim: `${m[6]}-${m[5]}-${m[4]}` }; break; }
  }
  const hi = rows.findIndex((r) => r.some((c) => norm(txt(c)) === "rank") && r.some((c) => norm(txt(c)) === "qtde"));
  if (hi < 0) throw new Error('Não encontrei o cabeçalho do relatório (colunas "Rank", "Serviço", "Qtde", "Bruto").');
  const head = rows[hi]!.map((c) => norm(txt(c)));
  const col = (re: RegExp) => head.findIndex((h) => re.test(h));
  const cRank = col(/^rank$/), cCod = col(/^servico/), cDesc = col(/^descri/), cQtd = col(/^qtde$/);
  let cBruto = col(/bruto/);
  if (cBruto < 0) {
    const prev = (rows[hi - 1] ?? []).map((c) => norm(txt(c)));
    cBruto = prev.findIndex((h) => /bruto/.test(h));
  }
  if (cCod < 0 || cDesc < 0 || cBruto < 0) throw new Error('O relatório precisa das colunas "Serviço", "Descrição", "Qtde" e "Valor Bruto".');

  const servicos: Servico[] = [];
  let cur: Servico | null = null;
  for (const r of rows.slice(hi + 1)) {
    const cells = r.map(txt);
    const first = cells.find((c) => c) ?? "";
    if (!first) continue;
    if (/^totais?/i.test(first)) break;
    if (cells.some((c) => /^(rank|empresa:|filial:)$/i.test(c))) continue;
    const rank = cells[cRank] ?? "", cod = cells[cCod] ?? "";
    if (/^\d+$/.test(rank) && cod) {
      cur = { codigo: normCod(cod), desc: cells[cDesc] ?? "", qtd: val(r[cQtd]), bruto: val(r[cBruto]), vendedores: [] };
      servicos.push(cur);
    } else if (cur && cells[cDesc] && !rank && !cod) {
      const q = val(r[cQtd]);
      if (q) cur.vendedores.push({ nome: cells[cDesc]!, qtd: q });
    }
  }
  return { periodo, servicos };
}

export type Linha = { nome: string; item: string; qtd: number; valor: number };

/**
 * Distribui cada serviço entre os vendedores: valor do vendedor = (valor bruto do serviço ÷ qtd total do serviço) × qtd do vendedor.
 * Considera apenas os serviços cujos códigos estão em `codigos` (item → lista de códigos).
 */
export function distribuir(rel: Relatorio, codigos: Record<string, string[]>) {
  const porCod = new Map<string, string>();
  for (const [item, cods] of Object.entries(codigos)) for (const c of cods) porCod.set(normCod(c), item);
  const acc = new Map<string, Linha>();
  const usados: (Servico & { item: string; soma: number })[] = [];
  for (const s of rel.servicos) {
    const item = porCod.get(s.codigo);
    if (!item) continue;
    const soma = s.vendedores.reduce((a, v) => a + v.qtd, 0);
    usados.push({ ...s, item, soma });
    const unit = s.qtd ? s.bruto / s.qtd : 0;
    for (const v of s.vendedores) {
      const key = `${v.nome}|${item}`;
      const l = acc.get(key) ?? { nome: v.nome, item, qtd: 0, valor: 0 };
      l.qtd += v.qtd; l.valor += v.qtd * unit;
      acc.set(key, l);
    }
  }
  for (const l of acc.values()) l.valor = Math.round(l.valor * 100) / 100;
  return { linhas: [...acc.values()], usados };
}
