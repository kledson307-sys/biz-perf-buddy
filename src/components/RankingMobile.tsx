import { brl, pct, tone } from "@/components/painel-ui";

type Result = {
  servicos: number; pecas: number; mS: number; mP: number;
  real: number; meta: number; perf: number; projPct: number; nec: number;
};
type Seller = Result & { c: { id: string; nome: string; department_id: string | null } };

function Metrics({ result, onlyParts = false }: { result: Result; onlyParts?: boolean }) {
  return <dl className="mt-3 grid min-w-0 grid-cols-2 gap-x-3 gap-y-3 text-sm">
    {!onlyParts && <div className="min-w-0"><dt className="text-xs text-muted-foreground">Serviços</dt><dd className="break-words font-semibold">{brl(result.servicos)}</dd><dd className="break-words text-xs text-muted-foreground">Meta {brl(result.mS)}</dd></div>}
    <div className="min-w-0"><dt className="text-xs text-muted-foreground">Peças</dt><dd className="break-words font-semibold">{brl(result.pecas)}</dd><dd className="break-words text-xs text-muted-foreground">Meta {brl(result.mP)}</dd></div>
    <div className="min-w-0"><dt className="text-xs text-muted-foreground">Total vendido</dt><dd className="break-words font-semibold">{brl(result.real)}</dd><dd className="break-words text-xs text-muted-foreground">Meta {brl(result.meta)}</dd></div>
    <div className="min-w-0"><dt className="text-xs text-muted-foreground">Projeção da meta</dt><dd className={`font-semibold ${result.meta ? tone(result.projPct) : "text-muted-foreground"}`}>{result.meta ? pct(result.projPct) : "Sem meta"}</dd></div>
    <div className="min-w-0"><dt className="text-xs text-muted-foreground">Precisa por dia</dt><dd className="break-words font-semibold">{brl(result.nec)}</dd></div>
  </dl>;
}

export function RankingMobile({ linhas, total, deptName, soPecas }: {
  linhas: Seller[]; total: Result;
  deptName: (id: string | null) => string;
  soPecas: (nome: string) => boolean;
}) {
  return <div className="space-y-3 p-3 md:hidden" data-testid="ranking-mobile">
    {linhas.map((l, i) => <article key={l.c.id} className="min-w-0 rounded-lg border border-border p-3">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        <div className="min-w-0"><h3 className="break-words text-sm font-bold">{["🥇 ","🥈 ","🥉 "][i] ?? `${i + 1}º · `}{l.c.nome}</h3><p className="break-words text-xs text-muted-foreground">{deptName(l.c.department_id)}</p></div>
        <div className="shrink-0 text-right"><p className={`text-sm font-bold ${l.meta ? tone(l.perf) : "text-muted-foreground"}`}>{l.meta ? pct(l.perf) : "Sem meta"}</p><p className="text-xs text-muted-foreground">Performance</p></div>
      </header>
      <Metrics result={l} onlyParts={soPecas(l.c.nome)} />
    </article>)}
    {!linhas.length && <p className="py-3 text-sm text-muted-foreground">Nenhum vendedor neste departamento.</p>}
    <section className="min-w-0 border-t-2 border-primary pt-3"><div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2"><h3 className="font-bold">TOTAL DA EQUIPE</h3><span className={`font-bold ${tone(total.perf)}`}>{pct(total.perf)}</span></div><Metrics result={total} /></section>
  </div>;
}