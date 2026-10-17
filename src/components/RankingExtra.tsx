import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Posicao, brl, div, pct, tone, uni } from "./painel-ui";
import { naoVendeAgregado } from "@/lib/agregados";
import { GRUPO_NOME, grupoDe, ocultoDaLista, type Grupo } from "@/lib/mecanicos";

type Cons = { id: string; nome: string; department_id: string | null };
const fimMes = (mes: string) => { const [y, m] = mes.split("-").map(Number); return `${mes}-${new Date(y!, m!, 0).getDate()}`; };

/** Ranking de agregados por consultor: quantidade vendida vs. meta, valor e aproveitamento das passagens. */
export function RankingAgregados({ mes, cons, deptName, tot, dec }: { mes: string; cons: Cons[]; deptName: (id: string | null) => string; tot: number; dec: number }) {
  const [d, setD] = useState<{ s: { consultant_id: string; qtd: number; valor: number }[]; g: { consultant_id: string; meta_qtd: number }[]; v: { consultant_id: string; passagens: number }[] }>({ s: [], g: [], v: [] });
  useEffect(() => {
    const ini = `${mes}-01`, end = fimMes(mes);
    void Promise.all([
      supabase.from("agg_sales").select("consultant_id,qtd,valor").gte("dia", ini).lte("dia", end),
      supabase.from("agg_goals").select("consultant_id,meta_qtd").eq("mes", mes),
      supabase.from("agg_visits").select("consultant_id,passagens").gte("dia", ini).lte("dia", end),
    ]).then(([s, g, v]) => setD({
      s: (s.data ?? []).map(x => ({ ...x, qtd: +x.qtd, valor: +x.valor })),
      g: (g.data ?? []).map(x => ({ ...x, meta_qtd: +x.meta_qtd })),
      v: (v.data ?? []).map(x => ({ ...x, passagens: +x.passagens })),
    }));
  }, [mes]);
  const linhas = cons.filter(c => !naoVendeAgregado(c.nome)).map(c => {
    const qtd = d.s.filter(x => x.consultant_id === c.id).reduce((a, x) => a + x.qtd, 0);
    const valor = d.s.filter(x => x.consultant_id === c.id).reduce((a, x) => a + x.valor, 0);
    const meta = d.g.filter(x => x.consultant_id === c.id).reduce((a, x) => a + x.meta_qtd, 0);
    const pass = d.v.filter(x => x.consultant_id === c.id).reduce((a, x) => a + x.passagens, 0);
    return { c, qtd, valor, meta, pass, perf: div(qtd, meta), proj: div(div(qtd, dec) * tot, meta), aprov: div(qtd, pass) };
  }).sort((a, b) => b.perf - a.perf || b.qtd - a.qtd);
  if (!linhas.length) return <p className="p-4 text-sm text-muted-foreground">Sem vendas de agregados neste mês.</p>;
  return (
    <ul className="divide-y divide-border">
      {linhas.map((l, i) => (
        <li key={l.c.id} className="grid grid-cols-2 gap-2 p-3 text-sm sm:grid-cols-6 sm:items-center">
          <div className="col-span-2 flex items-center gap-2"><Posicao i={i} /><div className="min-w-0"><b className="break-words">{l.c.nome}</b><div className="text-xs text-muted-foreground">{deptName(l.c.department_id)}</div></div></div>
          <div><span className="block text-xs text-muted-foreground">Qtd / meta</span>{uni(l.qtd)} / {uni(l.meta)}</div>
          <div><span className="block text-xs text-muted-foreground">Perf.</span><b className={l.meta ? tone(l.perf) : ""}>{l.meta ? pct(l.perf) : "sem meta"}</b></div>
          <div><span className="block text-xs text-muted-foreground">Projeção</span><b className={l.meta ? tone(l.proj) : ""}>{l.meta ? pct(l.proj) : "—"}</b></div>
          <div><span className="block text-xs text-muted-foreground">Valor · aproveit.</span>{brl(l.valor)} · {pct(l.aprov)}</div>
        </li>
      ))}
    </ul>
  );
}

/** Ranking dos técnicos (carro e moto) pelo faturamento vs. meta; técnicos de diagnóstico ficam fora. */
export function RankingTecnicos({ mes, tot, dec }: { mes: string; tot: number; dec: number }) {
  const [rows, setRows] = useState<{ nome: string; grupo: string; servicos: number; pecas: number; meta_servicos: number; meta_pecas: number; passagens: number }[]>([]);
  useEffect(() => {
    void supabase.from("mech_month").select("nome,grupo,servicos,pecas,meta_servicos,meta_pecas,passagens").eq("mes", mes)
      .then(({ data }) => setRows((data ?? []).map(r => ({ ...r, servicos: +r.servicos, pecas: +r.pecas, meta_servicos: +r.meta_servicos, meta_pecas: +r.meta_pecas, passagens: +r.passagens }))));
  }, [mes]);
  const grupos: Grupo[] = ["carro", "moto"];
  const lista = rows.filter(r => !ocultoDaLista(r.nome)).map(r => {
    const real = r.servicos + r.pecas, meta = r.meta_servicos + r.meta_pecas;
    const g: Grupo = r.grupo === "carro" || r.grupo === "moto" ? r.grupo : grupoDe(r.nome);
    return { ...r, g, real, meta, perf: div(real, meta), proj: div(div(real, dec) * tot, meta) };
  });
  if (!lista.length) return <p className="p-4 text-sm text-muted-foreground">Sem dados de técnicos neste mês.</p>;
  return (
    <div className="space-y-4">
      {grupos.map(g => {
        const ls = lista.filter(r => r.g === g).sort((a, b) => b.perf - a.perf || b.real - a.real);
        if (!ls.length) return null;
        return (
          <div key={g}>
            <h3 className="px-3 pt-2 font-semibold">{GRUPO_NOME[g]}</h3>
            <ul className="divide-y divide-border">
              {ls.map((l, i) => (
                <li key={l.nome} className="grid grid-cols-2 gap-2 p-3 text-sm sm:grid-cols-6 sm:items-center">
                  <div className="col-span-2 flex items-center gap-2"><Posicao i={i} /><b className="break-words">{l.nome}</b></div>
                  <div><span className="block text-xs text-muted-foreground">Faturado / meta</span>{brl(l.real)} / {brl(l.meta)}</div>
                  <div><span className="block text-xs text-muted-foreground">Perf.</span><b className={l.meta ? tone(l.perf) : ""}>{l.meta ? pct(l.perf) : "sem meta"}</b></div>
                  <div><span className="block text-xs text-muted-foreground">Projeção</span><b className={l.meta ? tone(l.proj) : ""}>{l.meta ? pct(l.proj) : "—"}</b></div>
                  <div><span className="block text-xs text-muted-foreground">Passagens</span>{uni(l.passagens)}</div>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
