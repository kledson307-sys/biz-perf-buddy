import { Barra, Box, brl, div, pct, tone } from "@/components/painel-ui";

type L = { c: { id: string; nome: string; department_id: string | null }; meta: number; real: number; perf: number; proj: number; projPct: number };

/** Tabela executiva de metas do mês: meta, realizado, atingimento, projeção, gap para meta e para o líder. */
export function MetasExecutivo({ linhas, deptName }: { linhas: L[]; deptName: (id: string | null) => string }) {
  const rows = [...linhas].filter((l) => l.meta > 0 || l.real > 0).sort((a, b) => b.perf - a.perf);
  const lider = rows.find((l) => l.meta > 0);
  const T = rows.reduce((a, l) => ({ meta: a.meta + l.meta, real: a.real + l.real, proj: a.proj + l.proj }), { meta: 0, real: 0, proj: 0 });
  const dot = (p: number) => (p >= 1 ? "bg-success" : p >= 0.85 ? "bg-warning" : "bg-destructive");
  return (
    <Box title="Metas do mês · acompanhamento" fit="xl:max-h-[calc(100vh-340px)]">
      <div className="overflow-x-auto"><table className="w-full text-sm">
        <thead><tr className="text-xs text-muted-foreground"><th className="px-3 py-2 text-left">Consultor</th><th className="px-2 text-right">Meta</th><th className="px-2 text-right">Realizado</th><th className="px-2 text-left">Atingimento</th><th className="px-2 text-right">Projeção</th><th className="px-2 text-right">Gap p/ meta</th><th className="px-3 text-right">Gap p/ líder</th></tr></thead>
        <tbody>
          {rows.map((l) => (
            <tr key={l.c.id} className="border-t border-border tabular-nums">
              <td className="px-3 py-1.5"><span className={`mr-2 inline-block size-2 rounded-full ${dot(l.projPct)}`} /><b>{l.c.nome}</b> <span className="text-[10px] text-muted-foreground">{deptName(l.c.department_id)}</span></td>
              <td className="px-2 text-right">{brl(l.meta)}</td>
              <td className="px-2 text-right">{brl(l.real)}</td>
              <td className="px-2"><div className="flex items-center gap-2"><span className={`w-14 font-semibold ${tone(l.perf)}`}>{l.meta ? pct(l.perf) : "—"}</span><div className="w-24"><Barra p={l.perf} /></div></div></td>
              <td className={`px-2 text-right ${tone(l.projPct)}`}>{brl(l.proj)}</td>
              <td className="px-2 text-right">{l.real >= l.meta ? <span className="text-success">✓</span> : brl(l.meta - l.real)}</td>
              <td className="px-3 text-right">{!lider || l === lider ? <span className="text-primary">Líder</span> : <span className="text-destructive">−{((lider.perf - l.perf) * 100).toFixed(1)} pts</span>}</td>
            </tr>
          ))}
          <tr className="border-t-2 border-border font-bold tabular-nums"><td className="px-3 py-2">TOTAL</td><td className="px-2 text-right">{brl(T.meta)}</td><td className="px-2 text-right">{brl(T.real)}</td>
            <td className={`px-2 ${tone(div(T.real, T.meta))}`}>{pct(div(T.real, T.meta))}</td><td className={`px-2 text-right ${tone(div(T.proj, T.meta))}`}>{brl(T.proj)}</td><td className="px-2 text-right">{brl(Math.max(T.meta - T.real, 0))}</td><td /></tr>
        </tbody>
      </table></div>
    </Box>
  );
}
