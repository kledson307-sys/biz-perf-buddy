import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Kpi, brl, div, pct, tone, uni } from "@/components/painel-ui";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

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
      <div className="mx-auto max-w-3xl space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold">Meu desempenho</h1>
            <p className="text-sm text-muted-foreground">{d?.nome ?? ""}{d?.grupo && GRUPO[d.grupo] ? ` · Técnico ${GRUPO[d.grupo]}` : ""}</p>
          </div>
          <div className="flex items-center gap-2">
            <input type="month" className="h-9 rounded-md border bg-background px-2 text-sm" value={mes} onChange={(e) => setMes(e.target.value)} />
            <ThemeToggle />
            <Button size="sm" variant="outline" onClick={() => supabase.auth.signOut()}><LogOut className="size-4" /> Sair</Button>
          </div>
        </header>
        {erro && <p className="text-sm text-destructive">{erro}</p>}
        {!erro && !d && <p className="text-sm text-muted-foreground">Ainda não há dados seus neste mês.</p>}
        {d && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Kpi label="Serviços" value={brl(sv)} sub={linha(sv, ms)} />
            <Kpi label="Peças" value={brl(pc)} sub={linha(pc, mp)} />
            <Kpi label="Passagens" value={uni(+d.passagens)} sub={<span>Média por passagem {brl(div(sv + pc, +d.passagens))}</span>} />
            <Kpi label="Posição no grupo" value={d.posicao ? `${d.posicao}º de ${d.participantes}` : "—"} sub={<span>Sua performance <b className={tone(perf)}>{pct(perf)}</b>{d.perf_lider ? <> · líder {pct(+d.perf_lider)}{d.posicao !== 1 ? ` (faltam ${pct(Math.max(0, +d.perf_lider - perf))})` : " — você é o líder!"}</> : null}</span>} />
          </div>
        )}
      </div>
    </div>
  );
}
