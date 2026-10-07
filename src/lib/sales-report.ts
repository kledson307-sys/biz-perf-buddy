import { norm, parseNum } from "@/components/painel-ui";

export type SalesReport = {
  rows: { nome: string; completo: string; servicos: number; pecas: number; departamento: string }[];
  periodo: { ini: string; fim: string } | null;
};
const label = (v: unknown) => norm(String(v ?? "").trim()).replace(/\s+/g, " ");
const money = (v: unknown) => typeof v === "number" ? v : parseNum(String(v ?? ""));
function iso(value: string) {
  const [d, m, y] = value.split("/").map(Number);
  if (!d || !m || !y) throw new Error("Data inválida no relatório.");
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCDate() !== d || date.getUTCMonth() !== m - 1) throw new Error("Data inválida no relatório.");
  return date.toISOString().slice(0, 10);
}
export function readSalesReport(raw: unknown[][]): SalesReport {
  const result: SalesReport = { rows: [], periodo: null };
  const text = raw.map(r => r.join(" ")).join("\n");
  const dates = text.match(/(?:periodo|período)[^\d\n]*(\d{2}\/\d{2}\/\d{4})\s+a\s+(\d{2}\/\d{2}\/\d{4})/i);
  if (dates?.[1] && dates[2]) {
    result.periodo = { ini: iso(dates[1]), fim: iso(dates[2]) };
    if (result.periodo.ini > result.periodo.fim || result.periodo.ini.slice(0, 7) !== result.periodo.fim.slice(0, 7)) throw new Error("Importe um período de um único mês.");
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
    const nome = String(row[cols.c] ?? "").trim();
    if (!nome || /^(total|empresa|filial|parametros|cod\.|pagina)/.test(label(nome))) continue;
    const sv = cols.s >= 0 ? row[cols.s] : undefined;
    const pv = cols.p >= 0 ? row[cols.p] : undefined;
    if (![sv, pv].some(v => typeof v === "number" || /\d/.test(String(v ?? "")))) continue;
    const key = label(nome);
    const r = map.get(key) ?? { nome, completo: String(row[cols.full] ?? "").trim(), servicos: 0, pecas: 0, departamento: String(row[cols.d] ?? "").trim() };
    r.servicos += money(sv); r.pecas += money(pv);
    if (!Number.isFinite(r.servicos) || !Number.isFinite(r.pecas)) throw new Error("Valor inválido no relatório.");
    map.set(key, r);
  }
  result.rows = [...map.values()];
  if (!result.rows.length) throw new Error("Não encontrei vendas. O cabeçalho deve conter Vendedor ou Consultor e Serviços e/ou Peças.");
  return result;
}