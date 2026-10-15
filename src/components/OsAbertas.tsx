import { Fragment, useEffect, useRef, useState } from "react";
import { Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Barra, Box, Kpi, Tabela, brl, div, norm, parseNum, pct, tone } from "@/components/painel-ui";
import { readSalesReport } from "@/lib/sales-report";
import { loadOpenOrders, saveOpenOrders, type OpenOrders } from "@/lib/open-orders.functions";
import { registrarUpdate } from "@/lib/update-log";

type Linha = { c: { id: string; nome: string; department_id: string | null }; servicos: number; pecas: number; mS: number; mP: number };
type Os = OpenOrders;
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

// Tipos de O.S. que entram com apenas 30% do valor na projeção.
const TIPOS_30 = new Set(["c4", "mg", "ng"]);

// Relatório "O.S. Abertas" em tabela (Número, Tipo, Recep., Serv. Líquido, Itens Líquido…).
export function lerOsTabela(raw: unknown[][]): { nome: string; servicos: number; pecas: number }[] | null {
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
  const res: { nome: string; servicos: number; pecas: number }[] = [];
  for (const r of raw.slice(h + 1)) {
    const nome = String(r[cR] ?? "").trim();
    if (!nome || !OS_PERMITIDOS.has(norm(nome))) continue;
    if (norm(nome) === "geovana.m" && cE >= 0) {
      const d = dataEmissao(r[cE]);
      if (d === null || d < GEO_MIN) continue;
    }
    const f = TIPOS_30.has(norm(String(r[cT] ?? "")).trim()) ? 0.3 : 1;
    res.push({ nome, servicos: num(r[cS]) * f, pecas: num(r[cP]) * f });
  }
  return res.length ? res : null;
}

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

