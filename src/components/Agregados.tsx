import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Barra, Box, Kpi, Tabela, brl, div, norm, num, parseNum, pct, tone } from "./painel-ui";
import { GRUPO_NOME, ITENS, splitCods, type Grupo } from "@/lib/agregados";
import { AgregadosImport } from "./AgregadosImport";
import { AgregadosIA } from "./AgregadosIA";

type Cons = { id: string; nome: string; department_id: string | null };
type ASale = { consultant_id: string; dia: string; item: string; qtd: number; valor: number };
type AGoal = { consultant_id: string; item: string; meta_qtd: number; meta_valor: number };
type AVisit = { consultant_id: string; dia: string; passagens: number };

type Props = {
  mes: string; cons: Cons[]; allCons: Cons[]; tot: number; dec: number;
  deptName: (id: string | null) => string; reloadCons: () => void;
};

export function Agregados({ mes, cons, allCons, tot, dec, deptName, reloadCons }: Props) {
  const [sub, setSub] = useState<"servicos" | "pecas" | "ia" | "importar" | "lancar" | "metas">("servicos");
  const [sales, setSales] = useState<ASale[]>([]);
  const [goals, setGoals] = useState<AGoal[]>([]);
  const [visits, setVisits] = useState<AVisit[]>([]);
  const [codigos, setCodigos] = useState<Record<string, string[]>>(() => Object.fromEntries(ITENS.map((i) => [i.k, i.cod])));

  const [y, m] = mes.split("-").map(Number);
  const fim = new Date(y!, m!, 0).getDate();
  const ini = `${mes}-01`, end = `${mes}-${fim}`;

  const load = useCallback(async () => {
    const [s, g, v, c] = await Promise.all([
      supabase.from("agg_sales").select("consultant_id,dia,item,qtd,valor").gte("dia", ini).lte("dia", end),
      supabase.from("agg_goals").select("consultant_id,item,meta_qtd,meta_valor").eq("mes", mes),
      supabase.from("agg_visits").select("consultant_id,dia,passagens").gte("dia", ini).lte("dia", end),
      supabase.from("agg_codes").select("item,codigos"),
    ]);
    setSales((s.data ?? []).map((x) => ({ ...x, qtd: +x.qtd, valor: +x.valor })));
    setGoals((g.data ?? []).map((x) => ({ ...x, meta_qtd: +x.meta_qtd, meta_valor: +x.meta_valor })));
    setVisits((v.data ?? []).map((x) => ({ ...x, passagens: +x.passagens })));
    const salvo = new Map((c.data ?? []).map((x) => [x.item, splitCods(x.codigos)]));
    setCodigos(Object.fromEntries(ITENS.map((i) => [i.k, salvo.get(i.k) ?? i.cod])));
  }, [mes, ini, end]);
  useEffect(() => { load(); }, [load]);

  const rest = Math.max(tot - dec, 0);
  const stat = (ids: string[], items: string[]) => {
    const idSet = new Set(ids), itSet = new Set(items);
    let qtd = 0, valor = 0, mq = 0, mv = 0, pass = 0;
    for (const s of sales) if (idSet.has(s.consultant_id) && itSet.has(s.item)) { qtd += s.qtd; valor += s.valor; }
    for (const g of goals) if (idSet.has(g.consultant_id) && itSet.has(g.item)) { mq += g.meta_qtd; mv += g.meta_valor; }
    for (const v of visits) if (idSet.has(v.consultant_id)) pass += v.passagens;
    const projQ = div(qtd, dec) * tot, projV = div(valor, dec) * tot;
    return {
      qtd, valor, mq, mv, pass, projQ, projV,
      perfQ: div(qtd, mq), perfV: div(valor, mv), projPctQ: div(projQ, mq), projPctV: div(projV, mv),
      aprov: div(qtd, pass), necQ: rest ? Math.max(mq - qtd, 0) / rest : 0,
    };
  };
  const ranking = (items: string[]) =>
    cons.map((c) => ({ c, ...stat([c.id], items) })).sort((a, b) => b.perfQ - a.perfQ || b.qtd - a.qtd);

  const exportar = () => {
    const h = ["Grupo", "Item", "Consultor", "Departamento", "Qtd", "Meta Qtd", "Perf. Qtd", "Projeção Qtd", "Valor", "Meta R$", "Perf. R$", "Projeção R$", "Passagens", "Aproveitamento"];
    const f = (n: number) => n.toFixed(2).replace(".", ",");
    const rows: string[][] = [];
    for (const it of ITENS) for (const l of ranking([it.k])) rows.push([GRUPO_NOME[it.g], it.nome, l.c.nome, deptName(l.c.department_id), f(l.qtd), f(l.mq), pct(l.perfQ), f(l.projQ), f(l.valor), f(l.mv), pct(l.perfV), f(l.projV), f(l.pass), pct(l.aprov)]);
    const csv = "\uFEFF" + [h, ...rows].map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(";")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `agregados-${mes}.csv`; a.click();
  };

  const subs: [typeof sub, string][] = [["servicos", "Serviços agregados"], ["pecas", "Peças agregadas"], ["ia", "Recomendações IA"], ["importar", "Importar Excel"], ["lancar", "Lançar / colar"], ["metas", "Metas"]];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Agregados · {mes}</h2>
          <p className="text-xs text-muted-foreground">Acompanhamento separado — estes valores não entram nos totais das outras abas.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <nav className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
            {subs.map(([k, l]) => (
              <button key={k} onClick={() => setSub(k)} className={`rounded-md px-3 py-1.5 text-sm font-medium ${sub === k ? "bg-card shadow-sm" : "text-muted-foreground"}`}>{l}</button>
            ))}
          </nav>
          <button onClick={exportar} className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">Exportar CSV</button>
        </div>
      </div>

      {(sub === "servicos" || sub === "pecas") && (
        <GrupoView g={sub} stat={stat} ranking={ranking} ids={cons.map((c) => c.id)} deptName={deptName} rest={rest} />
      )}
      {sub === "ia" && <AgregadosIA mes={mes} cons={cons} tot={tot} dec={dec} stat={stat} deptName={deptName} />}
      {sub === "importar" && (
        <AgregadosImport allCons={allCons} codigos={codigos} ini={ini} end={end} onDone={() => { load(); reloadCons(); }} />
      )}
      {sub === "lancar" && (
        <Lancar cons={cons} allCons={allCons} sales={sales} visits={visits} ini={ini} end={end} onDone={() => { load(); reloadCons(); }} />
      )}
      {sub === "metas" && <Metas cons={cons} goals={goals} mes={mes} deptName={deptName} onSaved={load} />}
    </div>
  );
}

