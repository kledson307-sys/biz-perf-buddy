import { norm, parseNum } from "@/components/painel-ui";

export type SalesReport = {
  rows: { nome: string; completo: string; servicos: number; pecas: number; margem: number; departamento: string }[];
  periodo: { ini: string; fim: string } | null;
};
const label = (v: unknown) => norm(String(v ?? "").trim()).replace(/\s+/g, " ");
const money = (v: unknown) => typeof v === "number" ? v : parseNum(String(v ?? ""));
/** Vendedores que entram somados em outro nome no painel. */
const APELIDOS: Record<string, string> = { "NAILTON.R": "NAILTON/THIERRY", "THIERRY.S": "NAILTON/THIERRY", "THERRY.S": "NAILTON/THIERRY", "GEOVANA.L": "GEOVANA.M" };
export const nomeVendedor = (nome: string) => APELIDOS[nome.trim().toUpperCase().replace(/\s+/g, "")] ?? nome.trim();
function iso(value: string) {
  const [d, m, y] = value.split("/").map(Number);
  if (!d || !m || !y) throw new Error("Data inválida no relatório.");
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCDate() !== d || date.getUTCMonth() !== m - 1) throw new Error("Data inválida no relatório.");
  return date.toISOString().slice(0, 10);
}

/** Relatório "Vendas de Peças e Serviços por Vendedor": blocos "Vendedor: LOGIN - NOME" com linhas Total Pc/Sv (valor líquido e margem). */
function lerPorVendedor(raw: unknown[][], result: SalesReport) {
  const map = new Map<string, SalesReport["rows"][number]>();
  let cur: SalesReport["rows"][number] | null = null, total = false;
  let cols: { liq: number; marg: number } | null = null;
  for (const row of raw) {
    const cells = row.map(c => String(c ?? "").trim());
    const first = label(cells[0]);
    if (first === "vendedor:") {
      const [login = "", ...resto] = (cells.find((c, i) => i > 0 && c) ?? "").split(" - ");
      const nome = nomeVendedor(login);
      cur = map.get(label(nome)) ?? { nome, completo: nome === login.trim() ? resto.join(" - ").trim() : "", servicos: 0, pecas: 0, margem: 0, departamento: "" };
      map.set(label(nome), cur); total = false; cols = null; continue;
    }
    if (first.startsWith("total geral")) { cur = null; continue; }
    if (!cur) continue;
    const ps = cells.findIndex(c => /^p\/s$/i.test(c));
    if (ps >= 0) {
      const h = cells.map(label);
      cols = { liq: h.findIndex(x => x === "liquido"), marg: h.findIndex(x => /^margem/.test(x)) };
      continue;
    }
    if (first === "total") total = true;
    if (!total || !cols) continue;
    const tipo = cells.find(c => /^(pc|sv)$/i.test(c))?.toLowerCase();
    if (tipo === "sv") cur.servicos += money(row[cols.liq]);
    else if (tipo === "pc") { cur.pecas += money(row[cols.liq]); cur.margem += money(row[cols.marg]); }
  }
  result.rows = [...map.values()].filter(r => r.servicos || r.pecas);
}

export function readSalesReport(raw: unknown[][]): SalesReport {
  const result: SalesReport = { rows: [], periodo: null };
  const text = raw.map(r => r.join(" ")).join("\n");
  const dates = text.match(/(?:periodo|período)[^\d\n]*(\d{2}\/\d{2}\/\d{4})\s+a\s+(\d{2}\/\d{2}\/\d{4})/i);
  if (dates?.[1] && dates[2]) {
    result.periodo = { ini: iso(dates[1]), fim: iso(dates[2]) };
    if (result.periodo.ini > result.periodo.fim || result.periodo.ini.slice(0, 7) !== result.periodo.fim.slice(0, 7)) throw new Error("Importe um período de um único mês.");
  }
  if (raw.some(r => label(r[0]) === "vendedor:")) {
    lerPorVendedor(raw, result);
    if (!result.rows.length) throw new Error("Não encontrei vendas nos blocos de vendedor do relatório.");
    return result;
  }
  let cols: { c: number; s: number; p: number; d: number; full: number } | null = null;
  const map = new Map<string, SalesReport["rows"][number]>();
  for (const row of raw) {
    const head = row.map(label);
    const c = head.findIndex(h => /^(vendedor|consultor(?: tecnico)?|colaborador|nome)$/.test(h));
    const s = head.findIndex(h => /^(servicos?|mao de obra|valor servicos?)$/.test(h));
    const p = head.findIndex(h => /^(pecas?|valor pecas?)$/.test(h));
    if (c >= 0 && (s >= 0 || p >= 0)) {
      cols = { c, s, p, d: head.findIndex(h => /^(departamento|setor|loja)$/.test(h)), full: head.indexOf("nome completo") };
      continue;
    }
    if (!cols) continue;
    const original = String(row[cols.c] ?? "").trim();
    if (!original || /^(total|empresa|filial|parametros|cod\.|pagina)/.test(label(original))) continue;
    const sv = cols.s >= 0 ? row[cols.s] : undefined;
    const pv = cols.p >= 0 ? row[cols.p] : undefined;
    if (![sv, pv].some(v => typeof v === "number" || /\d/.test(String(v ?? "")))) continue;
    const nome = nomeVendedor(original);
    const key = label(nome);
    const r = map.get(key) ?? { nome, completo: nome === original ? String(row[cols.full] ?? "").trim() : "", servicos: 0, pecas: 0, margem: 0, departamento: String(row[cols.d] ?? "").trim() };
    r.servicos += money(sv); r.pecas += money(pv);
    if (!Number.isFinite(r.servicos) || !Number.isFinite(r.pecas)) throw new Error("Valor inválido no relatório.");
    map.set(key, r);
  }
  result.rows = [...map.values()];
  if (!result.rows.length) throw new Error("Não encontrei vendas. O cabeçalho deve conter Vendedor ou Consultor e Serviços e/ou Peças.");
  return result;
}
