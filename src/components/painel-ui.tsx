import type React from "react";

export const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
export const pct = (n: number) => (n * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%";
export const num = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
export const div = (a: number, b: number) => (b ? a / b : 0);
export const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
export const tone = (p: number) => (p >= 1 ? "text-primary" : p >= 0.85 ? "text-chart-4" : "text-destructive");
export const bg = (p: number) => (p >= 1 ? "bg-primary" : p >= 0.85 ? "bg-chart-4" : "bg-destructive");

export function parseNum(v: string) {
  let s = (v || "").replace(/[R$\s%]/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

export function Box({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h3 className="font-semibold">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}
export function Tabela({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted text-left text-xs uppercase text-muted-foreground"><tr>{head.map((h, i) => <th key={i} className="whitespace-nowrap px-3 py-3">{h}</th>)}</tr></thead>
        <tbody>{children}</tbody>
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
export function Kpi({ label, value, sub, cls = "" }: { label: string; value: string; sub?: string; cls?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${cls}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
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
