import { Fragment, useEffect, useRef, useState } from "react";
import { Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Box, Kpi, Tabela, brl, div, norm, parseNum, pct, tone } from "@/components/painel-ui";
import { readSalesReport } from "@/lib/sales-report";

type Linha = { c: { id: string; nome: string }; servicos: number; pecas: number; mS: number; mP: number };
type Os = Record<string, { s: number; p: number }>;
const key = (v: string) => norm(v.trim());

// Vendedores considerados na importação de OS abertas (demais são ignorados).
const OS_PERMITIDOS = new Set(["p.benigno", "andressa.o", "gilberto.s", "wesley.f", "renan.o", "geovana.m", "marcela.s"]);
const numRe = /^\d{3,}$/;
const toNum = (v: unknown) => {
  const s = String(v ?? "").trim();
  if (!s || s.includes("%")) return 0; // "7,0%" é porcentagem, não valor
  const n = parseFloat(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

// Relatório do sistema "O.S. Abertas": bloco por O.S. (número na col. C, veículo na col. F,
// consultor na linha seguinte, Total Líq. Peças col. U e Total Serviços col. W).
function lerOsSistema(raw: unknown[][]): { nome: string; servicos: number; pecas: number }[] | null {
  // Detecta o deslocamento de colunas pela célula "Numero" do cabeçalho
  let off = -1;
  for (let i = 0; i < Math.min(10, raw.length) && off < 0; i++) {
    const row = raw[i] ?? [];
    for (let c = 0; c < row.length; c++) if (norm(String(row[c] ?? "")) === "numero") { off = c; break; }
  }
  if (off < 0) return null;
  const res: { nome: string; servicos: number; pecas: number }[] = [];
  for (let i = 0; i < raw.length; i++) {
    const cN = String(raw[i]?.[off] ?? "").trim();
    const cV = String(raw[i]?.[off + 3] ?? "").trim();
    if (!numRe.test(cN) || !cV || numRe.test(cV)) continue;
    let cons = "";
    for (let j = i + 1; j < Math.min(i + 5, raw.length); j++) {
      const v = String(raw[j]?.[off + 3] ?? "").trim();
      if (v) { cons = v; break; }
    }
    if (!cons || !OS_PERMITIDOS.has(norm(cons))) continue;
    res.push({ nome: cons, servicos: toNum(raw[i]?.[off + 20]), pecas: toNum(raw[i]?.[off + 18]) });
  }
  return res.length ? res : null;
}

export function OsAbertas({ linhas, mes, soPecas, tot, dec }: { linhas: Linha[]; mes: string; soPecas: (n: string) => boolean; tot: number; dec: number }) {
  const store = `os-abertas-${mes}`;
  const [os, setOs] = useState<Os>({});
  const [txt, setTxt] = useState("");
  const [msg, setMsg] = useState("");
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => { try { setOs(JSON.parse(localStorage.getItem(store) ?? "{}")); } catch { setOs({}); } }, [store]);
  const salvar = (n: Os) => { setOs(n); localStorage.setItem(store, JSON.stringify(n)); };

  const aplicar = (raw: unknown[][]) => {
    const sys = lerOsSistema(raw);
    const rows: { nome: string; servicos: number; pecas: number; completo?: string }[] =
      sys ?? readSalesReport(raw).rows.map((r) => ({ nome: r.nome, servicos: r.servicos, pecas: r.pecas, completo: r.completo }));
    const n: Os = {}; const fora: string[] = [];
    for (const r of rows) {
      const c = linhas.find((l) => key(l.c.nome) === key(r.nome) || (r.completo && key(l.c.nome) === key(r.completo)));
      if (!c) { fora.push(r.nome); continue; }
      if (!OS_PERMITIDOS.has(key(c.c.nome))) continue;
      const a = n[c.c.id] ?? { s: 0, p: 0 };
      n[c.c.id] = { s: a.s + r.servicos, p: a.p + r.pecas };
    }
    salvar(n);
    setMsg(`OS abertas importadas para ${Object.keys(n).length} consultor(es) — só P.BENIGNO, ANDRESSA.O, GILBERTO.S, WESLEY.F, RENAN.O, GEOVANA.M e MARCELA.S são considerados.${fora.length ? ` Fora da lista (ignorados): ${[...new Set(fora)].join(", ")}.` : ""}`);
  };
  const abrir = async (f?: File) => {
    if (!f) return;
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await f.arrayBuffer(), { type: "array" });
      const sh = wb.Sheets[wb.SheetNames[0]!];
      if (!sh) throw new Error("Planilha vazia.");
      aplicar(XLSX.utils.sheet_to_json<unknown[]>(sh, { header: 1, raw: true, defval: "" }));
    } catch (e) { setMsg((e as Error).message); }
    if (file.current) file.current.value = "";
  };
  const colar = () => {
    try { const sep = txt.includes("\t") ? "\t" : ";"; aplicar(txt.split(/\r?\n/).map((l) => l.split(sep))); setTxt(""); }
    catch (e) { setMsg((e as Error).message); }
  };
  const editar = (id: string, campo: "s" | "p", v: string) => {
    const a = os[id] ?? { s: 0, p: 0 };
    salvar({ ...os, [id]: { ...a, [campo]: parseNum(v) } });
  };

  const rows = linhas.map((l) => {
    const o = os[l.c.id] ?? { s: 0, p: 0 };
    const semServ = soPecas(l.c.nome);
    return { l, o, semServ, totS: l.servicos + o.s, totP: l.pecas + o.p };
  });
  const g = rows.reduce((a, r) => ({
    fs: a.fs + (r.semServ ? 0 : r.l.servicos), os: a.os + (r.semServ ? 0 : r.o.s), ms: a.ms + (r.semServ ? 0 : r.l.mS),
    fp: a.fp + r.l.pecas, op: a.op + r.o.p, mp: a.mp + r.l.mP,
  }), { fs: 0, os: 0, ms: 0, fp: 0, op: 0, mp: 0 });
  const ts = g.fs + g.os, tp = g.fp + g.op;
  const rest = Math.max(tot - dec, 0);
  const projS = dec ? div(ts, dec) * tot : 0, projP = dec ? div(tp, dec) * tot : 0;
  const projPctS = div(projS, g.ms), projPctP = div(projP, g.mp), projPct = div(projS + projP, g.ms + g.mp);
  const necS = rest ? Math.max(g.ms - ts, 0) / rest : 0, necP = rest ? Math.max(g.mp - tp, 0) / rest : 0;
  const cell = "px-3 py-2";

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Projeção com OS abertas — {mes}</h2>
      <p className="text-sm text-muted-foreground">Faturado (dados já importados) + ordens de serviço abertas que ainda serão faturadas. Não altera as outras abas.</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Kpi label="Serviços: faturado + OS" value={brl(ts)} sub={`Faturado ${brl(g.fs)} + OS ${brl(g.os)} · meta ${brl(g.ms)} · ${pct(div(ts, g.ms))}`} cls={tone(div(ts, g.ms))} />
        <Kpi label="Peças: faturado + OS" value={brl(tp)} sub={`Faturado ${brl(g.fp)} + OS ${brl(g.op)} · meta ${brl(g.mp)} · ${pct(div(tp, g.mp))}`} cls={tone(div(tp, g.mp))} />
        <Kpi label="Total: faturado + OS" value={brl(ts + tp)} sub={`Meta ${brl(g.ms + g.mp)} · ${pct(div(ts + tp, g.ms + g.mp))} · falta ${brl(Math.max(g.ms + g.mp - ts - tp, 0))}`} cls={tone(div(ts + tp, g.ms + g.mp))} />
      </div>

      <Box title="Importar OS abertas (Excel ou colar)">
        <p className="mb-3 text-sm text-muted-foreground">Aceita o relatório "O.S. Abertas" do sistema (peças e serviços separados) ou colar vendedor/serviços/peças. Só são considerados: P.BENIGNO, ANDRESSA.O, GILBERTO.S, WESLEY.F, RENAN.O, GEOVANA.M e MARCELA.S. Importar substitui as OS abertas do mês. Também dá para digitar direto na tabela abaixo.</p>
        <div className="flex flex-wrap gap-2">
          <input ref={file} type="file" accept=".xls,.xlsx,.csv" className="hidden" onChange={(e) => void abrir(e.target.files?.[0])} />
          <Button onClick={() => file.current?.click()}><Upload />Importar Excel de OS abertas</Button>
          <Button variant="outline" onClick={() => { salvar({}); setMsg("OS abertas zeradas."); }}><Trash2 />Zerar OS</Button>
        </div>
        <textarea value={txt} onChange={(e) => setTxt(e.target.value)} placeholder={"Vendedor\tServiços\tPeças\nFULANO\t1.500,00\t800,00"} className="mt-3 h-24 w-full rounded-md border border-input bg-card p-2 font-mono text-xs" />
        <Button variant="outline" className="mt-2" onClick={colar} disabled={!txt.trim()}>Ler dados colados</Button>
        {msg && <p className="mt-2 text-sm">{msg}</p>}
      </Box>

      <Box title="Projeção individual (faturado + OS abertas)">
        <Tabela head={["Consultor", "Grupo", "Faturado", "OS abertas", "Projeção", "Meta", "% da meta", "Falta"]}>
          {rows.map(({ l, o, semServ, totS, totP }) => (
            <Fragment key={l.c.id}>
              {([["Serviços", l.servicos, "s", totS, l.mS], ["Peças", l.pecas, "p", totP, l.mP]] as const).map(([gr, fat, k, tot, meta], i) => (
                <tr key={gr} className={i === 0 ? "border-t-2 border-border" : ""}>
                  {i === 0 && <td rowSpan={2} className={`${cell} font-medium`}>{l.c.nome}</td>}
                  <td className={cell}>{gr}</td>
                  {k === "s" && semServ ? <td colSpan={6} className={`${cell} text-muted-foreground`}>não vende serviços</td> : <>
                    <td className={cell}>{brl(fat)}</td>
                    <td className={cell}><input aria-label={`OS ${gr} ${l.c.nome}`} defaultValue={o[k] ? o[k].toLocaleString("pt-BR") : ""} key={`${k}-${o[k]}`} onBlur={(e) => editar(l.c.id, k, e.target.value)} className="w-28 rounded border border-input bg-card px-2 py-1 text-right" placeholder="0" /></td>
                    <td className={`${cell} font-semibold`}>{brl(tot)}</td>
                    <td className={`${cell} text-muted-foreground`}>{brl(meta)}</td>
                    <td className={`${cell} font-semibold ${tone(div(tot, meta))}`}>{pct(div(tot, meta))}</td>
                    <td className={cell}>{brl(Math.max(meta - tot, 0))}</td>
                  </>}
                </tr>
              ))}
            </Fragment>
          ))}
          <tr className="border-t-2 border-border font-semibold"><td className={cell} rowSpan={2}>GERAL</td><td className={cell}>Serviços</td><td className={cell}>{brl(g.fs)}</td><td className={cell}>{brl(g.os)}</td><td className={cell}>{brl(ts)}</td><td className={cell}>{brl(g.ms)}</td><td className={`${cell} ${tone(div(ts, g.ms))}`}>{pct(div(ts, g.ms))}</td><td className={cell}>{brl(Math.max(g.ms - ts, 0))}</td></tr>
          <tr className="font-semibold"><td className={cell}>Peças</td><td className={cell}>{brl(g.fp)}</td><td className={cell}>{brl(g.op)}</td><td className={cell}>{brl(tp)}</td><td className={cell}>{brl(g.mp)}</td><td className={`${cell} ${tone(div(tp, g.mp))}`}>{pct(div(tp, g.mp))}</td><td className={cell}>{brl(Math.max(g.mp - tp, 0))}</td></tr>
        </Tabela>
      </Box>
    </div>
  );
}