type Stat = { qtd: number; valor: number; mq: number; mv: number; pass: number; projQ: number; projV: number; perfQ: number; perfV: number; projPctQ: number; projPctV: number; aprov: number; necQ: number };
type Row = Stat & { c: Cons };

function GrupoView({ g, stat, ranking, ids, deptName, rest }: {
  g: Grupo; stat: (ids: string[], items: string[]) => Stat; ranking: (items: string[]) => Row[]; ids: string[]; deptName: (id: string | null) => string; rest: number;
}) {
  const items = ITENS.filter((i) => i.g === g);
  const keys = items.map((i) => i.k);
  const T = stat(ids, keys);
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Quantidade vendida" value={num(T.qtd)} sub={`Meta ${num(T.mq)} · ${pct(T.perfQ)}`} cls={tone(T.perfQ)} />
        <Kpi label="Projeção (qtd)" value={num(T.projQ)} sub={`${pct(T.projPctQ)} da meta · precisa ${num(T.necQ)}/dia (${rest} dias)`} cls={tone(T.projPctQ)} />
        <Kpi label="Valor vendido" value={brl(T.valor)} sub={`Meta ${brl(T.mv)} · projeção ${brl(T.projV)}`} cls={tone(T.perfV)} />
        <Kpi label="Aproveitamento" value={pct(T.aprov)} sub={`${num(T.qtd)} itens em ${num(T.pass)} passagens`} />
      </div>

      <Box title={`Resumo por item — ${GRUPO_NOME[g]}`}>
        <Tabela head={["Item", "Qtd", "Meta", "Perf.", "Projeção", "Proj. %", "Valor", "Meta R$", "Perf. R$", "Aproveit.", "Líder"]}>
          {items.map((it) => {
            const s = stat(ids, [it.k]);
            const lid = ranking([it.k])[0];
            return (
              <tr key={it.k} className="border-t border-border">
                <td className="px-3 py-2 font-medium">{it.nome}</td>
                <td className="px-3 py-2">{num(s.qtd)}</td>
                <td className="px-3 py-2 text-muted-foreground">{num(s.mq)}</td>
                <td className={`px-3 py-2 font-semibold ${tone(s.perfQ)}`}>{pct(s.perfQ)}</td>
                <td className="px-3 py-2">{num(s.projQ)}</td>
                <td className="px-3 py-2"><Barra p={s.projPctQ} /></td>
                <td className="px-3 py-2">{brl(s.valor)}</td>
                <td className="px-3 py-2 text-muted-foreground">{brl(s.mv)}</td>
                <td className={`px-3 py-2 ${tone(s.perfV)}`}>{pct(s.perfV)}</td>
                <td className="px-3 py-2">{pct(s.aprov)}</td>
                <td className="px-3 py-2 font-medium text-primary">{lid && lid.qtd > 0 ? lid.c.nome : "—"}</td>
              </tr>
            );
          })}
        </Tabela>
      </Box>

      <RankTable title={`Ranking geral — ${GRUPO_NOME[g]}`} rows={ranking(keys)} deptName={deptName} />
      {items.map((it) => <RankTable key={it.k} title={`Ranking — ${it.nome}`} rows={ranking([it.k])} deptName={deptName} />)}
    </>
  );
}

