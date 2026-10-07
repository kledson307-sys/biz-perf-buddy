import { norm, parseNum } from "@/components/painel-ui";

export type Grupo = "servicos" | "pecas";

/** Catálogo de itens agregados. `cod` = códigos padrão do sistema (podem ser alterados pelo usuário na tela). */
export const ITENS: { k: string; nome: string; g: Grupo; re: RegExp; cod: string[] }[] = [
  { k: "limpar", nome: "Limpar", g: "servicos", re: /limp/, cod: ["LIMP001", "LIMPSIST", "LIMP05", "LIMP04", "LIMPFREIO", "LIMP08", "LIMP07", "LIMPCORRENTE", "LIMP10"] },
  { k: "alinhamento", nome: "Alinhamento & Balanceamento", g: "servicos", re: /alinh|balanc/, cod: ["0000170", "ALINHA01"] },
  { k: "oxi", nome: "Oxi Capacete", g: "servicos", re: /oxi|capacete/, cod: ["OXICAP"] },
  { k: "brazzo", nome: "Brazzo", g: "pecas", re: /brazzo/, cod: ["1350 117", "1350 195", "1350 218", "1350 249", "1350 288", "1350 299", "1350 327"] },
  { k: "tunap", nome: "Tunap", g: "pecas", re: /tunap/, cod: ["F96500200B2", "MP104004400ABT", "MP10900500ABT", "47658", "TUNAP7000", "F37500200AT", "MF95700200X3T", "1299600150X6T", "259900145XT"] },
];
export const GRUPO_NOME: Record<Grupo, string> = { servicos: "Serviços agregados", pecas: "Peças agregadas" };

/** Chave de comparação do código: maiúsculas e sem espaços ("1350 117" = "1350117"). */
export const normCod = (s: string) => s.replace(/\s+/g, "").toUpperCase();
/** Lista de códigos digitada pelo usuário, separada por vírgula, ponto e vírgula ou quebra de linha (espaços fazem parte do código). */
export const splitCods = (s: string) => s.split(/[,;\n]+/).map((c) => c.trim().replace(/\s+/g, " ").toUpperCase()).filter(Boolean);

type Cell = string | number | null | undefined;
/** Venda de um vendedor. `valor` e `dia` só existem quando o relatório traz cada venda separada (lista de itens). */
export type Venda = { nome: string; qtd: number; valor?: number; dia?: string };
export type Servico = { codigo: string; desc: string; qtd: number; bruto: number; vendedores: Venda[] };
/** `porDia`: o relatório traz a data de cada venda, então os valores ficam no dia certo (e não acumulados no último dia). */
export type Relatorio = { periodo: { ini: string; fim: string } | null; servicos: Servico[]; porDia?: boolean };

const txt = (c: Cell) => (c == null ? "" : String(c).trim());
const val = (c: Cell) => (typeof c === "number" ? c : parseNum(txt(c)));
/** Data da venda: "06/10/2026 09:19:30" ou número de série do Excel → "2026-10-06". */
const dataISO = (c: Cell) => {
  if (typeof c === "number" && c > 20000) return new Date(Math.round((c - 25569) * 86400000)).toISOString().slice(0, 10);
  const m = txt(c).match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
};

/** Lê o relatório "Lista de itens vendidos no período" (uma linha por venda, com Vendedor, Quantidade e Preço Final). */
function lerLista(rows: Cell[][], hi: number): Relatorio {
  const head = rows[hi]!.map((c) => norm(txt(c)).replace(/\s+/g, " "));
  const col = (re: RegExp) => head.findIndex((h) => re.test(h));
  const cCod = col(/^cod\.? ?item$|^codigo item$|^item$/), cDesc = col(/^descri/), cQtd = col(/^quantidade$|^qtde?\.?$/);
  const cFinal = col(/^preco final$|^valor final$|^valor total$/), cVend = col(/^vendedor$/), cDia = col(/^venda$|^data/);
  if (cCod < 0 || cQtd < 0 || cFinal < 0 || cVend < 0) throw new Error('O relatório de peças precisa das colunas "Cód. Item", "Quantidade", "Preço Final" e "Vendedor".');
  const porCod = new Map<string, Servico>();
  const dias: string[] = [];
  for (const r of rows.slice(hi + 1)) {
    const cod = txt(r[cCod]), nome = txt(r[cVend]);
    if (!cod || !nome) continue;
    const dia = cDia >= 0 ? dataISO(r[cDia]) : "";
    if (dia) dias.push(dia);
    const qtd = val(r[cQtd]), valor = val(r[cFinal]);
    const k = normCod(cod);
    const s = porCod.get(k) ?? { codigo: k, desc: cDesc >= 0 ? txt(r[cDesc]) : "", qtd: 0, bruto: 0, vendedores: [] };
    s.qtd += qtd; s.bruto += valor;
    s.vendedores.push({ nome, qtd, valor, ...(dia ? { dia } : {}) });
    porCod.set(k, s);
  }
  dias.sort();
  const periodo = dias.length ? { ini: dias[0]!, fim: dias[dias.length - 1]! } : null;
  return { periodo, servicos: [...porCod.values()], porDia: dias.length > 0 };
}

