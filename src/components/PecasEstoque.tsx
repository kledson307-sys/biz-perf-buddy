import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Box, brl, div, pct, tone, uni } from "@/components/painel-ui";
import { curvaAbc, type ItemPeca } from "@/lib/pecas-itens";
import { Bloco, Linha } from "@/components/Cockpit";
import { CabecalhoTela, KpiCard } from "@/components/TelasGestor";
import { BarChart3, Package, PieChart, RefreshCw, Trophy, Users } from "lucide-react";

type Linha = { c: { id: string; nome: string; department_id: string | null }; pecas: number; mP: number; margem: number; projP: number; perfP: number };
type Dept = { nome: string; pecas: number; mP: number; margem: number; projP: number };

const CORES = ["var(--primary)", "var(--warning)", "var(--neon)", "var(--success)", "var(--coral)", "var(--muted-foreground)"];

/** Peças & Estoque (referência 16:9): KPIs, categorias, departamentos/O.S., giro, consultores e Top 5. */
export function PecasEstoque({ linhas, porDept, margemIdeal, deptName, passagens, mes, tot = 1, dec = 1 }: {
  linhas: Linha[]; porDept: Dept[]; margemIdeal: (n: string) => number; deptName: (id: string | null) => string; passagens?: number; mes: string; tot?: number; dec?: number;
}) {
  const [itens, setItens] = useState<ItemPeca[] | null>(null);
  const [abc, setAbc] = useState(false);
  useEffect(() => { void supabase.from("parts_items").select("itens").eq("mes", mes).maybeSingle().then(({ data }) => setItens((data?.itens as unknown as ItemPeca[]) ?? [])); }, [mes]);
  const curva = curvaAbc(itens ?? []);
  const totItens = curva.reduce((a, i) => a + i.valor, 0);
  const cats = Object.entries(curva.reduce<Record<string, number>>((a, i) => { const k = i.grupo || "Outros"; a[k] = (a[k] ?? 0) + i.valor; return a; }, {})).sort((a, b) => b[1] - a[1]);
  const catTop = cats.length > 5 ? [...cats.slice(0, 5), ["Outros", cats.slice(5).reduce((n, c) => n + c[1], 0)] as [string, number]] : cats;
  const giro = Object.entries(curva.reduce<Record<string, number>>((a, i) => { const k = i.giro || "Sem giro"; a[k] = (a[k] ?? 0) + i.valor; return a; }, {})).sort((a, b) => b[1] - a[1]);
  const comOs = curva.filter((i) => i.os > 0).reduce((a, i) => a + i.valor, 0);
  const tp = porDept.reduce((a, d) => a + d.pecas, 0);
  const tm = porDept.reduce((a, d) => a + d.mP, 0);
  const tmg = porDept.reduce((a, d) => a + d.margem, 0);
  const tproj = porDept.reduce((a, d) => a + d.projP, 0);
  const idealPond = div(porDept.reduce((a, d) => a + margemIdeal(d.nome) * d.pecas, 0), tp);
  const mTone = (m: number, ideal: number) => (ideal ? tone(div(m, ideal)) : "");
  const rank = [...linhas].filter((l) => l.pecas > 0 || l.mP > 0).sort((a, b) => b.pecas - a.pecas);
  const depts = porDept.filter((d) => d.pecas || d.mP);
  const dMax = Math.max(1, ...depts.map((d) => Math.max(d.pecas, d.mP)));
  const semItens = <p className="text-sm text-muted-foreground">Arraste o Faturamento de Peças na esteira única de Importações para ver este quadro.</p>;
  let off = 25;

  return (
    <section className="space-y-2">
      <div className="space-y-2 lg:grid lg:h-[calc(100dvh-7rem)] lg:min-h-[640px] lg:grid-cols-2 lg:grid-rows-[auto_auto_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] lg:gap-2 lg:space-y-0">
        <CabecalhoTela className="lg:col-span-2" titulo="Peças" sub="Controle de estoque, giro e rentabilidade." mes={mes} dec={dec} tot={tot} />
        <div className="grid grid-cols-2 gap-2 lg:col-span-2 lg:grid-cols-4">
          <KpiCard label="Meta" value={brl(tm)} sub={`Projeção ${brl(tproj)} · ${pct(div(tproj, tm))}`} />
          <KpiCard label="Realizado (líquido)" value={brl(tp)} sub={passagens ? `Ticket médio ${brl(div(tp, passagens))}` : "Já com devoluções abatidas"} />
          <KpiCard label="Atingimento" value={pct(div(tp, tm))} cls={tone(div(tp, tm))} sub={`Falta ${brl(Math.max(tm - tp, 0))}`} />
          <KpiCard label="Margem" value={pct(div(tmg, tp))} cls={mTone(div(tmg, tp), idealPond)} sub={`${brl(tmg)} · ideal ${pct(idealPond)}`} />
        </div>

        <Bloco titulo="Faturamento por categoria" icon={<BarChart3 className="size-4 text-primary" />} className="[&_h2]:text-primary">
          {!catTop.length ? semItens : <ul className="space-y-1.5 text-xs">{catTop.map(([g, v], i) => (
            <li key={g} className="flex items-center gap-2">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15"><Package className="size-3.5 text-primary" /></span>
              <div className="min-w-0 flex-1"><p className="truncate">{g}</p><Linha p={div(v, catTop[0]![1])} cor={i === 0 ? "bg-success" : "bg-primary"} /></div>
              <span className="w-12 text-right text-muted-foreground">{pct(div(v, totItens))}</span><b className="w-24 text-right tabular-nums">{brl(v)}</b>
            </li>))}</ul>}
        </Bloco>
        <Bloco titulo="Participação por categoria" icon={<PieChart className="size-4 text-primary" />}>
          {!catTop.length ? semItens : <div className="flex h-full items-center gap-4">
            <div className="relative h-full max-h-40 min-h-24 aspect-square">
              <svg viewBox="0 0 42 42" className="size-full -rotate-0" role="img" aria-label="Participação por categoria">
                <circle cx="21" cy="21" r="15.9" fill="none" className="stroke-muted" strokeWidth="5" />
                {catTop.map(([g, v], i) => { const p = div(v, totItens) * 100; const el = <circle key={g} cx="21" cy="21" r="15.9" fill="none" stroke={CORES[i]} strokeWidth="5" strokeDasharray={`${p} ${100 - p}`} strokeDashoffset={off} />; off -= p; return el; })}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center"><span className="text-[10px] text-muted-foreground">Total</span><b className="text-sm tabular-nums">{brl(totItens)}</b></div>
            </div>
            <ul className="min-w-0 flex-1 space-y-1 text-xs">{catTop.map(([g, v], i) => <li key={g} className="flex items-center gap-2"><span className="size-2.5 shrink-0 rounded-full" style={{ background: CORES[i] }} /><span className="flex-1 truncate">{g}</span><b>{pct(div(v, totItens))}</b></li>)}</ul>
          </div>}
        </Bloco>

        <Bloco titulo="Vendas por departamento · meta x realizado" icon={<BarChart3 className="size-4 text-primary" />}>
          <div className="flex h-full flex-col">
            <div className="flex min-h-20 flex-1 items-end gap-3">{depts.map((d) => (
              <div key={d.nome} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-0.5">
                <span className={`text-[10px] font-bold ${tone(div(d.pecas, d.mP))}`}>{d.mP ? pct(div(d.pecas, d.mP)) : ""}</span>
                <div className="flex h-full w-full items-end justify-center gap-0.5">
                  <div className="w-2/5 rounded-t bg-muted-foreground/30" style={{ height: `${div(d.mP, dMax) * 100}%` }} title={`Meta ${brl(d.mP)}`} />
                  <div className="w-2/5 rounded-t bg-primary" style={{ height: `${Math.max(div(d.pecas, dMax) * 100, 2)}%` }} title={`Realizado ${brl(d.pecas)}`} />
                </div>
                <span className="w-full truncate text-center text-[10px] text-muted-foreground">{d.nome}</span>
              </div>))}</div>
            {curva.length > 0 && <p className="mt-1 text-[11px] text-muted-foreground">Em O.S. <b className="text-foreground">{pct(div(comOs, totItens))}</b> · Balcão/venda direta <b className="text-foreground">{pct(div(totItens - comOs, totItens))}</b></p>}
          </div>
        </Bloco>
        <Bloco titulo="Giro de estoque" icon={<RefreshCw className="size-4 text-primary" />}>
          {!curva.length ? semItens : <div className="grid h-full grid-cols-[auto_1fr] gap-3">
            <div className="flex flex-col justify-around gap-1 text-xs">
              <p className="text-muted-foreground">Itens vendidos<b className="block text-xl text-foreground">{uni(curva.length)}</b></p>
              <p className="text-muted-foreground">Itens classe A<b className="block text-xl text-primary">{uni(curva.filter((i) => i.classe === "A").length)}</b></p>
            </div>
            <ul className="space-y-1 text-xs">{giro.slice(0, 5).map(([g, v]) => <li key={g}><div className="flex justify-between"><span className="truncate">{g}</span><span className="tabular-nums">{brl(v)} · {pct(div(v, totItens))}</span></div><Linha p={div(v, totItens)} cor="bg-primary" /></li>)}</ul>
          </div>}
        </Bloco>

        <Bloco titulo="Peças por consultor" icon={<Users className="size-4 text-primary" />}>
          <table className="w-full text-xs tabular-nums"><thead className="sticky top-0 bg-card text-muted-foreground"><tr><th className="w-6 text-left font-normal">#</th><th className="text-left font-normal">Consultor</th><th className="text-right font-normal">Peças</th><th className="text-right font-normal">Meta</th><th className="text-right font-normal">%</th><th className="text-right font-normal">Margem</th></tr></thead>
            <tbody>{rank.map((l, i) => { const ideal = margemIdeal(deptName(l.c.department_id)); const m = div(l.margem, l.pecas); return (
              <tr key={l.c.id} className="border-t border-border/50"><td className="py-1">{i + 1}</td><td className="font-medium">{l.c.nome}</td><td className="text-right">{brl(l.pecas)}</td><td className="text-right text-muted-foreground">{brl(l.mP)}</td>
                <td className={`text-right font-bold ${tone(l.perfP)}`}>{l.mP ? pct(l.perfP) : "—"}</td><td className={`text-right ${mTone(m, ideal)}`}>{l.pecas && l.margem ? pct(m) : "—"}</td></tr>); })}
              {!rank.length && <tr><td colSpan={6} className="py-4 text-center text-muted-foreground">Sem vendas de peças no mês.</td></tr>}</tbody></table>
        </Bloco>
        <Bloco titulo="Top 5 itens de maior faturamento" icon={<Trophy className="size-4 text-warning" />} right={curva.length ? <button type="button" className="text-[11px] text-primary hover:underline" onClick={() => setAbc(!abc)}>{abc ? "Fechar Curva ABC" : "Curva ABC"}</button> : undefined}>
          {!curva.length ? semItens : <table className="w-full text-xs"><thead className="text-muted-foreground"><tr><th className="text-left font-normal">Item</th><th className="text-right font-normal">Qtd</th><th className="text-right font-normal">Faturamento</th></tr></thead>
            <tbody>{curva.slice(0, 5).map((i) => <tr key={i.cod} className="border-t border-border/50"><td className="max-w-0 truncate py-1">{i.desc || i.cod}</td><td className="text-right">{uni(i.qtd)}</td><td className="text-right font-bold tabular-nums">{brl(i.valor)}</td></tr>)}</tbody></table>}
        </Bloco>
      </div>
      {abc && <Box title="Curva ABC completa">
        <div className="max-h-96 overflow-y-auto"><table className="w-full text-xs"><thead className="sticky top-0 bg-card text-muted-foreground"><tr><th className="px-2 text-left">Classe</th><th className="text-left">Item</th><th>Qtd</th><th>Faturamento</th><th>Margem</th><th>% acum.</th></tr></thead>
          <tbody>{curva.map((i) => <tr key={i.cod} className="border-t border-border"><td className="px-2 font-bold">{i.classe}</td><td>{i.cod} · {i.desc}</td><td className="text-center">{uni(i.qtd)}</td><td className="text-right">{brl(i.valor)}</td><td className="text-right">{pct(div(i.margem, i.valor))}</td><td className="text-right">{pct(i.acum)}</td></tr>)}</tbody></table></div>
      </Box>}
    </section>
  );
}
