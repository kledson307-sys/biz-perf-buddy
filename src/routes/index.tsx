import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Painel de Metas e Projeção por Consultor" },
      { name: "description", content: "Configure dias úteis, metas e acompanhe projeção e performance por consultor." },
      { property: "og:title", content: "Painel de Metas e Projeção por Consultor" },
      { property: "og:description", content: "Realizado, meta, projeção e performance de serviços e peças por consultor." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

type Params = { duTotais: number; duDecorridos: number; dcTotais: number; dcDecorridos: number; base: "uteis" | "corridos" };
type Meta = { servicos: number; pecas: number };
type Row = { consultor: string; servicos: number; pecas: number };

const KEY = "painel-metas-v1";
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const pct = (n: number) => (n * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%";
const div = (a: number, b: number) => (b ? a / b : 0);

function parseNum(v: string) {
  let s = (v || "").replace(/[R$\s%]/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function parsePaste(text: string): { rows: Row[]; error?: string } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { rows: [], error: "Cole o cabeçalho e ao menos uma linha." };
  const sep = lines[0].includes("\t") ? "\t" : ";";
  const head = lines[0].split(sep).map((h) => h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
  const ci = head.findIndex((h) => /consult|vendedor|nome|colaborador/.test(h));
  const si = head.findIndex((h) => /serv|mao de obra|mo\b/.test(h));
  const pi = head.findIndex((h) => /pec/.test(h));
  if (ci < 0 || (si < 0 && pi < 0))
    return { rows: [], error: "Não encontrei as colunas. O cabeçalho precisa ter: Consultor, Serviços e/ou Peças." };
  const map = new Map<string, Row>();
  for (const l of lines.slice(1)) {
    const c = l.split(sep);
    const nome = (c[ci] || "").trim();
    if (!nome || /^total/i.test(nome)) continue;
    const r = map.get(nome) || { consultor: nome, servicos: 0, pecas: 0 };
    if (si >= 0) r.servicos += parseNum(c[si]);
    if (pi >= 0) r.pecas += parseNum(c[pi]);
    map.set(nome, r);
  }
  return { rows: [...map.values()] };
}

function Index() {
  const [params, setParams] = useState<Params>({ duTotais: 22, duDecorridos: 1, dcTotais: 30, dcDecorridos: 1, base: "uteis" });
  const [metas, setMetas] = useState<Record<string, Meta>>({});
  const [rows, setRows] = useState<Row[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string>("");
  const [paste, setPaste] = useState("");
  const [msg, setMsg] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<"painel" | "dados" | "config">("painel");

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || "{}");
      if (s.params) setParams(s.params);
      if (s.metas) setMetas(s.metas);
      if (s.rows) setRows(s.rows);
      if (s.updatedAt) setUpdatedAt(s.updatedAt);
    } catch {}
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (loaded) localStorage.setItem(KEY, JSON.stringify({ params, metas, rows, updatedAt }));
  }, [params, metas, rows, updatedAt, loaded]);

  const consultores = useMemo(() => [...new Set([...rows.map((r) => r.consultor), ...Object.keys(metas)])].sort(), [rows, metas]);
  const [tot, dec] = params.base === "uteis" ? [params.duTotais, params.duDecorridos] : [params.dcTotais, params.dcDecorridos];

  const calc = (servicos: number, pecas: number, m: Meta) => {
    const real = servicos + pecas;
    const meta = m.servicos + m.pecas;
    const projS = div(servicos, dec) * tot;
    const projP = div(pecas, dec) * tot;
    const proj = projS + projP;
    const restante = Math.max(tot - dec, 0);
    return {
      servicos, pecas, real, meta, projS, projP, proj,
      perfS: div(servicos, m.servicos), perfP: div(pecas, m.pecas),
      perf: div(real, meta), projPct: div(proj, meta),
      mediaDia: div(real, dec),
      necessarioDia: restante ? Math.max(meta - real, 0) / restante : 0,
    };
  };

  const linhas = consultores.map((c) => {
    const r = rows.find((x) => x.consultor === c) || { servicos: 0, pecas: 0 };
    return { nome: c, ...calc(r.servicos, r.pecas, metas[c] || { servicos: 0, pecas: 0 }) };
  });
  const total = calc(
    linhas.reduce((a, l) => a + l.servicos, 0),
    linhas.reduce((a, l) => a + l.pecas, 0),
    { servicos: linhas.reduce((a, l) => a + (metas[l.nome]?.servicos || 0), 0), pecas: linhas.reduce((a, l) => a + (metas[l.nome]?.pecas || 0), 0) },
  );

  const importar = () => {
    const { rows: r, error } = parsePaste(paste);
    if (error) return setMsg(error);
    setRows(r);
    setUpdatedAt(new Date().toLocaleString("pt-BR"));
    setMsg(`${r.length} consultores importados com sucesso.`);
    setPaste("");
  };

  const tone = (p: number) => (p >= 1 ? "text-primary" : p >= 0.85 ? "text-chart-4" : "text-destructive");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Painel de Metas</h1>
            <p className="text-sm text-muted-foreground">
              {params.base === "uteis" ? "Dias úteis" : "Dias corridos"}: {dec} de {tot} · Atualizado: {updatedAt || "—"}
            </p>
          </div>
          <nav className="flex gap-1 rounded-lg bg-muted p-1">
            {([["painel", "Painel"], ["dados", "Colar dados"], ["config", "Configurar"]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)}
                className={`rounded-md px-4 py-2 text-sm font-medium ${tab === k ? "bg-card shadow-sm" : "text-muted-foreground"}`}>{l}</button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-6 py-6">
        {tab === "painel" && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi label="Realizado Total" value={brl(total.real)} sub={`Meta ${brl(total.meta)}`} />
              <Kpi label="Performance" value={pct(total.perf)} cls={tone(total.perf)} sub={`Serv ${pct(total.perfS)} · Peças ${pct(total.perfP)}`} />
              <Kpi label="Projeção Total" value={brl(total.proj)} sub={`${pct(total.projPct)} da meta`} cls={tone(total.projPct)} />
              <Kpi label="Necessário / dia" value={brl(total.necessarioDia)} sub={`Média atual ${brl(total.mediaDia)}`} />
            </div>

            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    {["Consultor", "Real. Serviços", "Meta Serv.", "Perf. Serv.", "Proj. Serv.", "Real. Peças", "Meta Peças", "Perf. Peças", "Proj. Peças", "Realizado", "Meta", "Perf.", "Projeção", "Proj. %"].map((h) => (
                      <th key={h} className="whitespace-nowrap px-3 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {linhas.length === 0 && (
                    <tr><td colSpan={14} className="px-3 py-10 text-center text-muted-foreground">Nenhum dado ainda. Vá em "Colar dados".</td></tr>
                  )}
                  {[...linhas].sort((a, b) => b.projPct - a.projPct).map((l) => (
                    <tr key={l.nome} className="border-t border-border">
                      <td className="px-3 py-2 font-medium">{l.nome}</td>
                      <td className="px-3 py-2">{brl(l.servicos)}</td>
                      <td className="px-3 py-2 text-muted-foreground">{brl(metas[l.nome]?.servicos || 0)}</td>
                      <td className={`px-3 py-2 font-semibold ${tone(l.perfS)}`}>{pct(l.perfS)}</td>
                      <td className="px-3 py-2">{brl(l.projS)}</td>
                      <td className="px-3 py-2">{brl(l.pecas)}</td>
                      <td className="px-3 py-2 text-muted-foreground">{brl(metas[l.nome]?.pecas || 0)}</td>
                      <td className={`px-3 py-2 font-semibold ${tone(l.perfP)}`}>{pct(l.perfP)}</td>
                      <td className="px-3 py-2">{brl(l.projP)}</td>
                      <td className="px-3 py-2 font-semibold">{brl(l.real)}</td>
                      <td className="px-3 py-2 text-muted-foreground">{brl(l.meta)}</td>
                      <td className={`px-3 py-2 font-semibold ${tone(l.perf)}`}>{pct(l.perf)}</td>
                      <td className="px-3 py-2 font-semibold">{brl(l.proj)}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-16 overflow-hidden rounded bg-muted">
                            <div className={`h-full ${l.projPct >= 1 ? "bg-primary" : l.projPct >= 0.85 ? "bg-chart-4" : "bg-destructive"}`} style={{ width: `${Math.min(l.projPct * 100, 100)}%` }} />
                          </div>
                          <span className={`font-semibold ${tone(l.projPct)}`}>{pct(l.projPct)}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === "dados" && (
          <section className="space-y-3 rounded-xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold">Colar dados da planilha fonte</h2>
            <p className="text-sm text-muted-foreground">
              No Excel, selecione o intervalo <b>incluindo o cabeçalho</b> e copie (Ctrl+C). Colunas reconhecidas: <b>Consultor</b>, <b>Serviços</b>, <b>Peças</b>. Linhas repetidas do mesmo consultor são somadas. Colar substitui os dados anteriores.
            </p>
            <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={14}
              placeholder={"Consultor\tServiços\tPeças\nJoão\t12.500,00\t8.300,00"}
              className="w-full rounded-lg border border-input bg-background p-3 font-mono text-xs" />
            <div className="flex items-center gap-3">
              <button onClick={importar} className="rounded-lg bg-primary px-5 py-2 font-medium text-primary-foreground">Atualizar painel</button>
              {msg && <span className="text-sm text-muted-foreground">{msg}</span>}
            </div>
          </section>
        )}

        {tab === "config" && (
          <div className="grid gap-6 lg:grid-cols-3">
            <section className="space-y-4 rounded-xl border border-border bg-card p-6">
              <h2 className="text-lg font-semibold">Dias</h2>
              <Num label="Dias úteis totais" v={params.duTotais} on={(v) => setParams({ ...params, duTotais: v })} />
              <Num label="Dias úteis decorridos" v={params.duDecorridos} on={(v) => setParams({ ...params, duDecorridos: v })} />
              <Num label="Dias corridos totais" v={params.dcTotais} on={(v) => setParams({ ...params, dcTotais: v })} />
              <Num label="Dias corridos decorridos" v={params.dcDecorridos} on={(v) => setParams({ ...params, dcDecorridos: v })} />
              <label className="block text-sm">
                <span className="text-muted-foreground">Projeção baseada em</span>
                <select value={params.base} onChange={(e) => setParams({ ...params, base: e.target.value as Params["base"] })}
                  className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2">
                  <option value="uteis">Dias úteis</option>
                  <option value="corridos">Dias corridos</option>
                </select>
              </label>
            </section>
            <section className="space-y-3 rounded-xl border border-border bg-card p-6 lg:col-span-2">
              <h2 className="text-lg font-semibold">Metas por consultor</h2>
              <AddConsultor onAdd={(n) => setMetas({ ...metas, [n]: metas[n] || { servicos: 0, pecas: 0 } })} />
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr><th className="py-2">Consultor</th><th>Meta Serviços</th><th>Meta Peças</th><th></th></tr>
                </thead>
                <tbody>
                  {consultores.map((c) => {
                    const m = metas[c] || { servicos: 0, pecas: 0 };
                    return (
                      <tr key={c} className="border-t border-border">
                        <td className="py-2 pr-2 font-medium">{c}</td>
                        <td className="pr-2"><input type="number" value={m.servicos || ""} onChange={(e) => setMetas({ ...metas, [c]: { ...m, servicos: +e.target.value } })} className="w-full rounded border border-input bg-background px-2 py-1" /></td>
                        <td className="pr-2"><input type="number" value={m.pecas || ""} onChange={(e) => setMetas({ ...metas, [c]: { ...m, pecas: +e.target.value } })} className="w-full rounded border border-input bg-background px-2 py-1" /></td>
                        <td><button onClick={() => { const n = { ...metas }; delete n[c]; setMetas(n); setRows(rows.filter((r) => r.consultor !== c)); }} className="text-destructive">Remover</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

function Kpi({ label, value, sub, cls = "" }: { label: string; value: string; sub?: string; cls?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${cls}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Num({ label, v, on }: { label: string; v: number; on: (v: number) => void }) {
  return (
    <label className="block text-sm">
      <span className="text-muted-foreground">{label}</span>
      <input type="number" value={v} onChange={(e) => on(+e.target.value)} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2" />
    </label>
  );
}

function AddConsultor({ onAdd }: { onAdd: (n: string) => void }) {
  const [n, setN] = useState("");
  return (
    <div className="flex gap-2">
      <input value={n} onChange={(e) => setN(e.target.value)} placeholder="Nome do consultor" className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm" />
      <button onClick={() => { if (n.trim()) { onAdd(n.trim()); setN(""); } }} className="rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground">Adicionar</button>
    </div>
  );
}
