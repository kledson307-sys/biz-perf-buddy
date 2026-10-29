import { Box, brl, div, pct, tone } from "@/components/painel-ui";

type S = { consultant_id: string; dia: string; servicos: number; pecas: number };

/** Evolução diária do time: faturamento acumulado (serviços + peças) contra o ritmo linear da meta. */
export function EvolucaoTime({ sales, ids, meta, mes }: { sales: S[]; ids: string[]; meta: number; mes: string }) {
  const set = new Set(ids);
  const porDia = new Map<string, number>();
  for (const s of sales) if (set.has(s.consultant_id)) porDia.set(s.dia, (porDia.get(s.dia) ?? 0) + +s.servicos + +s.pecas);
  let acc = 0;
  const pts = [...porDia.keys()].sort().map((d) => ({ d: Number(d.slice(8, 10)), v: (acc += porDia.get(d)!) }));
  const [y, m] = mes.split("-").map(Number);
  const dias = new Date(y!, m!, 0).getDate();
  const W = 600, H = 150, maxY = Math.max(meta, acc, 1);
  const px = (d: number) => (d / dias) * W, py = (v: number) => H - (v / maxY) * (H - 10);
  const linha = [{ d: 0, v: 0 }, ...pts].map((p, i) => `${i ? "L" : "M"}${px(p.d).toFixed(1)},${py(p.v).toFixed(1)}`).join(" ");
  const ultimo = pts.at(-1);
  const esperado = ultimo ? div(meta * ultimo.d, dias) : 0;
  return (
    <Box title="Evolução diária do time" right={ultimo ? <span className={`text-xs font-semibold ${tone(div(acc, esperado))}`}>{brl(acc)} · {pct(div(acc, esperado))} do ritmo</span> : undefined}>
      {!pts.length ? <p className="p-4 text-sm text-muted-foreground">Sem vendas importadas neste mês.</p> : (
        <div className="p-3">
          <svg viewBox={`0 0 ${W} ${H + 16}`} className="w-full" role="img" aria-label="Faturamento acumulado do time contra o ritmo da meta">
            {[0.25, 0.5, 0.75, 1].map((f) => <line key={f} x1="0" x2={W} y1={py(maxY * f)} y2={py(maxY * f)} className="stroke-border" strokeWidth="1" />)}
            <line x1="0" y1={H} x2={W} y2={py(meta)} className="stroke-muted-foreground" strokeWidth="1.5" strokeDasharray="5 5" />
            <path d={linha} fill="none" stroke="var(--neon)" strokeWidth="2.5" />
            {ultimo && <circle cx={px(ultimo.d)} cy={py(ultimo.v)} r="4" fill="var(--neon)" />}
            {[1, 10, 20, dias].map((d) => <text key={d} x={Math.min(px(d), W - 14)} y={H + 13} className="fill-muted-foreground text-[10px]">{d}</text>)}
          </svg>
          <p className="mt-1 flex gap-4 text-[11px] text-muted-foreground"><span>━ Realizado acumulado</span><span>- - - Ritmo da meta ({brl(meta)})</span></p>
        </div>
      )}
    </Box>
  );
}
