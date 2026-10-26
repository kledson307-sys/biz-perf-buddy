import { Barra, Box, Kpi, brl, div, pct, tone } from "@/components/painel-ui";

type Linha = { c: { id: string; nome: string; department_id: string | null }; pecas: number; mP: number; margem: number; projP: number; perfP: number };
type Dept = { nome: string; pecas: number; mP: number; margem: number; projP: number };

/** Painel de Peças: faturamento por departamento/canal, margem vs ideal e ranking de consultores em peças. */
export function PecasEstoque({ linhas, porDept, margemIdeal, deptName, passagens }: {
  linhas: Linha[]; porDept: Dept[]; margemIdeal: (n: string) => number; deptName: (id: string | null) => string; passagens?: number;
}) {
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