function RankTable({ title, rows, deptName }: { title: string; rows: Row[]; deptName: (id: string | null) => string }) {
  const lider = rows[0] && (rows[0].qtd > 0 || rows[0].perfQ > 0) ? rows[0] : null;
  const usaMeta = rows.some((r) => r.mq > 0);
  return (
    <Box title={title}>
      <Tabela head={["#", "Consultor", "Depto", "Qtd", "Meta", "Perf.", "Projeção", "Proj. %", "Valor", "Meta R$", "Perf. R$", "Aproveit.", "Nec./dia", "vs. Líder"]}>
        {rows.length === 0 && <tr><td colSpan={14} className="px-3 py-8 text-center text-muted-foreground">Nenhum consultor cadastrado.</td></tr>}
        {rows.map((l, i) => {
          const gap = lider ? (usaMeta ? `−${((lider.perfQ - l.perfQ) * 100).toFixed(1)} pts` : `−${num(lider.qtd - l.qtd)} un.`) : "—";
          return (
            <tr key={l.c.id} className="border-t border-border">
              <td className="px-3 py-2">{i + 1}</td>
              <td className="px-3 py-2 font-medium">{l.c.nome}</td>
              <td className="px-3 py-2 text-muted-foreground">{deptName(l.c.department_id)}</td>
              <td className="px-3 py-2 font-semibold">{num(l.qtd)}</td>
              <td className="px-3 py-2 text-muted-foreground">{num(l.mq)}</td>
              <td className={`px-3 py-2 font-semibold ${tone(l.perfQ)}`}>{pct(l.perfQ)}</td>
              <td className="px-3 py-2">{num(l.projQ)}</td>
              <td className="px-3 py-2"><Barra p={l.projPctQ} /></td>
              <td className="px-3 py-2">{brl(l.valor)}</td>
              <td className="px-3 py-2 text-muted-foreground">{brl(l.mv)}</td>
              <td className={`px-3 py-2 ${tone(l.perfV)}`}>{pct(l.perfV)}</td>
              <td className="px-3 py-2">{pct(l.aprov)}</td>
              <td className="px-3 py-2">{l.necQ ? num(l.necQ) : "—"}</td>
              <td className="whitespace-nowrap px-3 py-2">{lider && lider.c.id === l.c.id ? <span className="font-semibold text-primary">Líder</span> : <span className="text-destructive">{gap}</span>}</td>
            </tr>
          );
        })}
      </Tabela>
    </Box>
  );
}

type Draft = Record<string, Record<string, number>>;

