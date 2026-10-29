import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Kpi, Posicao, brl, div, pct, tone, uni } from "@/components/painel-ui";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { MixPassagens } from "@/components/MixPassagens";
import { NpsResumoRestrito } from "@/components/NpsPainel";
import { META_PROMOTOR } from "@/lib/nps";
import type { Composicao } from "@/lib/mecanicos";

type T = { nome: string; servicos: number; pecas: number; passagens: number; meta_servicos: number; meta_pecas: number; composicao?: Composicao | undefined };
type Dados = { tecnicos: T[]; params: { du_totais: number; du_decorridos: number; dc_totais: number; dc_decorridos: number; base: string } | null };
const OCULTOS = ["VINICIUS", "DELMIR", "LUIS SANDRO"];

/** Tela do chefe de oficina: todos os técnicos de Carro. */
export function ChefeOficina() {
  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7));
  const [d, setD] = useState<Dados | null>(null);
  const [erro, setErro] = useState("");
  useEffect(() => {
    setErro("");
    supabase.rpc("tecnicos_carro", { p_mes: mes }).then(({ data, error }) => {
      if (error) setErro("Não foi possível carregar os dados.");
      else setD(data as unknown as Dados);
    });
  }, [mes]);
  const p = d?.params;
  const uteis = (p?.base ?? "uteis") === "uteis";
  const dec = Math.max(1, uteis ? p?.du_decorridos ?? 1 : p?.dc_decorridos ?? 1);
  const tot = Math.max(dec, uteis ? p?.du_totais ?? 22 : p?.dc_totais ?? 30);
  const rest = Math.max(1, tot - dec);
  const proj = (v: number) => (v / dec) * tot;
  const todos = d?.tecnicos ?? [];
  const soma = (k: "servicos" | "pecas" | "passagens" | "meta_servicos" | "meta_pecas") => todos.reduce((n, t) => n + +t[k], 0);
  const sv = soma("servicos"), pc = soma("pecas"), ms = soma("meta_servicos"), mp = soma("meta_pecas");
  const lista = todos.filter(t => !OCULTOS.includes(t.nome.toUpperCase()))
    .map(t => ({ ...t, perf: div(+t.servicos + +t.pecas, +t.meta_servicos + +t.meta_pecas) }))
    .sort((a, b) => b.perf - a.perf);
  const linha = (v: number, m: number) => <span>Meta {brl(m)} · <b className={tone(div(v, m))}>{pct(div(v, m))}</b><br />Projeção {brl(proj(v))} · Precisa/dia {brl(Math.max(0, m - v) / rest)}</span>;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-4xl space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <div><h1 className="text-xl font-bold">Técnicos de Carro</h1><p className="text-sm text-muted-foreground">Chefe de Oficina · Delmir Xavier</p></div>
          <div className="flex items-center gap-2">
            <input type="month" className="h-9 rounded-md border bg-background px-2 text-sm" value={mes} onChange={(e) => setMes(e.target.value)} />
            <ThemeToggle />
            <Button size="sm" variant="outline" onClick={() => supabase.auth.signOut()}><LogOut className="size-4" /> Sair</Button>
          </div>
        </header>
        {erro && <p className="text-sm text-destructive">{erro}</p>}
        {d && <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Kpi label="Serviços (equipe)" value={brl(sv)} sub={linha(sv, ms)} />
            <Kpi label="Peças (equipe)" value={brl(pc)} sub={linha(pc, mp)} />
            <Kpi label="Passagens" value={uni(soma("passagens"))} sub={<span>Total {brl(sv + pc)}</span>} />
          </div>
          <NpsResumoRestrito titulo="NPS da oficina · Carro" meta={META_PROMOTOR.carro} />
          <MixPassagens titulo="Mix de passagens · Carro" linhas={lista} todos={todos} />
          <div className="space-y-2">
            {lista.map((t, i) => (
              <div key={t.nome} className="rounded-lg border border-border bg-card p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="font-semibold"><Posicao i={i} /> {t.nome}</span>
                  <b className={tone(t.perf)}>{pct(t.perf)}</b>
                </div>
                <div className="grid gap-2 text-xs sm:grid-cols-3">
                  <div><div className="text-muted-foreground">Serviços {brl(+t.servicos)}</div>{linha(+t.servicos, +t.meta_servicos)}</div>
                  <div><div className="text-muted-foreground">Peças {brl(+t.pecas)}</div>{linha(+t.pecas, +t.meta_pecas)}</div>
                  <div><div className="text-muted-foreground">Passagens</div>{uni(+t.passagens)}</div>
                </div>
              </div>
            ))}
            {!lista.length && <p className="text-sm text-muted-foreground">Ainda não há dados neste mês.</p>}
          </div>
        </>}
      </div>
    </div>
  );
}
