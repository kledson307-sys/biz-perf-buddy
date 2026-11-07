/**
 * Simulado de L.O. (HAUS SSA): leitura do Simulador da diretoria, do Efetivo e da base GNC SYS,
 * e a regra de ajuste das despesas: ajustado = maior entre (simulado | orçado), média dos últimos
 * 5 meses do Efetivo e o já lançado no GNC SYS no mês. Funções puras (testadas).
 */

export type Depto = "SG" | "SC" | "AC" | "PC";
export const DEPTOS: Depto[] = ["SG", "SC", "AC", "PC"];
export const DEPTO_NOME: Record<Depto, string> = { SG: "Serviços Gerais (Oficina)", SC: "Serviços Carroceria (Funilaria)", AC: "Acessórios & Estética", PC: "Peças" };
export const DEPTO_EQUIPE: Record<Depto, string> = {
  SG: "Andressa, Wesley, Pedro e Gilberto",
  SC: "Renan",
  AC: "Geovana e Marcela",
  PC: "Andressa, Wesley, Pedro, Gilberto, Renan, Thierry e Nailton",
};

export type Grupo = "pessoal" | "terceiros" | "ocupacao" | "funcionamento" | "comissoes" | "vendas";
export const GRUPOS: Grupo[] = ["pessoal", "terceiros", "ocupacao", "funcionamento", "comissoes", "vendas"];
export const GRUPO_NOME: Record<Grupo, string> = {
  pessoal: "Despesas com Pessoal + Benefícios",
  terceiros: "Desp. com Serviços Terceiros",
  ocupacao: "Desp. de Ocupação",
  funcionamento: "Despesas de Funcionamento",
  comissoes: "Comissões",
  vendas: "Despesas de Vendas",
};
/** Estruturais: não há plano de corte no curto prazo (contratos, folha base, ocupação). */
export const GRUPO_FIXO: Record<Grupo, boolean> = { pessoal: true, ocupacao: true, terceiros: false, funcionamento: false, comissoes: false, vendas: false };

/** Centros de custo do GNC SYS considerados (foto do filtro) e seus departamentos. */
export const CENTRO_DEPTO: Record<string, Depto> = {
  "OFICINA": "SG", "OFICINA MOTOS": "SG",
  "FUNILARIA E PINTURA": "SC",
  "ACESSORIOS E LIFESTYLE": "AC",
  "PECAS": "PC", "PECAS MOTOS": "PC",
};

