import { norm } from "@/components/painel-ui";
import { nomeVendedor } from "@/lib/sales-report";
import { TIPOS_INTERNOS } from "@/lib/mecanicos";

/** Linha diária de faturamento por consultor (login já com apelidos aplicados). */
export type FatDia = { login: string; dia: string; servicos: number; pecas: number; margem: number };
export type FatHistorico = { linhas: FatDia[]; meses: string[]; ignorados: Map<string, number> };

const txt = (v: unknown) => String(v ?? "").trim();
const low = (v: unknown) => norm(txt(v)).toLowerCase();
const num = (v: unknown) => (typeof v === "number" ? v : Number(txt(v).replace(/\./g, "").replace(",", ".")) || 0);
const iso = (v: unknown): string => {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const m = txt(v).match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
};

/** Reconhece o "Faturamento de serviços" em linhas (ID O.S. + Encerrada + Serv. Líquido). */
export const ehFatServicos = (raw: unknown[][]) =>
  raw.slice(0, 15).some((r) => { const h = r.map(low); return h.some((x) => /^id ?o\.?s\.?$/.test(x)) && h.includes("encerrada") && h.some((x) => /^serv\.? liq/.test(x)); });

/** Reconhece o "Faturamento de peças" em linhas (Cód. Item + Venda + Preço Liquido + Vendedor). */
export const ehFatPecas = (raw: unknown[][]) =>
  raw.slice(0, 15).some((r) => { const h = r.map(low); return h.includes("cod. item") && h.includes("venda") && h.some((x) => /^preco liquido/.test(x)) && h.includes("vendedor"); });

function cabecalho(raw: unknown[][], test: (h: string[]) => boolean) {
  const hi = raw.findIndex((r) => test(r.map(low)));
  return hi < 0 ? null : { hi, h: raw[hi]!.map(low) };
}

/** Lê o faturamento de serviços: mão de obra líquida por consultor (login) no dia do encerramento, sem O.S. internas. */
export function lerFatServicos(raw: unknown[][]): FatHistorico | null {
  const cab = cabecalho(raw, (h) => h.some((x) => /^id ?o\.?s\.?$/.test(x)) && h.includes("encerrada") && h.some((x) => /^serv\.? liq/.test(x)));
  if (!cab) return null;
  const { h, hi } = cab;
  const cEnc = h.indexOf("encerrada"), cServ = h.findIndex((x) => /^serv\.? liq/.test(x)), cTipo = h.findIndex((x) => /^tipo$/.test(x));
  const cCons = h.lastIndexOf("consultor"); // o último "Consultor" é o login (o primeiro é o nome completo)
  const linhas: FatDia[] = []; const ignorados = new Map<string, number>();
  for (const r of raw.slice(hi + 1)) {
    const dia = iso(r[cEnc]); if (!dia) continue;
    if (cTipo >= 0 && TIPOS_INTERNOS.has(txt(r[cTipo]).toUpperCase())) continue;
    const s = num(r[cServ]); const login = nomeVendedor(txt(r[cCons]));
    if (!login) continue;
    if (!s) continue;
    linhas.push({ login, dia, servicos: s, pecas: 0, margem: 0 });
  }
  return finalizar(linhas, ignorados);
}

/** Lê o faturamento de peças: valor líquido e margem (líquido − contábil × qtd) por vendedor no dia da venda, sem O.S. internas nem devolvidas. */
export function lerFatPecas(raw: unknown[][]): FatHistorico | null {
  const cab = cabecalho(raw, (h) => h.includes("cod. item") && h.includes("venda") && h.some((x) => /^preco liquido/.test(x)) && h.includes("vendedor"));
  if (!cab) return null;
  const { h, hi } = cab;
  const cVenda = h.indexOf("venda"), cVend = h.indexOf("vendedor"), cTipo = h.findIndex((x) => /^tipo os$/.test(x));
  const cQtd = h.indexOf("quantidade"), cLiq = h.findIndex((x) => /^preco liquido/.test(x)), cCont = h.findIndex((x) => /^preco contabil/.test(x)), cDev = h.indexOf("devolvida");
  const linhas: FatDia[] = []; const ignorados = new Map<string, number>();
  for (const r of raw.slice(hi + 1)) {
    const dia = iso(r[cVenda]); if (!dia) continue;
    if (cTipo >= 0 && TIPOS_INTERNOS.has(txt(r[cTipo]).toUpperCase())) continue;
    if (cDev >= 0 && txt(r[cDev])) continue; // devoluções saem pelo ajuste manual
    const liq = num(r[cLiq]); const login = nomeVendedor(txt(r[cVend]));
    if (!login || !liq) continue;
    const margem = cCont >= 0 ? liq - num(r[cCont]) * num(r[cQtd]) : 0;
    linhas.push({ login, dia, servicos: 0, pecas: liq, margem });
  }
  return finalizar(linhas, ignorados);
}

function finalizar(linhas: FatDia[], ignorados: Map<string, number>): FatHistorico {
  const meses = [...new Set(linhas.map((l) => l.dia.slice(0, 7)))].sort();
  return { linhas, meses, ignorados };
}

/** Consolida por consultor (id) e dia; devolve logins sem cadastro em `ignorados`. */
export function consolidarFat(fat: FatHistorico, cons: { id: string; nome: string }[]): { rows: { consultant_id: string; dia: string; servicos: number; pecas: number; margem_pecas: number }[]; ignorados: string[] } {
  const mapa = new Map(cons.map((c) => [norm(c.nome), c.id]));
  const acc = new Map<string, { consultant_id: string; dia: string; servicos: number; pecas: number; margem_pecas: number }>();
  const fora = new Set<string>();
  for (const l of fat.linhas) {
    const id = mapa.get(norm(l.login));
    if (!id) { fora.add(l.login); continue; }
    const k = `${id}|${l.dia}`;
    const cur = acc.get(k) ?? { consultant_id: id, dia: l.dia, servicos: 0, pecas: 0, margem_pecas: 0 };
    cur.servicos += l.servicos; cur.pecas += l.pecas; cur.margem_pecas += l.margem;
    acc.set(k, cur);
  }
  return { rows: [...acc.values()], ignorados: [...fora].sort() };
}
