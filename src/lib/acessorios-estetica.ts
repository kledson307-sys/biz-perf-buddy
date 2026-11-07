// Acessórios (Geovana) e Estética (Marcela): catálogo Chase, comissões RH e status de venda.
// Regras puras e testadas (acessorios-estetica.test.ts).

export type Depto = "ACESSORIOS" | "ESTETICA";
export type Canal = "NOVO" | "SEMINOVO" | "OFICINA";
export type Segmento = "CARRO" | "MOTO";
export type StatusVenda = "A_FATURAR" | "OS_ABERTA" | "FATURADO" | "CANCELADO";

export const CANAIS: Canal[] = ["NOVO", "SEMINOVO", "OFICINA"];
export const SEGMENTOS: Segmento[] = ["CARRO", "MOTO"];
export const STATUS_LABEL: Record<StatusVenda, string> = { A_FATURAR: "A faturar", OS_ABERTA: "O.S. aberta", FATURADO: "Faturado", CANCELADO: "Cancelado" };
export const MARGEM_IDEAL: Record<Depto, number> = { ACESSORIOS: 0.31, ESTETICA: 0.38 };
export const DEPTO_DMS: Record<Depto, string> = { ACESSORIOS: "ACESSÓRIOS", ESTETICA: "ESTÉTICA" };

/** Catálogo Chase Auto Care: valor sugerido (editável na venda) e premiação fixa do vendedor. PPF é Estética. */
export const CHASE: { nome: string; valor: number; premio: number }[] = [
  { nome: "Polimento Técnico", valor: 1290, premio: 30 },
  { nome: "Cerâmica Lite 2 anos", valor: 2590, premio: 80 },
  { nome: "Cerâmica Premium 3 anos", valor: 2790, premio: 100 },
  { nome: "Revestimento de Couro DQLeather (Nano)", valor: 2390, premio: 50 },
  { nome: "Revestimento de Vidros FlyBy 30 (Nano)", valor: 890, premio: 30 },
  { nome: "Revestimento de Plásticos Externos", valor: 790, premio: 30 },
  { nome: "Tratamento em Couro Novos", valor: 890, premio: 30 },
  { nome: "Tratamento em Couro Usados", valor: 990, premio: 30 },
  { nome: "Película Black Carbon", valor: 990, premio: 30 },
  { nome: "Película Vision IR PRO", valor: 1290, premio: 50 },
  { nome: "Película PS4", valor: 1590, premio: 60 },
  { nome: "Vision IR PRO 75% Para-brisa/Teto", valor: 1290, premio: 50 },
  { nome: "PPF XPEL Gloss (Quinas e maçanetas)", valor: 690, premio: 30 },
  { nome: "PPF XPEL Gloss Frente", valor: 10990, premio: 300 },
  { nome: "PPF XPEL Gloss Full", valor: 19990, premio: 500 },
  { nome: "Película Para-brisas XPEL (Clear Plex)", valor: 5000, premio: 100 },
  { nome: "PPF XPEL Matte Frente", valor: 12990, premio: 300 },
  { nome: "PPF XPEL Matte Full", valor: 22990, premio: 500 },
];

/** % de comissão de acessórios sobre a produção líquida do mês (faixa aplicada sobre o total). */
export function pctAcessorios(canal: Canal, producao: number): number {
  if (producao <= 0) return 0;
  if (canal === "OFICINA") return 0.03; // Pós-vendas: 3% fixo
  if (producao <= 30000) return 0.03;
  if (producao <= 45000) return 0.04;
  return 0.05;
}
export const PCT_OBSOLETO = 0.02;

export type VendaC = {
  id?: string; departamento: Depto; vendedor: string; canal: Canal | string; segmento: Segmento | string;
  valor: number; premiacao: number; devolucao: number; obsoleto: boolean; status: StatusVenda | string;
  cliente?: string; produto?: string; os_n?: string; dia?: string; created_at?: string;
};

export type LinhaComissao = { vendedor: string; canal: string; faturado: number; devolucao: number; producao: number; pct: number; comissao: number; obsoleto: number; comObsoleto: number; premiacao: number; itens: number; total: number };

