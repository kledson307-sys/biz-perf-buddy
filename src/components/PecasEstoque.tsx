import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Barra, Box, Kpi, brl, div, pct, tone, uni } from "@/components/painel-ui";
import { curvaAbc, type ItemPeca } from "@/lib/pecas-itens";

type Linha = { c: { id: string; nome: string; department_id: string | null }; pecas: number; mP: number; margem: number; projP: number; perfP: number };
type Dept = { nome: string; pecas: number; mP: number; margem: number; projP: number };

/** Painel de Peças: faturamento por departamento/canal, margem vs ideal e ranking de consultores em peças. */
export function PecasEstoque({ linhas, porDept, margemIdeal, deptName, passagens, mes }: {
  linhas: Linha[]; porDept: Dept[]; margemIdeal: (n: string) => number; deptName: (id: string | null) => string; passagens?: number; mes: string;
}) {
  const [itens, setItens] = useState<ItemPeca[] | null>(null);
  const [abc, setAbc] = useState(false);
  useEffect(() => { void supabase.from("parts_items").select("itens").eq("mes", mes).maybeSingle().then(({ data }) => setItens((data?.itens as unknown as ItemPeca[]) ?? [])); }, [mes]);
  const curva = curvaAbc(itens ?? []);
  const giro = Object.entries(curva.reduce<Record<string, number>>((a, i) => { const k = i.giro || "—"; a[k] = (a[k] ?? 0) + i.valor; return a; }, {})).sort((a, b) => b[1] - a[1]);
  const totItens = curva.reduce((a, i) => a + i.valor, 0);
  const cats = Object.entries(curva.reduce<Record<string, number>>((a, i) => { const k = i.grupo || "Outros"; a[k] = (a[k] ?? 0) + i.valor; return a; }, {})).sort((a, b) => b[1] - a[1]);
  const catTop = cats.length > 5 ? [...cats.slice(0, 5), ["Outros", cats.slice(5).reduce((n, c) => n + c[1], 0)] as [string, number]] : cats;
  const CORES = ["var(--primary)", "var(--neon)", "var(--coral)", "var(--warning)", "var(--success)", "var(--muted-foreground)"];
  const comOs = curva.filter((i) => i.os > 0).reduce((a, i) => a + i.valor, 0);
  const tp = porDept.reduce((a, d) => a + d.pecas, 0);
  const tm = porDept.reduce((a, d) => a + d.mP, 0);
  const tmg = porDept.reduce((a, d) => a + d.margem, 0);
  const tproj = porDept.reduce((a, d) => a + d.projP, 0);
  const idealPond = div(porDept.reduce((a, d) => a + margemIdeal(d.nome) * d.pecas, 0), tp);
  const mTone = (m: number, ideal: number) => (ideal ? tone(div(m, ideal)) : "");
  const rank = [...linhas].filter((l) => l.pecas > 0 || l.mP > 0).sort((a, b) => b.pecas - a.pecas);
  return (
    <section className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Peças faturadas" value={brl(tp)} sub={`${pct(div(tp, tm))} da meta ${brl(tm)}`} cls={tone(div(tp, tm))} />
        <Kpi label="Projeção Peças" value={brl(tproj)} sub={pct(div(tproj, tm))} cls={tone(div(tproj, tm))} />
        <Kpi label="Margem R$" value={brl(tmg)} />
        <Kpi label="Margem %" value={pct(div(tmg, tp))} sub={`Ideal ponderado ${pct(idealPond)}`} cls={mTone(div(tmg, tp), idealPond)} />
        <Kpi label="Ticket médio peças" value={passagens ? brl(div(tp, passagens)) : "—"} sub={passagens ? `${passagens} passagens` : "Sem passagens"} />
      </div>
      <Box title="Peças por departamento / canal">
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
          {porDept.filter((d) => d.pecas || d.mP).map((d) => {
            const ideal = margemIdeal(d.nome); const m = div(d.margem, d.pecas);
            return <div key={d.nome} className="rounded-lg border border-border p-3">
              <div className="flex justify-between text-sm font-semibold"><span>{d.nome}</span><span className={tone(div(d.projP, d.mP))}>{pct(div(d.projP, d.mP))}</span></div>
              <p className="text-lg font-bold">{brl(d.pecas)}</p>
              <p className="text-xs text-muted-foreground">Meta {brl(d.mP)} · Projeção {brl(d.projP)} · {pct(div(d.pecas, tp))} do total</p>
              <div className="my-2"><Barra p={div(d.projP, d.mP)} /></div>
              <p className="text-xs">Margem <b className={mTone(m, ideal)}>{d.pecas ? pct(m) : "—"}</b>{ideal ? <span className="text-muted-foreground"> · ideal {pct(ideal)}</span> : null} · {brl(d.margem)}</p>
            </div>;
          })}
        </div>
      </Box>
      {catTop.length > 0 && <div className="grid gap-4 lg:grid-cols-2">
        <Box title="Faturamento por categoria">
          <div className="space-y-2 p-4 text-sm">{catTop.map(([g, v], i) => <div key={g}><div className="flex justify-between"><span className="flex items-center gap-2"><span className="size-2 rounded-full" style={{ background: CORES[i] }} />{g}</span><span>{brl(v)}</span></div><Barra p={div(v, catTop[0]![1])} /></div>)}</div>
        </Box>
        <Box title="Participação por categoria">
          <div className="flex flex-wrap items-center gap-4 p-4">
            <svg viewBox="0 0 42 42" className="size-36" role="img" aria-label="Participação por categoria">{(() => { let off = 25; return catTop.map(([g, v], i) => { const p = div(v, totItens) * 100; const el = <circle key={g} cx="21" cy="21" r="15.9" fill="none" stroke={CORES[i]} strokeWidth="6" strokeDasharray={`${p} ${100 - p}`} strokeDashoffset={off} />; off -= p; return el; }); })()}</svg>
            <ul className="space-y-1 text-xs">{catTop.map(([g, v], i) => <li key={g} className="flex items-center gap-2"><span className="size-2 rounded-full" style={{ background: CORES[i] }} />{g} · <b>{pct(div(v, totItens))}</b></li>)}</ul>
          </div>
        </Box>
      </div>}
      <div className="grid gap-4 lg:grid-cols-3">
        <Box title="Top 5 itens · faturamento" right={curva.length ? <button type="button" className="text-xs text-primary underline" onClick={() => setAbc(!abc)}>{abc ? "Fechar" : "Curva ABC completa"}</button> : undefined}>
          {!curva.length ? <p className="p-4 text-sm text-muted-foreground">Arraste o Faturamento de Peças na esteira única de Importações para ver os itens.</p> :
            <ol className="divide-y divide-border text-sm">{curva.slice(0, 5).map((i, n) => <li key={i.cod} className="flex justify-between gap-2 px-4 py-2"><span className="truncate">{n + 1}. {i.desc || i.cod} <span className="text-xs text-muted-foreground">{uni(i.qtd)} un · {i.classe}</span></span><b>{brl(i.valor)}</b></li>)}</ol>}
        </Box>
        <Box title="Giro de estoque (faturamento por giro)">
          <div className="space-y-2 p-4 text-sm">{giro.slice(0, 6).map(([g, v]) => <div key={g}><div className="flex justify-between"><span>{g}</span><span>{brl(v)} · {pct(div(v, totItens))}</span></div><Barra p={div(v, totItens)} /></div>)}
            {!giro.length && <p className="text-muted-foreground">Sem dados por item.</p>}</div>
        </Box>
        <Box title="Vendas por O.S. × balcão">
          <div className="space-y-2 p-4 text-sm">{curva.length ? <>
            <p className="flex justify-between"><span>Em O.S. (oficina)</span><b>{brl(comOs)} · {pct(div(comOs, totItens))}</b></p>
            <p className="flex justify-between"><span>Sem O.S. (balcão / venda direta)</span><b>{brl(totItens - comOs)} · {pct(div(totItens - comOs, totItens))}</b></p>
            <p className="flex justify-between"><span>Itens classe A</span><b>{uni(curva.filter((i) => i.classe === "A").length)} de {uni(curva.length)}</b></p>
          </> : <p className="text-muted-foreground">Sem dados por item.</p>}</div>
        </Box>
      </div>
      {abc && <Box title="Curva ABC completa">
        <div className="max-h-96 overflow-y-auto"><table className="w-full text-xs"><thead className="sticky top-0 bg-card text-muted-foreground"><tr><th className="px-2 text-left">Classe</th><th className="text-left">Item</th><th>Qtd</th><th>Faturamento</th><th>Margem</th><th>% acum.</th></tr></thead>
          <tbody>{curva.map((i) => <tr key={i.cod} className="border-t border-border"><td className="px-2 font-bold">{i.classe}</td><td>{i.cod} · {i.desc}</td><td className="text-center">{uni(i.qtd)}</td><td className="text-right">{brl(i.valor)}</td><td className="text-right">{pct(div(i.margem, i.valor))}</td><td className="text-right">{pct(i.acum)}</td></tr>)}</tbody></table></div>
      </Box>}
      <Box title="Consultores em peças">
        <div className="divide-y divide-border">
          {rank.map((l, i) => {
            const ideal = margemIdeal(deptName(l.c.department_id)); const m = div(l.margem, l.pecas);
            return <div key={l.c.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2 text-sm">
              <span className="font-medium">{["🥇", "🥈", "🥉"][i] ?? `${i + 1}º`} {l.c.nome} <span className="text-xs text-muted-foreground">{deptName(l.c.department_id)}</span></span>
              <span>{brl(l.pecas)} <span className={`font-semibold ${tone(l.perfP)}`}>{l.mP ? pct(l.perfP) : "—"}</span> · margem <b className={mTone(m, ideal)}>{l.pecas ? pct(m) : "—"}</b></span>
            </div>;
          })}
        </div>
      </Box>
    </section>
  );
}
