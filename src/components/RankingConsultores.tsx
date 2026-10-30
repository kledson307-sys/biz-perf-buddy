import { Fragment, useState, type ReactNode } from "react";
import { ArrowUpRight, Package, Target, Trophy, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { MixConsultores } from "@/components/MixConsultores";
import { bg, brl, div, pct, tone, uni } from "@/components/painel-ui";
import { calcPerformance } from "@/lib/performance";

type Consultant = { c: { id: string; nome: string }; servicos: number; pecas: number; mS: number; mP: number; meta: number; real: number; perf: number };
type Props = { linhas: Consultant[]; pass: Record<string, number>; mes: string; dec: number; tot: number; soPecas: (nome: string) => boolean; evolution: (consultor: Consultant) => ReactNode };

/** The marker is elapsed-month progress; the fill is actual goal attainment. */
function Ritmo({ realizado, projetado, dec, tot, meta, compact = false }: { realizado: number; projetado: number; dec: number; tot: number; meta: number; compact?: boolean }) {
  const expected = Math.min(Math.max(div(dec, tot), 0), 1);
  return <div className={compact ? "flex w-24 items-center gap-1.5" : "min-w-24"}>
    <div className={`${compact ? "w-10 shrink-0 text-right" : "mb-1 flex justify-between gap-1"} font-semibold ${meta && dec ? tone(projetado) : "text-muted-foreground"}`}><span>{meta && dec ? pct(projetado) : "—"}</span>{!compact && <span className="text-[9px] font-normal text-muted-foreground">da meta</span>}</div>
    <div className="relative h-1.5 flex-1 rounded-full bg-muted" role="img" aria-label={`Realizado ${pct(realizado)}; ritmo esperado ${pct(expected)}; projeção ${meta && dec ? pct(projetado) : "indisponível"}`}>
      <div className={`h-full rounded-full ${meta && dec ? bg(projetado) : "bg-muted"}`} style={{ width: `${Math.min(Math.max(realizado, 0), 1) * 100}%` }} />
      <span className="absolute -top-0.5 h-2.5 border-l-2 border-dashed border-foreground/80" style={{ left: `calc(${expected * 100}% - 1px)` }} />
    </div>
  </div>;
}

function LinhaLabel({ pecas }: { pecas: boolean }) {
  const Icon = pecas ? Package : Wrench;
  return <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium ${pecas ? "border-neon/30 bg-neon/5 text-neon" : "border-primary/30 bg-primary/5 text-primary"}`}><Icon className="size-3" />{pecas ? "Peças" : "Serviços"}</span>;
}

export function RankingConsultores({ linhas, pass, mes, dec, tot, soPecas, evolution }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const rank = [...linhas].sort((a, b) => (b.meta ? b.perf : -1) - (a.meta ? a.perf : -1));
  const selected = linhas.find((l) => l.c.id === selectedId);
  const total = calcPerformance(linhas.reduce((n, l) => n + l.servicos, 0), linhas.reduce((n, l) => n + l.pecas, 0), linhas.reduce((n, l) => n + l.mS, 0), linhas.reduce((n, l) => n + l.mP, 0), dec, tot);
  const totalPass = linhas.reduce((n, l) => n + (pass[l.c.id] ?? 0), 0);
  const remaining = Math.max(tot - dec, 0);
  const metrics = (l: Consultant) => calcPerformance(l.servicos, l.pecas, l.mS, l.mP, dec, tot);
  const daily = (need: number, goal: number, real: number) => !goal ? "—" : remaining ? brl(need) : real >= goal ? "Meta atingida" : "Mês encerrado";
  const badge = (i: number) => <span className={`inline-flex size-6 items-center justify-center rounded-full text-[10px] font-bold ${i === 0 ? "bg-warning/15 text-warning" : i === 1 ? "bg-muted text-foreground" : i === 2 ? "bg-coral/15 text-coral" : "text-muted-foreground"}`}>{i < 3 ? <Trophy className="size-3.5" aria-label={`${i + 1}º lugar`} /> : i + 1}</span>;

  return <>
    <div className="hidden lg:block">
      <table className="w-full text-[11px] tabular-nums">
        <thead className="sticky top-0 z-10 bg-card text-muted-foreground"><tr className="text-right">
          <th className="w-7 py-2 text-left font-normal">#</th><th className="text-left font-normal">Consultor</th><th className="text-left font-normal">Linha</th><th className="px-2 font-normal">Meta</th><th className="px-2 font-normal">Realizado</th><th className="px-2 font-normal">Ating.</th><th className="px-2 font-normal">Projeção · ritmo</th><th className="px-2 font-normal">Necessidade/dia</th><th className="px-2 font-normal">Ticket serviço</th><th className="px-2 font-normal">Pass.</th><th className="font-normal">Peças/M.O.</th>
        </tr></thead>
        <tbody>{rank.map((l, i) => {
          const calc = metrics(l), onlyParts = soPecas(l.c.nome), visits = pass[l.c.id] ?? 0;
          return <Fragment key={l.c.id}>{(onlyParts ? [true] : [false, true]).map((parts, idx) => {
            const goal = parts ? l.mP : l.mS, real = parts ? l.pecas : l.servicos, projection = parts ? calc.projP : calc.projS, perf = parts ? calc.perfP : calc.perfS, projected = parts ? calc.projPctP : calc.projPctS;
            return <tr key={parts ? "pecas" : "servicos"} className={`text-right ${idx === 0 ? "border-t border-border" : "border-t border-border/20"}`}>
              {idx === 0 && <><td rowSpan={onlyParts ? 1 : 2} className="text-left align-middle">{badge(i)}</td><td rowSpan={onlyParts ? 1 : 2} className="text-left align-middle"><Button variant="ghost" size="sm" className="h-auto max-w-36 justify-start whitespace-normal px-1 py-1 text-left text-xs font-semibold" onClick={() => setSelectedId(l.c.id)} aria-label={`Ver detalhes de ${l.c.nome}`}>{l.c.nome}<ArrowUpRight className="size-3 shrink-0 text-primary" /></Button><p className="px-1 text-[10px] text-muted-foreground">Total {brl(l.real)} · <span className={l.meta ? tone(l.perf) : ""}>{l.meta ? pct(l.perf) : "Sem meta"}</span></p></td></>}
              <td className="py-1 text-left"><LinhaLabel pecas={parts} /></td><td className="px-2 text-muted-foreground">{brl(goal)}</td><td className="px-2 font-semibold">{brl(real)}</td><td className={`px-2 ${goal ? tone(perf) : "text-muted-foreground"}`}>{goal ? pct(perf) : "—"}</td>
              <td className="px-2 py-1"><div className="flex items-center justify-end gap-2"><span className="whitespace-nowrap font-semibold">{dec ? brl(projection) : "—"}</span><Ritmo compact realizado={perf} projetado={projected} dec={dec} tot={tot} meta={goal} /></div></td>
              <td className="px-2"><span className={`inline-block rounded border px-1.5 py-0.5 ${goal && real < goal ? "border-warning/25 bg-warning/5 text-warning" : "border-border text-muted-foreground"}`}>{daily(parts ? calc.necP : calc.necS, goal, real)}</span></td>
              {idx === 0 && <><td rowSpan={onlyParts ? 1 : 2} className="px-2 align-middle">{!onlyParts && visits ? brl(div(l.servicos, visits)) : "—"}</td><td rowSpan={onlyParts ? 1 : 2} className="px-2 align-middle">{uni(visits)}</td><td rowSpan={onlyParts ? 1 : 2} className="align-middle text-muted-foreground">{!onlyParts && l.servicos > 0 ? div(l.pecas, l.servicos).toFixed(2).replace(".", ",") : "—"}</td></>}
            </tr>;
          })}</Fragment>;
        })}</tbody>
        {rank.length > 0 && <tfoot className="sticky bottom-0 bg-card"><tr className="border-t-2 border-border text-right font-semibold"><td /><td className="py-2 text-left">TOTAL DO TIME</td><td /><td className="px-2">{brl(total.meta)}</td><td className="px-2">{brl(total.real)}</td><td className={`px-2 ${tone(total.perf)}`}>{pct(total.perf)}</td><td className={`px-2 ${tone(total.projPct)}`}>{dec ? brl(total.proj) : "—"}</td><td className="px-2">{remaining ? brl(total.nec) : "—"}</td><td className="px-2">{totalPass ? brl(div(total.servicos, totalPass)) : "—"}</td><td className="px-2">{uni(totalPass)}</td><td>{total.servicos > 0 ? div(total.pecas, total.servicos).toFixed(2).replace(".", ",") : "—"}</td></tr></tfoot>}
      </table>
    </div>
    <div className="space-y-2 lg:hidden">{rank.map((l, i) => { const calc = metrics(l), onlyParts = soPecas(l.c.nome), visits = pass[l.c.id] ?? 0; return <article key={l.c.id} className="rounded-lg border border-border p-3">
      <div className="mb-2 flex items-center justify-between gap-2"><div className="flex min-w-0 items-center gap-1">{badge(i)}<Button variant="ghost" size="sm" className="h-auto whitespace-normal px-1 text-left font-semibold" onClick={() => setSelectedId(l.c.id)} aria-label={`Ver detalhes de ${l.c.nome}`}>{l.c.nome}<ArrowUpRight className="text-primary" /></Button></div><b className={`shrink-0 text-xs ${tone(l.perf)}`}>{l.meta ? pct(l.perf) : "Sem meta"}</b></div>
      {(onlyParts ? [true] : [false, true]).map((parts) => { const goal = parts ? l.mP : l.mS, real = parts ? l.pecas : l.servicos; return <div key={String(parts)} className="border-t border-border py-2"><div className="mb-2 flex justify-between gap-2"><LinhaLabel pecas={parts} /><span className="text-xs">{brl(real)} <span className="text-muted-foreground">/ {brl(goal)}</span></span></div><div className="grid grid-cols-2 gap-3 text-xs"><div><p className="text-muted-foreground">Projeção</p><b>{dec ? brl(parts ? calc.projP : calc.projS) : "—"}</b><Ritmo realizado={parts ? calc.perfP : calc.perfS} projetado={parts ? calc.projPctP : calc.projPctS} dec={dec} tot={tot} meta={goal} /></div><div className="text-right"><p className="text-muted-foreground">Necessidade/dia</p><b className="text-warning">{daily(parts ? calc.necP : calc.necS, goal, real)}</b></div></div></div>; })}
      <div className="flex flex-wrap justify-between gap-2 border-t border-border pt-2 text-[11px] text-muted-foreground"><span>Total {brl(l.real)}</span><span>{uni(visits)} passagens</span>{!onlyParts && <span>Ticket serviço {visits ? brl(div(l.servicos, visits)) : "—"}</span>}{!onlyParts && <span>Peças/M.O. {l.servicos > 0 ? div(l.pecas, l.servicos).toFixed(2).replace(".", ",") : "—"}</span>}</div>
    </article>; })}</div>
    {!rank.length && <p className="py-8 text-center text-sm text-muted-foreground">Sem consultores no mês.</p>}
    <Sheet open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelectedId(null); }}><SheetContent className="w-full overflow-y-auto sm:max-w-xl">
      {selected && (() => { const calc = metrics(selected), onlyParts = soPecas(selected.c.nome), visits = pass[selected.c.id] ?? 0; return <>
        <SheetHeader className="mb-5 text-left"><SheetTitle>{selected.c.nome}</SheetTitle><SheetDescription>{mes.split("-").reverse().join("/")} · Performance e projeção de faturado</SheetDescription></SheetHeader>
        <div className="mb-5 grid grid-cols-2 gap-3 border-y border-border py-3"><div><p className="text-xs text-muted-foreground">Realizado total</p><b className="text-xl">{brl(selected.real)}</b></div><div><p className="text-xs text-muted-foreground">Projeção total</p><b className={`text-xl ${tone(calc.projPct)}`}>{dec ? brl(calc.proj) : "—"}</b></div></div>
        {(onlyParts ? [true] : [false, true]).map((parts) => { const goal = parts ? calc.mP : calc.mS, real = parts ? calc.pecas : calc.servicos, projected = parts ? calc.projPctP : calc.projPctS, need = parts ? calc.necP : calc.necS; return <section key={String(parts)} className="mb-5 border-b border-border pb-4"><div className="mb-3 flex justify-between gap-2"><LinhaLabel pecas={parts} /><b className={`text-xs ${goal && dec ? tone(projected) : "text-muted-foreground"}`}>{!goal ? "Sem meta" : !dec ? "Sem dias decorridos" : projected >= 1 ? "No ritmo da meta" : projected >= 0.85 ? "Atenção ao ritmo" : "Recuperação necessária"}</b></div><dl className="mb-3 grid grid-cols-2 gap-3 text-sm">{[["Meta", brl(goal)], ["Realizado", brl(real)], ["Projeção", dec ? brl(parts ? calc.projP : calc.projS) : "—"], ["Necessidade/dia", daily(need, goal, real)]].map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="font-semibold">{value}</dd></div>)}</dl><Ritmo realizado={parts ? calc.perfP : calc.perfS} projetado={projected} dec={dec} tot={tot} meta={goal} /><p className="mt-3 text-xs text-muted-foreground">{!goal ? "Defina a meta em Metas & Planejamento." : real >= goal ? "Meta atingida. Sustentar o resultado." : !remaining ? `Saldo não atingido: ${brl(Math.max(goal - real, 0))}.` : `${parts ? "Peças" : "Serviços"}: buscar ${brl(need)} por dia nos ${uni(remaining)} dias restantes para atingir a meta.`}</p></section>; })}
        <div className="mb-5 flex flex-wrap gap-4 text-sm"><span><b>{uni(visits)}</b> passagens</span>{!onlyParts && <span>Ticket serviço <b>{visits ? brl(div(selected.servicos, visits)) : "—"}</b></span>}</div>
        <section className="mb-5"><h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Target className="size-4 text-primary" />Evolução do consultor</h3><div className="h-40">{evolution(selected)}</div></section>
        <MixConsultores mes={mes} nome={selected.c.nome} />
      </>; })()}
    </SheetContent></Sheet>
  </>;
}