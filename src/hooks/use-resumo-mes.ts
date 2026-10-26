import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { loadOpenOrders, type OpenOrders } from "@/lib/open-orders.functions";
import { STATUS, type OsImport } from "@/lib/os-controle";

export type ResumoMes = {
  os: OpenOrders;
  pass: number;
  agg: Record<string, { q: number; v: number; mq: number }>;
  mec: { s: number; p: number; ms: number; mp: number; pass: number };
  fluxo: { st: string; n: number }[];
  parados: number;
  amarelos: number;
  abertas: number;
  mediaDias: number;
};

const vazio: ResumoMes = { os: {}, pass: 0, agg: {}, mec: { s: 0, p: 0, ms: 0, mp: 0, pass: 0 }, fluxo: [], parados: 0, amarelos: 0, abertas: 0, mediaDias: 0 };

/** Leituras de resumo do mês (O.S. abertas, passagens, agregados, técnicos, controle O.S.) para Dashboard e topo das abas. */
export function useResumoMes(mes: string) {
  const [r, setR] = useState<ResumoMes>(vazio);
  useEffect(() => {
    let off = false;
    const [y, m] = mes.split("-").map(Number);
    const fim = `${mes}-${new Date(y!, m!, 0).getDate()}`;
    void (async () => {
      const [o, v, s, g, mm, oi] = await Promise.all([
        loadOpenOrders({ data: { mes } }).catch(() => null),
        supabase.from("agg_visits").select("passagens").gte("dia", `${mes}-01`).lte("dia", fim),
        supabase.from("agg_sales").select("item,qtd,valor").gte("dia", `${mes}-01`).lte("dia", fim),
        supabase.from("agg_goals").select("item,meta_qtd").eq("mes", mes),
        supabase.from("mech_month").select("servicos,pecas,meta_servicos,meta_pecas,passagens").eq("mes", mes),
        supabase.from("os_imports").select("id,at,nome,arquivo,itens").order("at", { ascending: false }).limit(1),
      ]);
      if (off) return;
      const agg: ResumoMes["agg"] = {};
      for (const x of s.data ?? []) { const a = (agg[x.item] ??= { q: 0, v: 0, mq: 0 }); a.q += +x.qtd; a.v += +x.valor; }
      for (const x of g.data ?? []) { const a = (agg[x.item] ??= { q: 0, v: 0, mq: 0 }); a.mq += +x.meta_qtd; }
      const itens = ((oi.data?.[0] as unknown as OsImport | undefined)?.itens ?? []).filter((i) => i.st !== "encerrado");
      setR({
        os: o?.valores ?? {},
        pass: (v.data ?? []).reduce((a, x) => a + +x.passagens, 0),
        agg,
        mec: (mm.data ?? []).reduce((t, x) => ({ s: t.s + +x.servicos, p: t.p + +x.pecas, ms: t.ms + +x.meta_servicos, mp: t.mp + +x.meta_pecas, pass: t.pass + +x.passagens }), vazio.mec),
        fluxo: STATUS.filter((x) => x.k !== "encerrado").map((x) => ({ st: x.nome, n: itens.filter((i) => i.st === x.k).length })).filter((x) => x.n),
        parados: itens.filter((i) => i.dias > 30).length,
        amarelos: itens.filter((i) => i.dias > 20 && i.dias <= 30).length,
        abertas: itens.length,
        mediaDias: itens.length ? itens.reduce((a, i) => a + i.dias, 0) / itens.length : 0,
      });
    })();
    return () => { off = true; };
  }, [mes]);
  return r;
}
