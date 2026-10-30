import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Kpi, brl, div, pct, tone, uni } from "@/components/painel-ui";
import { AcessoTopo } from "@/components/AcessoTopo";
import { Anel } from "@/components/Cockpit";

type Dados = {
  nome: string; grupo: string; servicos: number; pecas: number; passagens: number;
  meta_servicos: number; meta_pecas: number; posicao: number | null; participantes: number; perf_lider: number | null;
  params: { du_totais: number; du_decorridos: number; dc_totais: number; dc_decorridos: number; base: string } | null;
};
const GRUPO: Record<string, string> = { carro: "Carro", moto: "Moto" };

/** Tela do técnico: só os números dele e a posição no grupo. */
export function MeuDesempenhoTecnico() {
  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7));
  const [d, setD] = useState<Dados | null>(null);
  const [erro, setErro] = useState("");
  useEffect(() => {
    setErro("");
    supabase.rpc("meu_desempenho_tecnico", { p_mes: mes }).then(({ data, error }) => {
      if (error) setErro("Não foi possível carregar seus dados.");
      else setD(data as unknown as Dados);
    });
  }, [mes]);

  const p = d?.params;
  const uteis = (p?.base ?? "uteis") === "uteis";
  const dec = Math.max(1, uteis ? p?.du_decorridos ?? 1 : p?.dc_decorridos ?? 1);
  const tot = Math.max(dec, uteis ? p?.du_totais ?? 22 : p?.dc_totais ?? 30);
  const rest = Math.max(1, tot - dec);
  const proj = (v: number) => (v / dec) * tot;
  const sv = +(d?.servicos ?? 0), pc = +(d?.pecas ?? 0), ms = +(d?.meta_servicos ?? 0), mp = +(d?.meta_pecas ?? 0);
  const perf = div(sv + pc, ms + mp);
  const linha = (v: number, m: number) => (
    <span>Meta {brl(m)} · <b className={tone(div(v, m))}>{pct(div(v, m))}</b><br />Projeção {brl(proj(v))} ({pct(div(proj(v), m))})<br />Precisa por dia {brl(Math.max(0, m - v) / rest)}</span>
  );

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-5xl space-y-4">
        <AcessoTopo titulo="Meu desempenho" sub={`${d?.nome ?? ""}${d?.grupo && GRUPO[d.grupo] ? ` · Técnico ${GRUPO[d.grupo]}` : ""}`} mes={mes} setMes={setMes} />
        {erro && <p className="text-sm text-destructive">{erro}</p>}
        {!erro && !d && <p className="text-sm text-muted-foreground">Ainda não há dados seus neste mês.</p>}
        {d && (
          <section className="lux-card flex flex-wrap items-center justify-around gap-4 p-4">
            <Anel p={perf} rot="Performance" />
            {ms > 0 && <Anel p={div(proj(sv), ms)} rot="Projeção serviços" />}
            {mp > 0 && <Anel p={div(proj(pc), mp)} rot="Projeção peças" />}
            <div className="text-sm">
              <p className="text-muted-foreground">Produzido no mês</p><p className="text-2xl font-bold">{brl(sv + pc)}</p>
              <p className="text-xs text-muted-foreground">Dia {uni(dec)} de {uni(tot)} · {uni(rest)} restantes</p>
            </div>
          </section>
        )}
        {d && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Kpi label="Serviços" value={brl(sv)} sub={linha(sv, ms)} />
            <Kpi label="Peças" value={brl(pc)} sub={linha(pc, mp)} />
            <Kpi label="Passagens" value={uni(+d.passagens)} sub={<span>Ticket médio por passagem {brl(div(sv + pc, +d.passagens))}<br />Peças por R$ 1 de mão de obra: <b>{sv ? `R$ ${div(pc, sv).toFixed(2).replace(".", ",")}` : "—"}</b> (ideal R$ 2,50–3,50)</span>} />
            <Kpi label="Posição no grupo" value={d.posicao ? `${d.posicao}º de ${d.participantes}` : "—"} sub={<span>Sua performance <b className={tone(perf)}>{pct(perf)}</b>{d.perf_lider ? <> · líder {pct(+d.perf_lider)}{d.posicao !== 1 ? ` (faltam ${pct(Math.max(0, +d.perf_lider - perf))})` : " — você é o líder!"}</> : null}</span>} />
          </div>
        )}
        {d && (
          <section className="lux-card p-4 text-sm">
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Necessidade diária · {uni(rest)} dias restantes</h2>
            {ms > 0 && <p className="flex justify-between border-b border-border/50 py-1"><span>Mão de obra (serviços)</span><b>{ms - sv > 0 ? `${brl((ms - sv) / rest)} / dia` : "Meta batida ✅"}</b></p>}
            {mp > 0 && <p className="flex justify-between py-1"><span>Peças</span><b>{mp - pc > 0 ? `${brl((mp - pc) / rest)} / dia` : "Meta batida ✅"}</b></p>}
          </section>
        )}
      </div>
    </div>
  );
}
