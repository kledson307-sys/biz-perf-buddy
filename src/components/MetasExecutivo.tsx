import { useState } from "react";
import { Barra, Box, brl, div, pct, tone } from "@/components/painel-ui";

type L = { c: { id: string; nome: string; department_id: string | null }; meta: number; real: number; perf: number; proj: number; projPct: number };

/** Tabela executiva de metas do mês: meta, realizado, atingimento, projeção, gap para meta e para o líder. */
export function MetasExecutivo({ linhas, deptName, tot = 0, dec = 0 }: { linhas: L[]; deptName: (id: string | null) => string; tot?: number; dec?: number }) {
  const rest = Math.max(tot - dec, 0);
  const ritmo = (meta: number, real: number) => (meta <= real ? "✓" : rest > 0 ? brl((meta - real) / rest) : "—");
  const rows = [...linhas].filter((l) => l.meta > 0 || l.real > 0).sort((a, b) => b.perf - a.perf);
  const lider = rows.find((l) => l.meta > 0);
  const T = rows.reduce((a, l) => ({ meta: a.meta + l.meta, real: a.real + l.real, proj: a.proj + l.proj }), { meta: 0, real: 0, proj: 0 });
  const [extra, setExtra] = useState(0);
  const semMeta = linhas.filter((l) => l.meta <= 0 && l.real > 0);
  const ritmoAtual = div(T.real, dec);
  const simulado = T.real + ritmoAtual * (1 + extra / 100) * rest;
  const termo = (l: L) => {
    const w = window.open("", "_blank"); if (!w) return;
    const mes = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    w.document.write(`<html><head><title>Termo de metas · ${l.c.nome}</title><style>body{font-family:sans-serif;padding:40px;max-width:700px;margin:auto}td{padding:6px;border-bottom:1px solid #ccc}.s{margin-top:80px;border-top:1px solid #000;width:280px;text-align:center;padding-top:4px}</style></head><body>
<h2>HAUS MOTORS SALVADOR · Termo de Metas</h2><p>Mês de referência: <b>${mes}</b></p>
<table><tr><td>Colaborador</td><td><b>${l.c.nome}</b> (${deptName(l.c.department_id)})</td></tr><tr><td>Meta do mês</td><td><b>${brl(l.meta)}</b></td></tr><tr><td>Dias úteis do mês</td><td>${tot.toLocaleString("pt-BR")}</td></tr><tr><td>Ritmo diário necessário</td><td>${brl(div(l.meta, tot))} por dia útil</td></tr>
<tr><td>Trava NPS</td><td>Premiações liberadas apenas se o departamento atingir a meta de promotores (Carro 85% · Moto 88%)</td></tr></table>
<p>Declaro estar ciente da meta acima e das regras de premiação vigentes.</p><div style="display:flex;justify-content:space-between"><div class="s">${l.c.nome}</div><div class="s">Kledson Souza · Gestão</div></div><script>print()</script></body></html>`);
    w.document.close();
  };
  const dot = (p: number) => (p >= 1 ? "bg-success" : p >= 0.85 ? "bg-warning" : "bg-destructive");
  return (
    <Box title="Metas do mês · acompanhamento" fit="xl:max-h-[calc(100vh-340px)]">
      <div className="mb-2 grid gap-2 text-xs md:grid-cols-2">
        <div className="rounded-lg border border-border p-2"><b>Alocação de metas</b> · {semMeta.length ? <span className="text-warning">{semMeta.map((l) => l.c.nome).join(", ")} vendem sem meta definida</span> : <span className="text-success">todos que vendem têm meta ✓</span>} · Meta total da equipe <b>{brl(T.meta)}</b></div>
        <div className="rounded-lg border border-border p-2"><b>Simulador de reta final</b> · ritmo {extra >= 0 ? "+" : ""}{extra}%
          <input type="range" min={-30} max={50} step={5} value={extra} onChange={(e) => setExtra(+e.target.value)} className="mx-2 w-28 align-middle" aria-label="Variação do ritmo diário" />
          fecha em <b className={tone(div(simulado, T.meta))}>{brl(simulado)}</b> ({pct(div(simulado, T.meta))} da meta)</div>
      </div>
      <div className="overflow-x-auto"><table className="w-full text-sm">
        <thead><tr className="text-xs text-muted-foreground"><th className="px-3 py-2 text-left">Consultor</th><th className="px-2 text-right">Meta</th><th className="px-2 text-right">Realizado</th><th className="px-2 text-left">Atingimento</th><th className="px-2 text-right">Projeção</th><th className="px-2 text-right">Gap p/ meta</th><th className="px-2 text-right" title="Valor a vender por dia útil restante">Ritmo/dia útil</th><th className="px-3 text-right">Gap p/ líder</th><th className="px-2" /></tr></thead>
        <tbody>
          {rows.map((l) => (
            <tr key={l.c.id} className="border-t border-border tabular-nums">
              <td className="px-3 py-1.5"><span className={`mr-2 inline-block size-2 rounded-full ${dot(l.projPct)}`} /><b>{l.c.nome}</b> <span className="text-[10px] text-muted-foreground">{deptName(l.c.department_id)}</span></td>
              <td className="px-2 text-right">{brl(l.meta)}</td>
              <td className="px-2 text-right">{brl(l.real)}</td>
              <td className="px-2"><div className="flex items-center gap-2"><span className={`w-14 font-semibold ${tone(l.perf)}`}>{l.meta ? pct(l.perf) : "—"}</span><div className="w-24"><Barra p={l.perf} /></div></div></td>
              <td className={`px-2 text-right ${tone(l.projPct)}`}>{brl(l.proj)}</td>
              <td className="px-2 text-right">{l.real >= l.meta ? <span className="text-success">✓</span> : brl(l.meta - l.real)}</td><td className="px-2 text-right text-primary">{ritmo(l.meta, l.real)}</td>
              <td className="px-3 text-right">{!lider || l === lider ? <span className="text-primary">Líder</span> : <span className="text-destructive">−{((lider.perf - l.perf) * 100).toFixed(1)} pts</span>}</td>
              <td className="px-2"><button type="button" className="text-[11px] text-primary hover:underline" onClick={() => termo(l)}>Termo</button></td>
            </tr>
          ))}
          <tr className="border-t-2 border-border font-bold tabular-nums"><td className="px-3 py-2">TOTAL</td><td className="px-2 text-right">{brl(T.meta)}</td><td className="px-2 text-right">{brl(T.real)}</td>
            <td className={`px-2 ${tone(div(T.real, T.meta))}`}>{pct(div(T.real, T.meta))}</td><td className={`px-2 text-right ${tone(div(T.proj, T.meta))}`}>{brl(T.proj)}</td><td className="px-2 text-right">{brl(Math.max(T.meta - T.real, 0))}</td><td className="px-2 text-right text-primary">{ritmo(T.meta, T.real)}</td><td /><td /></tr>
        </tbody>
      </table></div>
    </Box>
  );
}