export const MESES = ["JANEIRO", "FEVEREIRO", "MARCO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];

export const norm = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

type Rows = unknown[][];

// ---------------- Simulador ----------------
export type LinhaSim = { nome: string; orcado: number; simulado: number; chave?: string | undefined };
export type SimDepto = { linhas: LinhaSim[] };
export type SimuladoDados = { mes: string; deptos: Partial<Record<Depto, SimDepto>> };

function chaveLinha(nome: string): string | undefined {
  const n = norm(nome);
  if (n === "VENDA BRUTA") return "venda";
  if (n.startsWith("LUCRO BRUTO + RENDAS")) return "lbr";
  if (n === "TOTAL DESP. OPERACIONAIS") return "desp";
  if (n === "LUCRO OPERACIONAL") return "lo";
  if (n.startsWith("DESPESAS COM PESSOAL")) return "pessoal";
  if (n.startsWith("DESP. COM SERVICOS TERCEIROS")) return "terceiros";
  if (n.startsWith("DESP. DE OCUPACAO")) return "ocupacao";
  if (n.startsWith("DESPESAS DE FUNCIONAMENTO")) return "funcionamento";
  if (n === "COMISSOES") return "comissoes";
  if (n.startsWith("DESPESAS DE VENDAS")) return "vendas";
  return undefined;
}

/** Converte serial do Excel em "AAAA-MM". */
export function serialParaMes(v: unknown): string | null {
  if (typeof v !== "number" || v < 30000) return null;
  const d = new Date(Date.UTC(1899, 11, 30) + v * 86400000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Lê uma aba de departamento do Simulador (bloco BMW HAUS SSA: ORÇADO, SIMULADO). */
export function lerSimuladoAba(rows: Rows): SimDepto | null {
  const h = rows[1] ?? [];
  const col = h.findIndex((c) => /HAUS SSA/.test(norm(c)) && !/HIST/.test(norm(c)));
  if (col < 0) return null;
  const linhas: LinhaSim[] = [];
  for (let i = 3; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const nome = String(r[0] ?? "").trim();
    if (!nome) continue;
    if (/^DESPESA COM PESSOAL$/.test(norm(nome))) break;
    linhas.push({ nome, orcado: num(r[col]), simulado: num(r[col + 1]), chave: chaveLinha(nome) });
    if (norm(nome) === "LUCRO OPERACIONAL") break;
  }
  return { linhas };
}

// ---------------- Efetivo ----------------
export type EfetDepto = { grupos: Record<Grupo, number[]>; venda: number[]; lbr: number[]; despTotal: number[] };
export type EfetivoDados = { ano: number; deptos: Partial<Record<Depto, EfetDepto>> };

export const EFETIVO_ABA: Record<Depto, string> = { SG: "SG", SC: "SC", AC: "Acessórios", PC: "Peças" };

function grupoDoTotal(n: string): Grupo | "beneficios" | null {
  if (n === "TOTAL PESSOAL") return "pessoal";
  if (n.startsWith("TOTAL BENEFICIOS")) return "beneficios";
  if (n.startsWith("TOTAL SERVICOS DE TERCEIROS")) return "terceiros";
  if (n.startsWith("TOTAL OCUPACAO")) return "ocupacao";
  if (n.startsWith("TOTAL DESP COM FUNCIONAMENTO")) return "funcionamento";
  if (n.startsWith("TOTAL COMISSOES")) return "comissoes";
  if (n.startsWith("TOTAL DESPESAS COM VENDAS")) return "vendas";
  return null;
}

/** Lê uma aba de departamento do Efetivo: totais por grupo nos 12 meses (coluna C.G. do mês). */
export function lerEfetivoAba(rows: Rows): EfetDepto | null {
  const hi = rows.findIndex((r) => (r ?? []).some((c) => norm(c) === "JANEIRO"));
  if (hi < 0) return null;
  const h = rows[hi]!;
  const cols = MESES.map((m) => h.findIndex((c) => norm(c) === m));
  if (cols.some((c) => c < 0)) return null;
  const z = () => Array(12).fill(0) as number[];
  const out: EfetDepto = { grupos: { pessoal: z(), terceiros: z(), ocupacao: z(), funcionamento: z(), comissoes: z(), vendas: z() }, venda: z(), lbr: z(), despTotal: z() };
  const rec = z();
  let lbVisto = false;
  for (let i = hi + 1; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const n = norm(r[1]);
    if (!n) continue;
    const vals = cols.map((c) => num(r[c]));
    const g = grupoDoTotal(n);
    if (g === "beneficios") vals.forEach((v, k) => (out.grupos.pessoal[k]! += v));
    else if (g) vals.forEach((v, k) => (out.grupos[g][k]! += v));
    else if (/^TOTAL ?- ?VENDAS$|^TOTAL DE VENDAS$/.test(n)) out.venda = vals;
    else if (n === "LUCRO BRUTO" && !lbVisto) { vals.forEach((v, k) => (out.lbr[k]! += v)); lbVisto = true; }
    else if (n === "TOTAL DAS RECEITAS") vals.forEach((v, k) => (rec[k] = v));
    else if (n === "TOTAL DESPESAS") { out.despTotal = vals; break; }
  }
  out.lbr = out.lbr.map((v, k) => v + rec[k]!);
  return out;
}

/** Últimos `n` meses com movimento antes do mês alvo (índice 0-11). */
export function mesesBase(e: EfetDepto, mesAlvo: number, n = 5): number[] {
  const idx: number[] = [];
  for (let k = Math.min(mesAlvo - 1, 11); k >= 0 && idx.length < n; k--) if (e.despTotal[k] || e.venda[k]) idx.push(k);
  return idx.reverse();
}
const media = (arr: number[], idx: number[]) => (idx.length ? idx.reduce((s, k) => s + (arr[k] ?? 0), 0) / idx.length : 0);

// ---------------- GNC SYS ----------------
export type LancGnc = { depto: Depto; grupo: Grupo; conta: string; centro: string; fornecedor: string; historico: string; valor: number };
export type GncDados = { mes: string; lancamentos: LancGnc[]; ignorados: number };

function grupoTipoConta(t: string): Grupo | null {
  const n = norm(t);
  if (/BENEFICIO|PESSOAL/.test(n)) return "pessoal";
  if (/TERCEIRO/.test(n)) return "terceiros";
  if (/OCUPA/.test(n)) return "ocupacao";
  if (/FUNCIONAMENTO/.test(n)) return "funcionamento";
  if (/COMISS/.test(n)) return "comissoes";
  if (/VENDA/.test(n)) return "vendas";
  return null;
}

/** Lê a base de lançamentos do GNC SYS (objetos por cabeçalho). Só centros marcados e contas de despesa. */
export function lerGnc(objs: Record<string, unknown>[]): GncDados | null {
  if (!objs.length || !("Desc. Centro" in objs[0]!) || !("Tipo Conta" in objs[0]!)) return null;
  let mes = "";
  let ignorados = 0;
  const lancamentos: LancGnc[] = [];
  for (const o of objs) {
    const ma = String(o["Mês/Ano"] ?? "").match(/(\d{1,2})\/(\d{4})/);
    if (ma && !mes) mes = `${ma[2]}-${ma[1]!.padStart(2, "0")}`;
    const depto = CENTRO_DEPTO[norm(o["Desc. Centro"]).replace(/Ç/g, "C")];
    const grupo = grupoTipoConta(String(o["Tipo Conta"] ?? ""));
    if (!depto || !grupo) { ignorados++; continue; }
    const valor = num(o["Saldo"]) || num(o["Total Débito"]) - num(o["Total Crédito"]);
    lancamentos.push({ depto, grupo, conta: String(o["Desc. Conta Efetivo"] ?? o["Descrição Conta"] ?? ""), centro: String(o["Desc. Centro"] ?? ""), fornecedor: String(o["Fornecedor"] ?? ""), historico: String(o["Histórico"] ?? ""), valor });
  }
  return { mes, lancamentos, ignorados };
}

// ---------------- Regra de ajuste ----------------
export type Origem = "simulado" | "orcado" | "media5" | "gnc";
export type GrupoCalc = { grupo: Grupo; base: number; origemBase: "simulado" | "orcado"; media5: number; gnc: number; ajustado: number; origem: Origem; fixo: boolean };
export type DeptoCalc = {
  depto: Depto; venda: number; lbr: number; grupos: GrupoCalc[];
  despBase: number; despAjustada: number; loOrcado: number; loAjustado: number;
  margemLb: number; breakEven: number; mesesMedia: number[];
};

/** Regra do gestor: simulado abaixo da média 5m → média; GNC maior → GNC. Ou seja, o maior dos três. */
export function ajustar(base: number, media5: number, gnc: number): { valor: number; origem: Origem | "base" } {
  let valor = base, origem: Origem | "base" = "base";
  if (media5 > valor) { valor = media5; origem = "media5"; }
  if (gnc > valor) { valor = gnc; origem = "gnc"; }
  return { valor, origem };
}

export function calcularDepto(depto: Depto, sim: SimDepto | undefined, efet: EfetDepto | undefined, gnc: GncDados | undefined, mesAlvo: number): DeptoCalc {
  const linha = (k: string) => sim?.linhas.find((l) => l.chave === k);
  const val = (l?: LinhaSim) => (l ? (l.simulado > 0 ? l.simulado : l.orcado) : 0);
  const idx = efet ? mesesBase(efet, mesAlvo) : [];
  const comissaoNoPessoal = depto === "AC" && !linha("comissoes");
  const grupos: GrupoCalc[] = GRUPOS.filter((g) => !(comissaoNoPessoal && g === "comissoes")).map((g) => {
    const l = linha(g);
    const origemBase = l && l.simulado > 0 ? "simulado" : "orcado";
    const base = val(l);
    let m = efet ? media(efet.grupos[g], idx) : 0;
    if (comissaoNoPessoal && g === "pessoal" && efet) m += media(efet.grupos.comissoes, idx);
    const gs = (gnc?.lancamentos ?? []).filter((x) => x.depto === depto && (x.grupo === g || (comissaoNoPessoal && g === "pessoal" && x.grupo === "comissoes"))).reduce((s, x) => s + x.valor, 0);
    const a = ajustar(base, m, gs);
    return { grupo: g, base, origemBase, media5: m, gnc: gs, ajustado: a.valor, origem: a.origem === "base" ? origemBase : a.origem, fixo: GRUPO_FIXO[g] };
  });
  const venda = val(linha("venda"));
  const lbr = val(linha("lbr"));
  const despBase = grupos.reduce((s, g) => s + g.base, 0);
  const despAjustada = grupos.reduce((s, g) => s + g.ajustado, 0);
  const margemLb = venda > 0 ? lbr / venda : 0;
  return {
    depto, venda, lbr, grupos, despBase, despAjustada,
    loOrcado: lbr - despBase, loAjustado: lbr - despAjustada,
    margemLb, breakEven: margemLb > 0 ? despAjustada / margemLb : 0, mesesMedia: idx,
  };
}

// ---------------- Leitura gerencial ----------------
export type Ponto = { nivel: "alerta" | "atencao" | "ok" | "estrategia"; depto: Depto | "LOJA"; texto: string };
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function pontosGerenciais(calc: DeptoCalc[], efet?: EfetivoDados, mesAlvo?: number): Ponto[] {
  const p: Ponto[] = [];
  for (const d of calc) {
    for (const g of d.grupos) {
      if (g.ajustado > g.base + 1 && g.base >= 0) p.push({ nivel: "atencao", depto: d.depto, texto: `${GRUPO_NOME[g.grupo]}: simulado ${brl(g.base)} corrigido para ${brl(g.ajustado)} (${g.origem === "gnc" ? "GNC SYS já lançou mais" : "média dos últimos 5 meses"}).` });
      if (g.gnc > 0 && g.ajustado > 0 && g.gnc / g.ajustado >= 0.8 && g.origem !== "gnc") p.push({ nivel: "alerta", depto: d.depto, texto: `${GRUPO_NOME[g.grupo]} já consumiu ${Math.round((g.gnc / g.ajustado) * 100)}% do previsto no GNC SYS.` });
      const e = efet?.deptos[d.depto];
      if (e && mesAlvo && !g.fixo) {
        const idx = d.mesesMedia;
        const pico = idx.find((k) => g.media5 > 0 && (e.grupos[g.grupo][k] ?? 0) > g.media5 * 1.8);
        if (pico !== undefined) p.push({ nivel: "estrategia", depto: d.depto, texto: `${GRUPO_NOME[g.grupo]} teve pico em ${MESES[pico]!.toLowerCase()} (${brl(e.grupos[g.grupo][pico]!)}), que eleva a média. Investigue lançamentos não recorrentes para negociar ou reclassificar.` });
      }
    }
    if (d.loAjustado < 0) p.push({ nivel: "alerta", depto: d.depto, texto: `L.O. ajustado negativo (${brl(d.loAjustado)}). Venda mínima para empatar: ${brl(d.breakEven)} (orçado ${brl(d.venda)}).` });
    else if (d.loAjustado < d.loOrcado) p.push({ nivel: "atencao", depto: d.depto, texto: `L.O. cai de ${brl(d.loOrcado)} para ${brl(d.loAjustado)} com as despesas realistas.` });
    else p.push({ nivel: "ok", depto: d.depto, texto: `L.O. ajustado ${brl(d.loAjustado)} mantém o orçado.` });
    const pes = d.grupos.find((g) => g.grupo === "pessoal");
    if (pes && d.lbr > 0 && pes.ajustado / d.lbr > 0.45) p.push({ nivel: "estrategia", depto: d.depto, texto: `Pessoal consome ${Math.round((pes.ajustado / d.lbr) * 100)}% do lucro bruto (referência até 45%). Avalie dimensionamento da equipe ou aumento de produtividade por pessoa.` });
    const fixos = d.grupos.filter((g) => g.fixo).reduce((s, g) => s + g.ajustado, 0);
    if (d.margemLb > 0) p.push({ nivel: "estrategia", depto: d.depto, texto: `Cobrir só a estrutura fixa (${brl(fixos)}) exige ${brl(fixos / d.margemLb)} de venda; cada R$ 100 vendidos acima do empate geram ~${brl(d.margemLb * 100)} de lucro bruto.` });
  }
  const tot = calc.reduce((s, d) => s + d.loAjustado, 0);
  const totO = calc.reduce((s, d) => s + d.loOrcado, 0);
  p.unshift({ nivel: tot < 0 ? "alerta" : tot < totO ? "atencao" : "ok", depto: "LOJA", texto: `Pós-venda HAUS SSA: L.O. orçado ${brl(totO)} → ajustado ${brl(tot)} (${brl(tot - totO)}).` });
  return p;
}
