import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { bg } from "@/components/painel-ui";

export type TopoKpi = { label: string; value: string; sub?: string | undefined; p?: number | undefined; cls?: string | undefined; barra?: string | undefined };

/** Cabeçalho executivo compacto das abas (título em linha + KPIs baixos) para caber em tela 16:9 sem rolagem. */
export function AbaTopo({ titulo, sub, icon: Icon, kpis, children }: { titulo: string; sub: string; icon: LucideIcon; kpis: TopoKpi[]; children?: ReactNode }) {
  return (
    <section className="space-y-2 print:hidden">
      <div className="flex items-center gap-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/15"><Icon strokeWidth={1.5} className="size-4 text-primary" /></span>
        <h2 className="text-base font-bold">{titulo}</h2>
        <p className="hidden truncate text-xs text-muted-foreground sm:block">· {sub}</p>
        <div className="m-stripe ml-auto hidden h-0.5 w-24 sm:block" />
      </div>
      {kpis.length > 0 && <div className={`grid grid-cols-2 gap-2 ${kpis.length >= 5 ? "lg:grid-cols-5" : kpis.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}>
        {kpis.map((k) => (
          <div key={k.label} className="lux-card px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{k.label}</p>
            <p className={`text-lg font-bold leading-tight ${k.cls ?? ""}`}>{k.value}</p>
            {k.p !== undefined && <div className="my-1 h-1 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${k.barra ?? bg(k.p)}`} style={{ width: `${Math.min(Math.max(k.p, 0) * 100, 100)}%` }} /></div>}
            {k.sub && <p className="truncate text-[11px] text-muted-foreground" title={k.sub}>{k.sub}</p>}
          </div>
        ))}
      </div>}
      {children}
    </section>
  );
}
