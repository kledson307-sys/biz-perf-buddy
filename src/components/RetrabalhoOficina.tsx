import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Box, pct, uni } from "@/components/painel-ui";
import { baseNps, daLoja, type NpsItem } from "@/lib/nps";

const RETRABALHO = /CONTINUA|RETRABALHO|QUALIDADE|REPARO/;

/** Índice de retrabalho da oficina a partir das RACs da pesquisa BMW (problema continua / qualidade do reparo). */
export function RetrabalhoOficina() {
  const [itens, setItens] = useState<NpsItem[] | null>(null);
  useEffect(() => { void supabase.from("nps_imports").select("itens").order("at", { ascending: false }).limit(1).maybeSingle().then(({ data }) => setItens(baseNps(daLoja((data?.itens as unknown as NpsItem[]) ?? [])))); }, []);
  if (!itens) return null;
  const aval = itens.filter((x) => x.nota !== null);
  const ret = itens.filter((x) => x.rac && RETRABALHO.test(x.motivo));
  const seg = (s: "carro" | "moto") => { const a = aval.filter((x) => x.segmento === s).length; const r = ret.filter((x) => x.segmento === s).length; return { a, r, i: a ? r / a : 0 }; };
  const c = seg("carro"), m = seg("moto");
  return (
    <Box title="Qualidade técnica · índice de retrabalho (RAC da montadora)">
      {!aval.length ? <p className="p-4 text-sm text-muted-foreground">Importe a planilha NPS para ver o retrabalho.</p> : <div className="grid gap-4 p-4 lg:grid-cols-3">
        <div className="space-y-1 text-sm">
          <p className="flex justify-between"><span>Retrabalho geral</span><b className={ret.length / aval.length > 0.05 ? "text-destructive" : "text-success"}>{pct(ret.length / aval.length)}</b></p>
          <p className="flex justify-between"><span>Carro</span><span>{uni(c.r)} de {uni(c.a)} · {pct(c.i)}</span></p>
          <p className="flex justify-between"><span>Moto</span><span>{uni(m.r)} de {uni(m.a)} · {pct(m.i)}</span></p>
          <p className="text-xs text-muted-foreground">RACs com motivo "problema continua" ou qualidade do reparo.</p>
        </div>
        <ul className="max-h-48 space-y-1 overflow-y-auto text-xs lg:col-span-2">{ret.map((x) => <li key={x.chassi + x.recebimento} className="rounded border border-border p-2"><b>{x.cliente}</b> · {x.veiculo} · {x.consultor} · nota {x.nota ?? "—"}<p className="text-muted-foreground">{x.motivo.toLowerCase()}{x.obs ? ` — ${x.obs}` : ""}</p></li>)}
          {!ret.length && <li className="text-muted-foreground">Nenhuma RAC de retrabalho. 👏</li>}</ul>
      </div>}
    </Box>
  );
}
