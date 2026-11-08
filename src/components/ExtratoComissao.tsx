import { brl, pct } from "@/components/painel-ui";
import type { Extrato } from "@/lib/comissoes";

const fmtV = (v: number, f?: "brl" | "pct") => (f === "pct" ? pct(v) : brl(v));
const COR = { ok: "text-success", nao: "text-destructive", pendente: "text-warning" } as const;
const ROT = { ok: "Atingido", nao: "Não atingido", pendente: "Pendente" } as const;

/** Extrato de comissão do colaborador: atual, projeção e "próximo degrau". */
export function ExtratoComissao({ atual, proj, nps }: { atual: Extrato; proj?: Extrato; nps?: { rotulo: string; faltam: number } | null }) {
  const a = atual;
  return (
    <div className="space-y-3">
      <section className="lux-card grid gap-3 p-4 sm:grid-cols-4">
        <div><p className="text-xs text-muted-foreground">Total estimado hoje</p><p className="text-2xl font-bold text-primary">{brl(a.total)}</p></div>
        {proj && <div><p className="text-xs text-muted-foreground">Se mantiver o ritmo</p><p className="text-2xl font-bold">{brl(proj.total)}</p></div>}
        <div><p className="text-xs text-muted-foreground">Comissão + DSR</p><p className="text-lg font-semibold">{brl(a.comissao + a.dsr)}</p><p className="text-[11px] text-muted-foreground">DSR do mês seguinte {pct(a.dsrPct)}</p></div>
        <div><p className="text-xs text-muted-foreground">Premiações válidas</p><p className="text-lg font-semibold">{brl(a.premiosValidos)}</p>{a.corteNps > 0 && <p className="text-[11px] text-destructive">Corte NPS −{brl(a.corteNps)}</p>}</div>
      </section>
      {nps && nps.faltam > 0 && a.premiosBrutos > 0 && (
        <p className="lux-card border-destructive/40 p-3 text-sm text-destructive">⚠️ Suas premiações de {brl(a.premiosBrutos)} estão em risco pelo {nps.rotulo}. Faltam {nps.faltam} avaliações promotoras para validar.</p>
      )}
      <section className="lux-card overflow-hidden text-sm">
        <h3 className="border-b px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Extrato · {a.perfil.cargo}</h3>
        <div className="divide-y">
          {a.fixo > 0 && <p className="flex justify-between px-4 py-2"><span>Salário fixo</span><b>{brl(a.fixo)}</b></p>}
          {a.comissoes.map((c) => <p key={c.rotulo} className="flex justify-between gap-2 px-4 py-2"><span>{c.rotulo} <span className="text-muted-foreground">· {pct(c.pct)} de {brl(c.base)}</span></span><b>{brl(c.valor)}</b></p>)}
          {a.dsr > 0 && <p className="flex justify-between px-4 py-2"><span>DSR ({pct(a.dsrPct)})</span><b>{brl(a.dsr)}</b></p>}
          {a.premios.map((p) => (
            <div key={p.id} className="px-4 py-2">
              <p className="flex justify-between gap-2"><span>{p.rotulo} <span className={`text-xs ${COR[p.status]}`}>· {ROT[p.status]}{p.info ? ` · ${p.info}` : ""}</span></span><b>{brl(p.valor)}</b></p>
              {p.proximo && p.falta != null && <p className="text-xs text-muted-foreground">Próximo degrau: faltam {fmtV(p.falta, p.fmt)} para {brl(p.proximo[1])} (meta {fmtV(p.proximo[0], p.fmt)})</p>}
            </div>
          ))}
          {a.perfil.travaNps && <p className="flex justify-between px-4 py-2 text-xs text-muted-foreground"><span>Validação NPS das premiações ({a.perfil.segmento === "moto" ? "Motorrad ≥ 88%" : "50% BMW + 50% MINI ≥ 85%"})</span><b>{pct(a.fator)}</b></p>}
          <p className="flex justify-between bg-muted/40 px-4 py-2 font-semibold"><span>Total estimado</span><span>{brl(a.total)}</span></p>
        </div>
      </section>
      <p className="text-[11px] text-muted-foreground">Simulação com os dados do sistema. Itens pendentes dependem de confirmação da gestão; o valor oficial é o do RH.</p>
    </div>
  );
}