/** Folha de comissão do RH — só vendas FATURADAS, separada por departamento. */
export function folhaComissao(vendas: VendaC[], depto: Depto): LinhaComissao[] {
  const m = new Map<string, LinhaComissao>();
  for (const v of vendas) {
    if (v.departamento !== depto || v.status !== "FATURADO" || !v.vendedor) continue;
    const canal = depto === "ESTETICA" ? "" : String(v.canal);
    const k = `${v.vendedor.toUpperCase()}|${canal}`;
    const l = m.get(k) ?? { vendedor: v.vendedor.toUpperCase(), canal, faturado: 0, devolucao: 0, producao: 0, pct: 0, comissao: 0, obsoleto: 0, comObsoleto: 0, premiacao: 0, itens: 0, total: 0 };
    l.itens++;
    if (depto === "ESTETICA") { l.faturado += v.valor; l.devolucao += v.devolucao; l.premiacao += v.premiacao; }
    else if (v.obsoleto) l.obsoleto += v.valor - v.devolucao;
    else { l.faturado += v.valor; l.devolucao += v.devolucao; }
    m.set(k, l);
  }
  return [...m.values()].map((l) => {
    l.producao = l.faturado - l.devolucao;
    if (depto === "ACESSORIOS") {
      l.pct = pctAcessorios(l.canal as Canal, l.producao);
      l.comissao = round2(l.producao * l.pct);
      l.comObsoleto = round2(l.obsoleto * PCT_OBSOLETO);
      l.total = round2(l.comissao + l.comObsoleto);
    } else l.total = round2(l.premiacao);
    return l;
  }).sort((a, b) => a.canal.localeCompare(b.canal) || b.total - a.total);
}
const round2 = (n: number) => Math.round(n * 100) / 100;

const kOs = (v: string) => v.replace(/\D/g, "").replace(/^0+/, "");
/** Status automático: O.S. encerrada/faturada → FATURADO; presente no Controle O.S. → OS_ABERTA. Nunca rebaixa nem mexe em cancelada. */
export function statusConciliado(v: Pick<VendaC, "status" | "os_n">, abertas: string[], faturadas: string[]): StatusVenda {
  const s = v.status as StatusVenda;
  if (s === "CANCELADO" || s === "FATURADO" || !v.os_n || !kOs(v.os_n)) return s;
  const k = kOs(v.os_n);
  if (faturadas.some((x) => kOs(x) === k)) return "FATURADO";
  if (abertas.some((x) => kOs(x) === k)) return "OS_ABERTA";
  return s;
}

/** Venda a faturar parada há mais de 15 dias sem O.S. */
export function estagnada(v: Pick<VendaC, "status" | "dia">, hoje: string): boolean {
  if (v.status !== "A_FATURAR" || !v.dia) return false;
  return (Date.parse(hoje) - Date.parse(v.dia)) / 86400000 > 15;
}

export type LinhaRvd = { vendedor: string; canal: Canal; segmento: Segmento; faturado: number; aFaturar: number; veiculos: number; target: number };
const numv = (x: unknown) => (typeof x === "number" ? x : Number(String(x ?? "").replace(/\./g, "").replace(",", ".")) || 0);
/** Lê a planilha RVD (aba da loja) por conteúdo: blocos "NOVO (CARRO)", "SEMINOVO (MOTO)", "OFICINA (CARRO)"… */
export function parseRvd(rows: unknown[][]): LinhaRvd[] {
  const out: LinhaRvd[] = [];
  let bloco: { canal: Canal; segmento: Segmento; target: number } | null = null;
  let cols: Record<string, number> = {};
  for (const r of rows) {
    const cel = r.map((c) => String(c ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase());
    const ti = cel.findIndex((c) => /^(NOVO|SEMINOVO|OFICINA) \((CARRO|MOTO)\)$/.test(c));
    if (ti >= 0) {
      const m = cel[ti]!.match(/^(\w+) \((\w+)\)$/)!;
      const nums = r.slice(ti + 1).map(numv).filter((n) => n > 0);
      bloco = { canal: m[1] as Canal, segmento: m[2] as Segmento, target: nums.length ? nums[nums.length - 1]! : 0 };
      cols = {}; continue;
    }
    const vi = cel.indexOf("VENDEDOR");
    if (vi >= 0 && bloco) {
      const f = (re: RegExp) => cel.findIndex((c, i) => i > vi && re.test(c));
      cols = { nome: vi, fat: f(/FATURADO/), af: f(/^A FATURAR/), vf: f(/^V\.? ?FATURADOS/), va: f(/^V\.? ?A FAT/), tv: f(/^TOTAL DE V/), pass: f(/^PASSAG/) };
      continue;
    }
    if (!bloco || cols["nome"] === undefined) continue;
    const nome = cel[cols["nome"]] ?? "";
    if (!nome || nome === "TOTAL") { if (nome === "TOTAL") cols = {}; continue; }
    const g = (k: string) => (cols[k]! >= 0 ? numv(r[cols[k]!]) : 0);
    const veiculos = bloco.canal === "OFICINA" ? g("pass") : cols["tv"]! >= 0 ? g("tv") : g("vf") + g("va");
    out.push({ vendedor: String(r[cols["nome"]]).trim().toUpperCase().replace(/\s+/g, " "), canal: bloco.canal, segmento: bloco.segmento, faturado: g("fat"), aFaturar: g("af"), veiculos: Math.round(veiculos), target: bloco.target });
  }
  return out;
}
