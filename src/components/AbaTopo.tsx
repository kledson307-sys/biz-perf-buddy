import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { bg } from "@/components/painel-ui";

export type TopoKpi = { label: string; value: string; sub?: string | undefined; p?: number | undefined; cls?: string | undefined; barra?: string | undefined };

/** Cabeçalho executivo padrão das abas (título, subtítulo e cartões de resumo), no visual BMW. */
export function AbaTopo({ titulo, sub, icon: Icon, kpis, children }: { titulo: string; sub: string; icon: LucideIcon; kpis: TopoKpi[]; children?: ReactNode }) {
  return (
    <section className="space-y-3 print:hidden">
      <div className="lux-card relative overflow-hidden p-4 sm:p-5">
        <div className="m-stripe absolute inset-x-0 top-0" />
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15"><Icon strokeWidth={1.5} className="size-5 text-primary" /></span>
          <div className="min-w-0"><h2 className="text-lg font-bold sm:text-xl">{titulo}</h2><p className="text-xs text-muted-foreground sm:text-sm">{sub}</p></div>
        </div>
      </div>
      {kpis.length > 0 && <div className={`grid grid-cols-2 gap-3 ${kpis.length >= 5 ? "lg:grid-cols-5" : kpis.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}>
        {kpis.map((k) => (
          <div key={k.label} className="lux-card p-3 sm:p-4">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{k.label}</p>
            <p className={`mt-1 text-lg font-bold sm:text-xl ${k.cls ?? ""}`}>{k.value}</p>
            {k.p !== undefined && <div className="my-1.5 h-1.5 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${k.barra ?? bg(k.p)}`} style={{ width: `${Math.min(Math.max(k.p, 0) * 100, 100)}%` }} /></div>}
            {k.sub && <p className="text-xs text-muted-foreground">{k.sub}</p>}
          </div>
        ))}
      </div>}
      {children}
    </section>
  );
}
