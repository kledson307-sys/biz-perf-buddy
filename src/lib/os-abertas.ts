import { norm, parseNum } from "@/components/painel-ui";
import { nomeVendedor } from "@/lib/sales-report";

// Vendedores considerados na importação de OS abertas (demais são ignorados).
export const OS_PERMITIDOS = new Set(["p.benigno", "andressa.o", "gilberto.s", "wesley.f", "renan.o", "geovana.m", "marcela.s"]);
const numRe = /^\d{3,}$/;
const toNum = (v: unknown) => {
  const s = String(v ?? "").trim();
  if (!s || s.includes("%")) return 0; // "7,0%" é porcentagem, não valor
  const n = parseFloat(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

// Tipos de O.S. que entram com apenas 30% do valor na projeção.
const TIPOS_30 = new Set(["c4", "mg", "ng"]);
// Únicos tipos de O.S. considerados na importação; os demais são ignorados.
export const TIPOS_OK = new Set(["ac", "bs", "c4", "c7", "cf", "c5", "mc", "mf", "ms", "mg", "nc", "n7", "n5", "nf", "ng"]);

export type OsLinha = { nome: string; servicos: number; pecas: number };

/** Reconhece o relatório "O.S. Abertas" em tabela (Número, Tipo, Recep., Serv. Líquido, Itens Líquido…). */
export const ehOsAbertas = (raw: unknown[][]) =>
  raw.slice(0, 20).some((r) => r.some((c) => norm(String(c)).trim() === "tipo") && r.some((c) => norm(String(c)).startsWith("recep")))
  || raw.slice(0, 10).some((r) => r.some((c) => norm(String(c ?? "")) === "numero"));

// Relatório "O.S. Abertas" em tabela (Número, Tipo, Recep., Serv. Líquido, Itens Líquido…).
export function lerOsTabela(raw: unknown[][]): OsLinha[] | null {
  const h = raw.findIndex((r) => r.some((c) => norm(String(c)).trim() === "tipo") && r.some((c) => norm(String(c)).startsWith("recep")));
  if (h < 0) return null;
  const head = (raw[h] ?? []).map((c) => norm(String(c)).trim());
  const col = (re: RegExp) => head.findIndex((c) => re.test(c));
  const cT = col(/^tipo$/), cR = col(/^recep/), cS = col(/^serv/), cP = col(/^itens/), cE = col(/^emiss/);
  if (cS < 0 || cP < 0) return null;
  const num = (v: unknown) => typeof v === "number" ? v : toNum(v);
  // GEOVANA.M: só contam O.S. abertas a partir de 20/09/2026 (data de emissão).
  const GEO_MIN = new Date(2026, 8, 20).getTime();
  const dataEmissao = (v: unknown): number | null => {
    if (v instanceof Date) return v.getTime();
    if (typeof v === "number") { const d = new Date(Math.round((v - 25569) * 86400000)); return d.getTime(); }
    const m = String(v ?? "").trim().match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    return m ? new Date(+(m[3] ?? 0), +(m[2] ?? 1) - 1, +(m[1] ?? 1)).getTime() : null;
  };
  const res: OsLinha[] = [];
  for (const r of raw.slice(h + 1)) {
    const nome = nomeVendedor(String(r[cR] ?? ""));
    if (!nome || !OS_PERMITIDOS.has(norm(nome))) continue;
    const tipo = norm(String(r[cT] ?? "")).trim();
    if (cT >= 0 && !TIPOS_OK.has(tipo)) continue;
    if (norm(nome) === "geovana.m" && cE >= 0) {
      const d = dataEmissao(r[cE]);
      if (d === null || d < GEO_MIN) continue;
    }
    const f = TIPOS_30.has(tipo) ? 0.3 : 1;
    res.push({ nome, servicos: num(r[cS]) * f, pecas: num(r[cP]) * f });
  }
  return res.length ? res : null;
}

// Relatório do sistema "O.S. Abertas": bloco por O.S. (número na col. C, veículo na col. F,
// consultor na linha seguinte, Total Líq. Peças col. U e Total Serviços col. W).
export function lerOsSistema(raw: unknown[][]): OsLinha[] | null {
  // Detecta o deslocamento de colunas pela célula "Numero" do cabeçalho
  let off = -1;
  for (let i = 0; i < Math.min(10, raw.length) && off < 0; i++) {
    const row = raw[i] ?? [];
    for (let c = 0; c < row.length; c++) if (norm(String(row[c] ?? "")) === "numero") { off = c; break; }
  }
  if (off < 0) return null;
  const res: OsLinha[] = [];
  for (let i = 0; i < raw.length; i++) {
    const cN = String(raw[i]?.[off] ?? "").trim();
    const cV = String(raw[i]?.[off + 3] ?? "").trim();
    if (!numRe.test(cN) || !cV || numRe.test(cV)) continue;
    let cons = "";
    for (let j = i + 1; j < Math.min(i + 5, raw.length); j++) {
      const v = String(raw[j]?.[off + 3] ?? "").trim();
      if (v) { cons = nomeVendedor(v); break; }
    }
    if (!cons || !OS_PERMITIDOS.has(norm(cons))) continue;
    res.push({ nome: cons, servicos: toNum(raw[i]?.[off + 20]), pecas: toNum(raw[i]?.[off + 18]) });
  }
  return res.length ? res : null;
}

/** Consolida linhas de O.S. abertas por consultor (id), ignorando quem não está na equipe. */
export function consolidarOs(rows: OsLinha[], linhas: { c: { id: string; nome: string } }[]): { valores: Record<string, { s: number; p: number }>; fora: string[] } {
  const key = (v: string) => norm(v.trim());
  const n: Record<string, { s: number; p: number }> = {}; const fora: string[] = [];
  for (const r of rows) {
    const c = linhas.find((l) => key(l.c.nome) === key(r.nome));
    if (!c) { fora.push(r.nome); continue; }
    if (!OS_PERMITIDOS.has(key(c.c.nome))) continue;
    const a = n[c.c.id] ?? { s: 0, p: 0 };
    n[c.c.id] = { s: a.s + r.servicos, p: a.p + r.pecas };
  }
  return { valores: n, fora };
}

export { toNum as osToNum, parseNum };