export function OsAbertas({ linhas, mes, soPecas, tot, dec, deptName, semServicos, modo = "ver" }: { modo?: "ver" | "importar"; linhas: Linha[]; mes: string; soPecas: (n: string) => boolean; tot: number; dec: number; deptName: (id: string | null) => string; semServicos: (nome: string) => boolean }) {
  const store = `os-abertas-${mes}`;
  const [os, setOs] = useState<Os>({});
  const [txt, setTxt] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setOs({});
    setMsg("");
    setCanEdit(false);
    const load = async () => {
      try {
        const result = await loadOpenOrders({ data: { mes } });
        if (cancelled) return;
        setCanEdit(result.canEdit);
        let values = result.valores ?? {};
        // Recover the old browser snapshot once, only when no shared snapshot exists.
        if (result.valores === null && result.canEdit) {
          let old: Os | null = null;
          try { old = JSON.parse(localStorage.getItem(store) ?? "null"); } catch { /* No valid browser backup. */ }
          if (old && Object.keys(old).length) {
            await saveOpenOrders({ data: { mes, valores: old } });
            values = old;
            try { localStorage.removeItem(store); } catch { /* Shared copy is already saved. */ }
          }
        }
        if (!cancelled) { setOs(values); setLoading(false); }
      } catch (e) {
        if (!cancelled) setMsg(e instanceof Error ? e.message : "Não foi possível carregar as O.S. Atualize a página para tentar novamente.");
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [mes, store]);
  const salvar = async (n: Os) => {
    if (loading || saving || !canEdit) return false;
    setSaving(true);
    setMsg("Salvando O.S.…");
    try {
      await saveOpenOrders({ data: { mes, valores: n } });
      if (Object.keys(n).length) await registrarUpdate("O.S. abertas (importação/edição)", mes);
      setOs(n);
      setMsg("O.S. salvas no painel.");
      try { localStorage.removeItem(store); } catch { /* Shared snapshot is authoritative. */ }
      return true;
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Não foi possível salvar as O.S. Tente novamente.");
      return false;
    } finally { setSaving(false); }
  };

  const aplicar = async (raw: unknown[][]) => {
    const sys = lerOsTabela(raw) ?? lerOsSistema(raw);
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
    if (!Object.keys(n).length) throw new Error("Nenhuma O.S. dos consultores permitidos foi encontrada. As O.S. salvas foram mantidas.");
    if (!await salvar(n)) return;
    setMsg(`OS abertas importadas para ${Object.keys(n).length} consultor(es) — só P.BENIGNO, ANDRESSA.O, GILBERTO.S, WESLEY.F, RENAN.O, GEOVANA.M e MARCELA.S são considerados.${fora.length ? ` Fora da lista (ignorados): ${[...new Set(fora)].join(", ")}.` : ""}`);
  };
  const abrir = async (f?: File) => {
    if (!f) return;
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await f.arrayBuffer(), { type: "array" });
      const sheetName = wb.SheetNames[0];
      const sh = sheetName ? wb.Sheets[sheetName] : undefined;
      if (!sh) throw new Error("Planilha vazia.");
      await aplicar(XLSX.utils.sheet_to_json<unknown[]>(sh, { header: 1, raw: true, defval: "" }));
    } catch (e) { setMsg((e as Error).message); }
    if (file.current) file.current.value = "";
  };
  const colar = async () => {
    try { const sep = txt.includes("\t") ? "\t" : ";"; await aplicar(txt.split(/\r?\n/).map((l) => l.split(sep))); }
    catch (e) { setMsg((e as Error).message); }
  };
  const editar = (id: string, campo: "s" | "p", v: string) => {
    const a = os[id] ?? { s: 0, p: 0 };
    void salvar({ ...os, [id]: { ...a, [campo]: parseNum(v) } });
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

  // Cartões por departamento (faturado + OS abertas), mesmo layout do Painel
  const porDept = [...new Set(rows.map((r) => r.l.c.department_id))].map((id) => {
    const nome = deptName(id);
    const semServ = semServicos(nome);
    const t = rows.filter((r) => r.l.c.department_id === id).reduce((a, r) => ({
      fs: a.fs + (r.semServ || semServ ? 0 : r.l.servicos), os: a.os + (r.semServ || semServ ? 0 : r.o.s), ms: a.ms + (r.semServ || semServ ? 0 : r.l.mS),
      fp: a.fp + r.l.pecas, op: a.op + r.o.p, mp: a.mp + r.l.mP,
    }), { fs: 0, os: 0, ms: 0, fp: 0, op: 0, mp: 0 });
    const dts = t.fs + t.os, dtp = t.fp + t.op;
    const dProjS = dec ? div(dts, dec) * tot : 0, dProjP = dec ? div(dtp, dec) * tot : 0;
    const dProj = dProjS + dProjP, dMeta = t.ms + t.mp, dReal = dts + dtp;
    return {
      nome, semServ,
      servicos: dts, mS: t.ms, perfS: div(dts, t.ms), projS: dProjS, projPctS: div(dProjS, t.ms),
      pecas: dtp, mP: t.mp, perfP: div(dtp, t.mp), projP: dProjP, projPctP: div(dProjP, t.mp),
      real: dReal, meta: dMeta, perf: div(dReal, dMeta), proj: dProj, projPct: div(dProj, dMeta),
      necS: rest ? Math.max(t.ms - dts, 0) / rest : 0, necP: rest ? Math.max(t.mp - dtp, 0) / rest : 0,
    };
  });

  if (modo === "importar") return (
    <Box title="O.S. abertas (Excel ou colar) — alimenta Projeção + OS">
      <div className="p-4">
        <p className="mb-3 text-sm text-muted-foreground">Aceita o relatório "O.S. Abertas" do sistema (peças e serviços separados) ou colar vendedor/serviços/peças. Só são considerados: P.BENIGNO, ANDRESSA.O, GILBERTO.S, WESLEY.F, RENAN.O, GEOVANA.M e MARCELA.S. Importar substitui as OS abertas do mês.</p>
        <div className="flex flex-wrap gap-2">
          <input ref={file} type="file" accept=".xls,.xlsx,.csv" className="hidden" onChange={(e) => void abrir(e.target.files?.[0])} />
          <Button disabled={loading || saving || !canEdit} onClick={() => file.current?.click()}><Upload />Importar Excel de OS abertas</Button>
          <Button disabled={loading || saving || !canEdit} variant="outline" onClick={() => void salvar({})}><Trash2 />Zerar OS</Button>
        </div>
        <textarea value={txt} onChange={(e) => setTxt(e.target.value)} placeholder={"Vendedor\tServiços\tPeças\nFULANO\t1.500,00\t800,00"} className="mt-3 h-24 w-full rounded-md border border-input bg-card p-2 font-mono text-xs" />
        <Button variant="outline" className="mt-2" onClick={() => void colar()} disabled={!txt.trim() || loading || saving || !canEdit}>Ler dados colados</Button>
        {loading && !msg && <p className="mt-2 text-sm text-muted-foreground">Carregando O.S. salvas…</p>}
        {msg && <p role="status" className="mt-2 text-sm">{msg}</p>}
      </div>
    </Box>
  );

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Projeção com OS abertas — {mes}</h2>
      <p className="text-sm text-muted-foreground">Faturado (dados já importados) + ordens de serviço abertas que ainda serão faturadas. A importação das OS abertas fica na aba Importações.</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi label="Realizado Serviços Total" value={brl(ts)} sub={`Meta ${brl(g.ms)} · ${pct(div(ts, g.ms))}`} cls={tone(div(ts, g.ms))} />
        <Kpi label="Realizado Peças Total" value={brl(tp)} sub={`Meta ${brl(g.mp)} · ${pct(div(tp, g.mp))}`} cls={tone(div(tp, g.mp))} />
        <Kpi label="Projeção Serviços" value={brl(projS)} sub={`${pct(projPctS)} da meta ${brl(g.ms)}`} cls={tone(projPctS)} />
        <Kpi label="Projeção Peças" value={brl(projP)} sub={`${pct(projPctP)} da meta ${brl(g.mp)}`} cls={tone(projPctP)} />
        <Kpi label="Projeção Total" value={brl(projS + projP)} sub={`${pct(projPct)} · precisa serviços ${brl(necS)}/dia · precisa peças ${brl(necP)}/dia`} cls={tone(projPct)} />
      </div>

      <Box title="Resultados por departamento (faturado + OS abertas)">
        <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
          {porDept.map((d) => (
            <div key={d.nome} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-semibold">{d.nome}</p>
                <p className={`text-sm font-semibold ${tone(d.projPct)}`}>Proj. {pct(d.projPct)}</p>
              </div>
              <div className="mt-2"><Barra p={d.projPct} /></div>
              <div className="mt-3 space-y-2 text-sm">
                {!d.semServ && (
                  <>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-muted-foreground">Serviços</span>
                      <span>{brl(d.servicos)} <span className="text-xs text-muted-foreground">meta {brl(d.mS)}</span> <span className={`text-xs font-semibold ${tone(d.perfS)}`}>{pct(d.perfS)}</span></span>
                    </div>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs text-muted-foreground">Projeção serviços</span>
                      <span className={tone(d.projPctS)}>{brl(d.projS)} <span className="text-xs">{pct(d.projPctS)} da meta</span></span>
                    </div>
                  </>
                )}
                <div className={`flex items-baseline justify-between gap-2 ${d.semServ ? "" : "border-t border-border pt-2"}`}>
                  <span className="text-muted-foreground">Peças</span>
                  <span>{brl(d.pecas)} <span className="text-xs text-muted-foreground">meta {brl(d.mP)}</span> <span className={`text-xs font-semibold ${tone(d.perfP)}`}>{pct(d.perfP)}</span></span>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs text-muted-foreground">Projeção peças</span>
                  <span className={tone(d.projPctP)}>{brl(d.projP)} <span className="text-xs">{pct(d.projPctP)} da meta</span></span>
                </div>
                <div className="flex items-baseline justify-between gap-2 border-t border-border pt-2">
                  <span className="text-muted-foreground">Projeção total</span>
                  <span className="font-semibold">{brl(d.proj)} <span className={`text-xs font-semibold ${tone(d.projPct)}`}>{pct(d.projPct)}</span></span>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-muted-foreground">Realizado / Meta</span>
                  <span>{brl(d.real)} <span className="text-xs text-muted-foreground">/ {brl(d.meta)}</span> <span className={`text-xs font-semibold ${tone(d.perf)}`}>{pct(d.perf)}</span></span>
                </div>
                <p className="text-xs text-muted-foreground">Precisa por dia: {d.semServ ? `peças ${brl(d.necP)}` : `serviços ${brl(d.necS)} · peças ${brl(d.necP)}`}</p>
              </div>
            </div>
          ))}
          {!porDept.length && <p className="p-4 text-sm text-muted-foreground">Cadastre consultores e departamentos em "Configurar" para ver os resultados aqui.</p>}
        </div>
      </Box>

      <Box title="Projeção individual (faturado + OS abertas)">
        <Tabela head={["Consultor", "Grupo", "Faturado", "OS abertas", "Projeção", "Meta", "% da meta", "Falta"]}>
          {rows.map(({ l, o, semServ, totS, totP }) => (
            <Fragment key={l.c.id}>
              {([["Serviços", l.servicos, "s", totS, l.mS], ["Peças", l.pecas, "p", totP, l.mP]] as const).map(([gr, fat, k, soma, meta], i) => {
                const proj = dec ? div(soma, dec) * tot : 0;
                return (
                <tr key={gr} className={i === 0 ? "border-t-2 border-border" : ""}>
                  {i === 0 && <td rowSpan={2} className={`${cell} font-medium`}>{l.c.nome}</td>}
                  <td className={cell}>{gr}</td>
                  {k === "s" && semServ ? <td colSpan={6} className={`${cell} text-muted-foreground`}>não vende serviços</td> : <>
                    <td className={cell}>{brl(fat)}</td>
                    <td className={cell}><input disabled={loading || saving || !canEdit} aria-label={`OS ${gr} ${l.c.nome}`} defaultValue={o[k] ? o[k].toLocaleString("pt-BR") : ""} key={`${mes}-${k}-${o[k]}`} onBlur={(e) => editar(l.c.id, k, e.target.value)} className="w-28 rounded border border-input bg-card px-2 py-1 text-right" placeholder="0" /></td>
                    <td className={`${cell} font-semibold`}>{brl(proj)}</td>
                    <td className={`${cell} text-muted-foreground`}>{brl(meta)}</td>
                    <td className={`${cell} font-semibold ${tone(div(proj, meta))}`}>{pct(div(proj, meta))}</td>
                    <td className={cell}>{brl(Math.max(meta - proj, 0))}</td>
                  </>}
                </tr>
              );})}
            </Fragment>
          ))}
          <tr className="border-t-2 border-border font-semibold"><td className={cell} rowSpan={2}>GERAL</td><td className={cell}>Serviços</td><td className={cell}>{brl(g.fs)}</td><td className={cell}>{brl(g.os)}</td><td className={cell}>{brl(projS)}</td><td className={cell}>{brl(g.ms)}</td><td className={`${cell} ${tone(projPctS)}`}>{pct(projPctS)}</td><td className={cell}>{brl(Math.max(g.ms - projS, 0))}</td></tr>
          <tr className="font-semibold"><td className={cell}>Peças</td><td className={cell}>{brl(g.fp)}</td><td className={cell}>{brl(g.op)}</td><td className={cell}>{brl(projP)}</td><td className={cell}>{brl(g.mp)}</td><td className={`${cell} ${tone(projPctP)}`}>{pct(projPctP)}</td><td className={cell}>{brl(Math.max(g.mp - projP, 0))}</td></tr>
        </Tabela>
      </Box>
    </div>
  );
}
