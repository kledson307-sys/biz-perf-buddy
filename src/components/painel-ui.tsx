import type React from "react";

export const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
export const pct = (n: number) => (n * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%";
export const num = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
/** Data e hora como aparecem nos avisos de última atualização. */
export const dataHora = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
/** Quantidades (itens, passagens, metas em unidades): sempre inteiras. */
export const uni = (n: number) => Math.round(n).toLocaleString("pt-BR");
export const div = (a: number, b: number) => (b ? a / b : 0);
export const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
export const tone = (p: number) => (p >= 1 ? "text-success" : p >= 0.85 ? "text-warning" : "text-destructive");
export const bg = (p: number) => (p >= 1 ? "bg-success" : p >= 0.85 ? "bg-warning" : "bg-destructive");

export function parseNum(v: string) {
  let s = (v || "").replace(/[R$\s%]/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

/** `fit` = classes do corpo (ex.: "xl:max-h-[40vh]") para rolagem interna e manter a tela 16:9 sem rolar a página. */
export function Box({ title, children, right, fit, className = "" }: { title: string; children: React.ReactNode; right?: React.ReactNode; fit?: string; className?: string }) {
  return (
    <section className={`overflow-hidden lux-card ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-table-band px-4 py-1.5 text-table-band-foreground">
        <h3 className="text-sm font-semibold">{title}</h3>
        {right}
      </div>
      {fit ? <div className={`overflow-y-auto ${fit}`}>{children}</div> : children}
    </section>
  );
}
/** Stable section identity keeps imports and forms mounted during dashboard refreshes. */
export function Secao({ titulo, children, relatorio }: { titulo: string; children: React.ReactNode; relatorio: boolean }) {
  return (
    <section className={relatorio ? "print-page" : ""}>
      {relatorio && <h2 className="mb-4 hidden border-b-2 border-primary pb-2 text-lg font-bold uppercase tracking-wide print:block">{titulo}</h2>}
      {children}
    </section>
  );
}
export function Tabela({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-muted text-left text-xs uppercase text-muted-foreground"><tr>{head.map((h, i) => <th key={i} className="whitespace-nowrap px-3 py-3">{h}</th>)}</tr></thead>
        <tbody className="[&>tr:nth-child(even)]:bg-muted/30 [&>tr:hover]:bg-muted/50">{children}</tbody>
      </table>
    </div>
  );
}
export function Barra({ p }: { p: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-16 overflow-hidden rounded bg-muted"><div className={`h-full ${bg(p)}`} style={{ width: `${Math.min(p * 100, 100)}%` }} /></div>
      <span className={`font-semibold ${tone(p)}`}>{pct(p)}</span>
    </div>
  );
}
export function Cmp({ label, a, b }: { label: string; a: number; b: number }) {
  return (
    <div className="rounded bg-muted p-2">
      <p className="text-muted-foreground">{label}</p>
      <p><span className={`font-semibold ${tone(a)}`}>{pct(a)}</span> <span className="text-muted-foreground">vs líder {pct(b)}</span></p>
    </div>
  );
}
/** Posição no ranking com destaque de pódio (1º, 2º, 3º). */
export function Posicao({ i }: { i: number }) {
  const medal = ["🥇", "🥈", "🥉"][i];
  return medal ? <span title={`${i + 1}º lugar`} className="text-base">{medal}</span> : <span className="text-muted-foreground">{i + 1}</span>;
}
export function Kpi({ label, value, sub, cls = "", p, destaque = false }: { label: string; value: string; sub?: React.ReactNode; cls?: string; p?: number; destaque?: boolean }) {
  return (
    <div className={`relative min-w-0 overflow-hidden rounded-xl border px-3 py-2 shadow-sm sm:px-4 before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:bg-primary ${destaque ? "border-primary/50 bg-primary/10" : "border-border bg-card"}`}>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-0.5 break-words text-lg font-bold leading-tight ${cls}`}>{value}</p>
      <div className="my-1.5 h-1 overflow-hidden rounded-full bg-muted">{p !== undefined && <div className={`h-full rounded-full ${bg(p)}`} style={{ width: `${Math.min(p * 100, 100)}%` }} />}</div>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
export function Num({ label, v, on }: { label: string; v: number; on: (v: number) => void }) {
  return (
    <label className="block text-sm"><span className="text-muted-foreground">{label}</span>
      <input type="number" value={v} onChange={(e) => on(+e.target.value)} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2" />
    </label>
  );
}
export function Pizza({ dados, centro, fmt = brl, tam = 150 }: {
  dados: { label: string; valor: number; extra?: string }[];
  centro?: React.ReactNode;
  fmt?: (n: number) => string;
  tam?: number;
}) {
  const lista = dados.filter(d => d.valor > 0);
  const total = lista.reduce((s, d) => s + d.valor, 0);
  let acum = 0;
  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div className="relative shrink-0" style={{ width: tam, height: tam }}>
        <svg viewBox="0 0 100 100" className="h-full w-full">
          <circle cx="50" cy="50" r="40" fill="none" strokeWidth="24" className="stroke-muted" />
          {total > 0 && lista.map((d, i) => {
            const p = (d.valor / total) * 100;
            const off = acum;
            acum += p;
            return (
              <circle key={d.label} cx="50" cy="50" r="40" fill="none" strokeWidth="24" pathLength={100}
                stroke={`var(--chart-${(i % 8) + 1})`} strokeDasharray={`${p} ${100 - p}`} strokeDashoffset={-off}
                transform="rotate(-90 50 50)">
                <title>{`${d.label}: ${fmt(d.valor)}${d.extra ? ` · ${d.extra}` : ""} (${pct(d.valor / total)})`}</title>
              </circle>
            );
          })}
        </svg>
        {centro && <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center leading-tight">{centro}</div>}
      </div>
      {lista.length > 0 && <ul className="w-full space-y-1 text-xs">
        {lista.map((d, i) => (
          <li key={d.label} className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-sm" style={{ background: `var(--chart-${(i % 8) + 1})` }} />
            <span className="truncate font-medium">{d.label}</span>
            <span className="ml-auto whitespace-nowrap text-muted-foreground">{fmt(d.valor)} · {pct(d.valor / total)}</span>
          </li>
        ))}
      </ul>}
    </div>
  );
}
