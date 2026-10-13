import { useEffect, useState } from "react";
import { RetornosVendedor } from "@/components/RetornosVendedor";
import { supabase } from "@/integrations/supabase/client";
import { Box, Kpi, brl, div, pct, tone, uni } from "@/components/painel-ui";
import { ITENS } from "@/lib/agregados";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

type Agg = { item: string; qtd: number; valor: number; meta_qtd: number };
type Dados = {
  nome: string; departamento: string | null; servicos: number; pecas: number; margem: number;
  meta_servicos: number; meta_pecas: number; posicao: number | null; participantes: number; perf_lider: number | null;
  params: { du_totais: number; du_decorridos: number; dc_totais: number; dc_decorridos: number; base: string } | null;
  passagens: number; agregados: Agg[];
};

const IDEAL: Record<string, number> = { "SG OFICINA": 0.33, "ESTETICA": 0.38, "ACESSORIOS": 0.31, "BALCAO": 0.31, "SC FUNILARIA": 0.24 };
const semAcento = (s: string) => s.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

/** Tela da vendedora: só os números dela, posição no ranking e distância do líder. */
export function MinhaPerformance() {
  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7));
  const [d, setD] = useState<Dados | null>(null);
  const [erro, setErro] = useState("");
  useEffect(() => {
    setErro("");
    supabase.rpc("minha_performance", { p_mes: mes }).then(({ data, error }) => {
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
  const ideal = IDEAL[semAcento(d?.departamento ?? "")] ?? 0.31;
  const margem = div(+(d?.margem ?? 0), pc);

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-3xl space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold">Minha performance</h1>
            <p className="text-sm text-muted-foreground">{d?.nome ?? ""}{d?.departamento ? ` · ${d.departamento}` : ""}</p>
          </div>
          <div className="flex items-center gap-2">
            <input type="month" className="h-9 rounded-md border bg-background px-2 text-sm" value={mes} onChange={(e) => setMes(e.target.value)} />
            <ThemeToggle />
            <Button size="sm" variant="outline" onClick={() => supabase.auth.signOut()}><LogOut className="size-4" /> Sair</Button>
          </div>
        </header>
        <RetornosVendedor />
        {erro && <p className="text-sm text-destructive">{erro}</p>}
        {d && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              {ms > 0 || sv > 0 ? (
                <Kpi label="Serviços" value={brl(sv)} sub={<span>Meta {brl(ms)} · <b className={tone(div(sv, ms))}>{pct(div(sv, ms))}</b><br />Projeção {brl(proj(sv))} ({pct(div(proj(sv), ms))})<br />Precisa por dia {brl(Math.max(0, ms - sv) / rest)}</span>} />
              ) : null}
              <Kpi label="Peças" value={brl(pc)} sub={<span>Meta {brl(mp)} · <b className={tone(div(pc, mp))}>{pct(div(pc, mp))}</b><br />Projeção {brl(proj(pc))} ({pct(div(proj(pc), mp))})<br />Precisa por dia {brl(Math.max(0, mp - pc) / rest)}</span>} />
              <Kpi label="Margem de peças" value={pc ? pct(margem) : "—"} sub={<span>Ideal do departamento {pct(ideal)}{pc ? <> · <b className={tone(div(margem, ideal))}>{margem >= ideal ? "na média ou acima" : "abaixo do ideal"}</b></> : null}</span>} />
              <Kpi label="Posição no ranking" value={d.posicao ? `${d.posicao}º de ${d.participantes}` : "—"} sub={<span>Sua performance <b className={tone(perf)}>{pct(perf)}</b>{d.perf_lider ? <> · líder {pct(+d.perf_lider)}{d.posicao !== 1 ? ` (faltam ${pct(Math.max(0, +d.perf_lider - perf))})` : " — você é a líder!"}</> : null}</span>} />
            </div>
            {d.agregados.length > 0 && (
              <Box title="Agregados">
                <div className="divide-y text-sm">
                  {d.agregados.map((a) => {
                    const nome = ITENS.find((i) => i.k === a.item)?.nome ?? a.item;
                    const pf = div(+a.qtd, +a.meta_qtd);
                    return (
                      <div key={a.item} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                        <span className="font-medium">{nome}</span>
                        <span>{uni(+a.qtd)} / meta {uni(+a.meta_qtd)} · <b className={tone(pf)}>{pct(pf)}</b> · {brl(+a.valor)} · aproveitamento {pct(div(+a.qtd, +d.passagens))}</span>
                      </div>
                    );
                  })}
                  <p className="px-5 py-2 text-xs text-muted-foreground">Passagens no mês: {uni(+d.passagens)}</p>
                </div>
              </Box>
            )}
          </>
        )}
      </div>
    </div>
  );
}