/** Lê o relatório do sistema: "Ranking de Serviços/Peças" (linhas de item seguidas das linhas por vendedor) ou "Lista de itens vendidos". */
export function lerRanking(rows: Cell[][]): Relatorio {
  const li = rows.findIndex((r) => {
    const h = r.map((c) => norm(txt(c)));
    return h.includes("vendedor") && h.some((c) => /^preco final$|^valor final$/.test(c)) && h.some((c) => /^quantidade$|^qtde?\.?$/.test(c));
  });
  if (li >= 0) return lerLista(rows, li);
  let periodo: Relatorio["periodo"] = null;
  for (const r of rows) for (const c of r) {
    const m = txt(c).match(/(\d{2})\/(\d{2})\/(\d{4})\s*a\s*(\d{2})\/(\d{2})\/(\d{4})/);
    if (m && /per[ií]odo/i.test(txt(c))) { periodo = { ini: `${m[3]}-${m[2]}-${m[1]}`, fim: `${m[6]}-${m[5]}-${m[4]}` }; break; }
  }
  const hi = rows.findIndex((r) => r.some((c) => norm(txt(c)) === "rank") && r.some((c) => /^qtde?\.?$|^quantidade$/.test(norm(txt(c)))));
  if (hi < 0) throw new Error('Não encontrei o cabeçalho do relatório (ranking com "Rank", "Serviço"/"Peça", "Qtde", "Bruto", ou lista de itens com "Cód. Item", "Quantidade", "Preço Final", "Vendedor").');
  const head = rows[hi]!.map((c) => norm(txt(c)));
  const col = (re: RegExp) => head.findIndex((h) => re.test(h));
  const cRank = col(/^rank$/), cCod = col(/^(servico|peca|produto|codigo|cod\.?$|item$|referencia)/), cDesc = col(/^descri/), cQtd = col(/^qtde?\.?$|^quantidade$/);
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
export type Registro = Linha & { dia?: string };

/**
 * Distribui cada item entre os vendedores. No ranking: valor do vendedor = (valor bruto ÷ qtd total) × qtd do vendedor.
 * Na lista de itens vendidos o valor de cada venda já vem pronto (Preço Final) e a data da venda é mantida.
 * Considera apenas os itens cujos códigos estão em `codigos` (item → lista de códigos).
 * `linhas` = total por consultor e item (prévia); `registros` = o que é gravado (por dia quando o relatório traz a data).
 */
export function distribuir(rel: Relatorio, codigos: Record<string, string[]>) {
  const porCod = new Map<string, string>();
  for (const [item, cods] of Object.entries(codigos)) for (const c of cods) porCod.set(normCod(c), item);
  const acc = new Map<string, Linha>();
  const reg = new Map<string, Registro>();
  const usados: (Servico & { item: string; soma: number })[] = [];
  const somar = <T extends Linha>(m: Map<string, T>, key: string, base: T, qtd: number, valor: number) => {
    const l = m.get(key) ?? base;
    l.qtd += qtd; l.valor += valor;
    m.set(key, l);
  };
  for (const s of rel.servicos) {
    const item = porCod.get(s.codigo);
    if (!item) continue;
    const soma = s.vendedores.reduce((a, v) => a + v.qtd, 0);
    usados.push({ ...s, item, soma });
    const unit = s.qtd ? s.bruto / s.qtd : 0;
    for (const v of s.vendedores) {
      const valor = v.valor ?? v.qtd * unit;
      somar(acc, `${v.nome}|${item}`, { nome: v.nome, item, qtd: 0, valor: 0 }, v.qtd, valor);
      somar(reg, `${v.nome}|${item}|${v.dia ?? ""}`, { nome: v.nome, item, qtd: 0, valor: 0, ...(v.dia ? { dia: v.dia } : {}) }, v.qtd, valor);
    }
  }
  for (const l of [...acc.values(), ...reg.values()]) l.valor = Math.round(l.valor * 100) / 100;
  return { linhas: [...acc.values()], registros: [...reg.values()], usados };
}