function Lancar({ cons, allCons, sales, visits, ini, end, onDone }: {
  cons: Cons[]; allCons: Cons[]; sales: ASale[]; visits: AVisit[]; ini: string; end: string; onDone: () => void;
}) {
  const hoje = new Date().toISOString().slice(0, 10);
  const [dia, setDia] = useState(hoje >= ini && hoje <= end ? hoje : ini);
  const [draft, setDraft] = useState<Draft>({});
  const [txt, setTxt] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const d: Draft = {};
    for (const s of sales) if (s.dia === dia) { const r = (d[s.consultant_id] ??= {}); r[`${s.item}_q`] = s.qtd; r[`${s.item}_v`] = s.valor; }
    for (const v of visits) if (v.dia === dia) (d[v.consultant_id] ??= {})["pass"] = v.passagens;
    setDraft(d);
  }, [dia, sales, visits]);

  const salvar = async (d: Draft) => {
    setMsg("Salvando…");
    const ids = Object.keys(d);
    const sRows = ids.flatMap((cid) => ITENS.map((it) => ({ consultant_id: cid, dia, item: it.k, qtd: d[cid]![`${it.k}_q`] ?? 0, valor: d[cid]![`${it.k}_v`] ?? 0 })));
    const vRows = ids.map((cid) => ({ consultant_id: cid, dia, passagens: d[cid]!["pass"] ?? 0 }));
    const [a, b] = await Promise.all([
      sRows.length ? supabase.from("agg_sales").upsert(sRows, { onConflict: "consultant_id,dia,item" }) : Promise.resolve({ error: null }),
      vRows.length ? supabase.from("agg_visits").upsert(vRows, { onConflict: "consultant_id,dia" }) : Promise.resolve({ error: null }),
    ]);
    const err = a.error || b.error;
    if (err) return setMsg("Erro ao salvar: " + err.message);
    setMsg(`${ids.length} consultores salvos para ${dia.split("-").reverse().join("/")}.`);
    onDone();
  };

  const set = (cid: string, k: string, v: number) => setDraft({ ...draft, [cid]: { ...(draft[cid] ?? {}), [k]: v } });

  const importar = async () => {
    const lines = txt.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return setMsg("Cole o cabeçalho e ao menos uma linha.");
    const sep = lines[0]!.includes("\t") ? "\t" : ";";
    const head = lines[0]!.split(sep).map(norm);
    const ci = head.findIndex((h) => /consult|vendedor|nome|colaborador/.test(h));
    const pi = head.findIndex((h) => /passag|atendim|ordens|^os$|^o\.s/.test(h));
    const cols = head.map((h, j) => {
      const it = ITENS.find((i) => i.re.test(h));
      return it ? { j, key: `${it.k}_${/r\$|valor|vlr|fatur/.test(h) ? "v" : "q"}` } : null;
    }).filter((x): x is { j: number; key: string } => !!x);
    if (ci < 0 || cols.length === 0) return setMsg("O cabeçalho precisa ter Consultor e ao menos um item (Limpar, Alinhamento, Oxi, Brazzo, Tunap).");
    const cmap = new Map(allCons.map((c) => [norm(c.nome), c.id]));
    const d: Draft = {};
    for (const l of lines.slice(1)) {
      const c = l.split(sep);
      const nome = (c[ci] || "").trim();
      if (!nome || /^total/i.test(nome)) continue;
      let id = cmap.get(norm(nome));
      if (!id) {
        const { data } = await supabase.from("consultants").insert({ nome }).select("id").single();
        if (!data) continue;
        id = data.id; cmap.set(norm(nome), id);
      }
      const r = (d[id] ??= {});
      if (pi >= 0) r["pass"] = (r["pass"] ?? 0) + parseNum(c[pi] ?? "");
      for (const col of cols) r[col.key] = (r[col.key] ?? 0) + parseNum(c[col.j] ?? "");
    }
    await salvar(d);
    setTxt("");
  };

  const inp = "w-16 rounded border border-input bg-background px-2 py-1 text-right";
  return (
    <div className="space-y-6">
      <Box title="Lançamento do dia" right={
        <div className="flex items-center gap-2">
          <input type="date" value={dia} min={ini} max={end} onChange={(e) => setDia(e.target.value)} className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm" />
          <button onClick={() => salvar(Object.fromEntries(cons.map((c) => [c.id, draft[c.id] ?? {}])))} className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground">Salvar dia</button>
        </div>
      }>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left" rowSpan={2}>Consultor</th>
                <th className="px-3 py-2" rowSpan={2}>Passagens</th>
                {ITENS.map((it) => <th key={it.k} colSpan={2} className="border-l border-border px-3 py-2">{it.nome}</th>)}
              </tr>
              <tr>{ITENS.map((it) => [<th key={it.k + "q"} className="border-l border-border px-2 py-1">Qtd</th>, <th key={it.k + "v"} className="px-2 py-1">R$</th>])}</tr>
            </thead>
            <tbody>
              {cons.length === 0 && <tr><td colSpan={12} className="px-3 py-8 text-center text-muted-foreground">Cadastre consultores em "Configurar".</td></tr>}
              {cons.map((c) => {
                const r = draft[c.id] ?? {};
                return (
                  <tr key={c.id} className="border-t border-border">
                    <td className="whitespace-nowrap px-3 py-2 font-medium">{c.nome}</td>
                    <td className="px-2 py-1 text-center"><input type="number" value={r["pass"] || ""} onChange={(e) => set(c.id, "pass", +e.target.value)} className={inp} /></td>
                    {ITENS.map((it) => [
                      <td key={it.k + "q"} className="border-l border-border px-2 py-1"><input type="number" value={r[`${it.k}_q`] || ""} onChange={(e) => set(c.id, `${it.k}_q`, +e.target.value)} className={inp} /></td>,
                      <td key={it.k + "v"} className="px-2 py-1"><input type="number" value={r[`${it.k}_v`] || ""} onChange={(e) => set(c.id, `${it.k}_v`, +e.target.value)} className={`${inp} w-20`} /></td>,
                    ])}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {msg && <p className="px-4 py-3 text-sm text-muted-foreground">{msg}</p>}
      </Box>

      <section className="space-y-3 rounded-xl border border-border bg-card p-6">
        <h3 className="font-semibold">Colar da planilha (agregados do dia {dia.split("-").reverse().join("/")})</h3>
        <p className="text-sm text-muted-foreground">
          Copie do Excel <b>incluindo o cabeçalho</b>. Colunas: <b>Consultor</b>, <b>Passagens</b> (opcional) e os itens pelo nome — <b>Limpar</b>, <b>Alinhamento</b>, <b>Oxi</b>, <b>Brazzo</b>, <b>Tunap</b> para quantidade, e o mesmo nome com <b>R$</b> ou <b>Valor</b> para o valor (ex.: "Brazzo R$"). Colar de novo na mesma data substitui aquele dia.
        </p>
        <textarea value={txt} onChange={(e) => setTxt(e.target.value)} rows={8} placeholder={"Consultor\tPassagens\tLimpar\tLimpar R$\tAlinhamento\tOxi\tBrazzo\tBrazzo R$\tTunap\tTunap R$\nJoão\t12\t3\t450,00\t2\t1\t4\t320,00\t2\t180,00"} className="w-full rounded-lg border border-input bg-background p-3 font-mono text-xs" />
        <button onClick={importar} className="rounded-lg bg-primary px-5 py-2 font-medium text-primary-foreground">Salvar colagem</button>
      </section>
    </div>
  );
}

function Metas({ cons, goals, mes, deptName, onSaved }: { cons: Cons[]; goals: AGoal[]; mes: string; deptName: (id: string | null) => string; onSaved: () => void }) {
  const [m, setM] = useState<Record<string, { q: number; v: number }>>({});
  useEffect(() => { setM(Object.fromEntries(goals.map((g) => [`${g.consultant_id}|${g.item}`, { q: g.meta_qtd, v: g.meta_valor }]))); }, [goals]);
  const salvar = async (cid: string, item: string) => {
    const x = m[`${cid}|${item}`] ?? { q: 0, v: 0 };
    await supabase.from("agg_goals").upsert({ consultant_id: cid, mes, item, meta_qtd: x.q, meta_valor: x.v }, { onConflict: "consultant_id,mes,item" });
    onSaved();
  };
  const inp = "w-16 rounded border border-input bg-background px-2 py-1 text-right";
  return (
    <div className="space-y-6">
      {(["servicos", "pecas"] as Grupo[]).map((g) => {
        const items = ITENS.filter((i) => i.g === g);
        return (
          <Box key={g} title={`Metas de ${GRUPO_NOME[g].toLowerCase()} — ${mes}`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left" rowSpan={2}>Consultor</th>
                    <th className="px-3 py-2 text-left" rowSpan={2}>Depto</th>
                    {items.map((it) => <th key={it.k} colSpan={2} className="border-l border-border px-3 py-2">{it.nome}</th>)}
                  </tr>
                  <tr>{items.map((it) => [<th key={it.k + "q"} className="border-l border-border px-2 py-1">Meta qtd</th>, <th key={it.k + "v"} className="px-2 py-1">Meta R$</th>])}</tr>
                </thead>
                <tbody>
                  {cons.map((c) => (
                    <tr key={c.id} className="border-t border-border">
                      <td className="whitespace-nowrap px-3 py-2 font-medium">{c.nome}</td>
                      <td className="px-3 py-2 text-muted-foreground">{deptName(c.department_id)}</td>
                      {items.map((it) => {
                        const key = `${c.id}|${it.k}`, x = m[key] ?? { q: 0, v: 0 };
                        return [
                          <td key={it.k + "q"} className="border-l border-border px-2 py-1"><input type="number" value={x.q || ""} onChange={(e) => setM({ ...m, [key]: { ...x, q: +e.target.value } })} onBlur={() => salvar(c.id, it.k)} className={inp} /></td>,
                          <td key={it.k + "v"} className="px-2 py-1"><input type="number" value={x.v || ""} onChange={(e) => setM({ ...m, [key]: { ...x, v: +e.target.value } })} onBlur={() => salvar(c.id, it.k)} className={`${inp} w-24`} /></td>,
                        ];
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Box>
        );
      })}
      <p className="text-xs text-muted-foreground">As metas são salvas ao sair do campo e valem para o mês selecionado no topo. A performance e o ranking usam a meta de quantidade; a meta em R$ é acompanhada à parte.</p>
    </div>
  );
}
