import { TIPOS_INTERNOS } from "@/lib/mecanicos";

/** Faturamento por data real (dia → R$) e retornos por chassi, lidos das planilhas Faturamento de Peças e Passagens. */
export type Diario = Record<string, { s?: number; p?: number }>;
export type Retorno = { chassi: string; placa: string; cliente: string; modelo: string; osAnterior: string; dataAnterior: string; tipoAnterior: string; os: string; data: string; tipo: string; dias: number; tecnico: string; tecnicoAnterior: string; consultor: string };

const n = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
const num = (v: unknown) => typeof v === "number" ? v : Number(String(v ?? "").replace(/\./g, "").replace(",", ".")) || 0;

/** Converte "16/10/2026 14:32" ou Date em "2026-10-16". */
export function isoDia(v: unknown): string | null {
  if (v instanceof Date && !isNaN(+v)) return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`;
  const m = String(v ?? "").match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}` : null;
}
const diasEntre = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);

/** Peças: soma Preço Final por data da Venda, sem O.S. internas, só do mês. */
export function pecasPorDia(raw: unknown[][], mes: string): Diario {
  const hi = raw.findIndex((r) => { const h = r.map(n); return h.includes("cod. item") && h.includes("preco final"); });
  if (hi < 0) return {};
  const h = raw[hi]!.map(n); const val = h.indexOf("preco final"), dt = h.indexOf("venda"), tipo = h.indexOf("tipo os");
  const out: Diario = {}; if (dt < 0) return out;
  for (const r of raw.slice(hi + 1)) {
    if (tipo >= 0 && TIPOS_INTERNOS.has(String(r[tipo] ?? "").trim().toUpperCase())) continue;
    const d = isoDia(r[dt]); if (!d?.startsWith(mes)) continue;
    { const x = (out[d] ??= {}); x.p = (x.p ?? 0) + num(r[val]); }
  }
  return out;
}

type OsLinha = { os: string; data: string; tipo: string; chassi: string; placa: string; cliente: string; modelo: string; cons: string; prods: Set<string>; tmos: Set<string>; serv: number };

/** Passagens: uma linha por O.S. (sem internas), com data de encerramento e valor de serviço líquido. */
export function osDasPassagens(raw: unknown[][]): OsLinha[] {
  const hi = raw.findIndex((r) => { const h = r.map(n); return h.some((x) => /^id ?o\.?s\.?$/.test(x)) && h.includes("encerrada"); });
  if (hi < 0) return [];
  const h = raw[hi]!.map(n); const c = (x: string) => h.indexOf(x);
  const k = { os: h.findIndex((x) => /^id ?o\.?s\.?$/.test(x)), tipo: c("tipo"), chassi: c("chassi"), placa: c("placa"), cli: c("cliente"), mod: c("modelo"), cons: c("consultor"), prod: c("produtivo"), tmo: c("tmo ref."), enc: c("encerrada"), sv: c("serv. liquido") };
  const m = new Map<string, OsLinha>();
  for (const r of raw.slice(hi + 1)) {
    const os = String(r[k.os] ?? "").trim(); if (!/\d/.test(os)) continue;
    const tipo = String(r[k.tipo] ?? "").trim().toUpperCase(); if (TIPOS_INTERNOS.has(tipo)) continue;
    const data = isoDia(r[k.enc]); if (!data) continue;
    const o = m.get(os) ?? { os, data, tipo, chassi: String(r[k.chassi] ?? "").trim().toUpperCase(), placa: String(r[k.placa] ?? "").trim(), cliente: String(r[k.cli] ?? "").trim(), modelo: String(r[k.mod] ?? "").trim(), cons: String(r[k.cons] ?? "").trim(), prods: new Set<string>(), tmos: new Set<string>(), serv: 0 };
    const p = String(r[k.prod] ?? "").trim(); if (p) o.prods.add(p.toUpperCase());
    const t = String(r[k.tmo] ?? "").trim(); if (t) o.tmos.add(t);
    if (k.sv >= 0) o.serv = Math.max(o.serv, num(r[k.sv]));
    m.set(os, o);
  }
  return [...m.values()];
}

export function servicosPorDia(oss: OsLinha[], mes: string): Diario {
  const out: Diario = {};
  for (const o of oss) if (o.data.startsWith(mes) && o.serv) { const x = (out[o.data] ??= {}); x.s = (x.s ?? 0) + o.serv; }
  return out;
}

/** Revisão programada (BSI, Revisão C7/M7 pelo TMO 0000105*, Revisão Moto 0000111/0000119) não conta como retorno. */
export function ehRevisao(tipo: string, tmos: Iterable<string>): boolean {
  if (tipo === "BS") return true;
  const t = [...tmos];
  if ((tipo === "C7" || tipo === "M7") && t.some((x) => x.startsWith("0000105"))) return true;
  if (/^N/.test(tipo) && t.some((x) => x.startsWith("0000111") || x.startsWith("0000119"))) return true;
  return false;
}
/** Tipos de O.S. de reparo/garantia que caracterizam retorno. */
const REPARO = new Set(["C7", "M7", "C4", "MG", "NG", "N7", "N5", "NF"]);

/** Retorno: mesmo chassi volta em até `janela` dias com O.S. de reparo/garantia (C7/M7/C4/MG/NG/N7/N5/NF, sem revisão). */
export function retornosPorChassi(oss: OsLinha[], janela = 60): Retorno[] {
  const porChassi = new Map<string, OsLinha[]>();
  for (const o of oss) if (o.chassi.length >= 6) (porChassi.get(o.chassi) ?? porChassi.set(o.chassi, []).get(o.chassi)!).push(o);
  const out: Retorno[] = [];
  for (const lista of porChassi.values()) {
    lista.sort((a, b) => a.data.localeCompare(b.data) || a.os.localeCompare(b.os));
    for (let i = 1; i < lista.length; i++) {
      const o = lista[i]!, a = lista[i - 1]!; const d = diasEntre(a.data, o.data);
      if (d < 0 || d > janela || !REPARO.has(o.tipo) || ehRevisao(o.tipo, o.tmos)) continue;
      out.push({ chassi: o.chassi, placa: o.placa, cliente: o.cliente, modelo: o.modelo, osAnterior: a.os, dataAnterior: a.data, tipoAnterior: a.tipo, os: o.os, data: o.data, tipo: o.tipo, dias: d,
        tecnico: [...o.prods].join(", "), tecnicoAnterior: [...a.prods].join(", "), consultor: o.cons });
    }
  }
  return out.sort((x, y) => y.data.localeCompare(x.data));
}

/** Junta diários de fontes diferentes (peças e serviços). */
export const juntarDiario = (a: Diario, b: Diario): Diario => {
  const o: Diario = JSON.parse(JSON.stringify(a));
  for (const [d, v] of Object.entries(b)) o[d] = { ...o[d], ...v };
  return o;
};
