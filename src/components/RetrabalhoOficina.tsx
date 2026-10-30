import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Box, pct, uni } from "@/components/painel-ui";
import { baseNps, daLoja, type NpsItem } from "@/lib/nps";
import { lerOficinaMes } from "@/lib/oficina-mes";
import type { Retorno } from "@/lib/diario-retorno";

const RETRABALHO = /CONTINUA|RETRABALHO|QUALIDADE|REPARO/;
const fmt = (d: string) => d.slice(8, 10) + "/" + d.slice(5, 7);

/** Qualidade técnica: retornos por chassi (Passagens, até 60 dias) atribuídos ao técnico da O.S. anterior + índice de RAC da montadora. */
export function RetrabalhoOficina({ mes }: { mes: string }) {
  const [itens, setItens] = useState<NpsItem[] | null>(null);
  const [ret, setRet] = useState<Retorno[]>([]);
  const [aba, setAba] = useState<"chassi" | "rac">("chassi");
  useEffect(() => { void supabase.from("nps_imports").select("itens").order("at", { ascending: false }).limit(1).maybeSingle().then(({ data }) => setItens(baseNps(daLoja((data?.itens as unknown as NpsItem[]) ?? [])))); }, []);
  useEffect(() => {
    const f = () => void lerOficinaMes(mes).then((x) => setRet(x.retornos));
    f(); window.addEventListener("oficina-mes-atualizada", f); return () => window.removeEventListener("oficina-mes-atualizada", f);
  }, [mes]);

  const aval = (itens ?? []).filter((x) => x.nota !== null);
  const rac = (itens ?? []).filter((x) => x.rac && RETRABALHO.test(x.motivo));
  const porTec = new Map<string, number>();
  for (const r of ret) for (const t of (r.tecnicoAnterior || "SEM TÉCNICO").split(", ")) porTec.set(t, (porTec.get(t) ?? 0) + 1);
  const ranking = [...porTec.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <Box title="Qualidade técnica · retornos" right={
      <div className="flex rounded-full border border-border p-0.5 text-[11px]">
        <button type="button" onClick={() => setAba("chassi")} className={`rounded-full px-2 py-0.5 ${aba === "chassi" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Por chassi ({uni(ret.length)})</button>
        <button type="button" onClick={() => setAba("rac")} className={`rounded-full px-2 py-0.5 ${aba === "rac" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>RAC montadora</button>
      </div>}>
      {aba === "chassi" ? (!ret.length ? <p className="p-4 text-sm text-muted-foreground">Importe a planilha de Passagens na esteira de Importações para identificar retornos pelo chassi.</p> : (
        <div className="grid gap-3 p-3 lg:grid-cols-3">
          <div className="text-sm">
            <p className="mb-1 text-xs text-muted-foreground">Mesmo chassi voltou em até 60 dias com reparo/garantia. Responsável = técnico da O.S. anterior.</p>
            <ul className="max-h-40 space-y-0.5 overflow-y-auto">{ranking.map(([t, q], i) => <li key={t} className="flex justify-between gap-2 text-xs"><span className="truncate">{i + 1}. {t}</span><b className="text-destructive">{uni(q)}</b></li>)}</ul>
          </div>
          <ul className="max-h-48 space-y-1 overflow-y-auto text-xs lg:col-span-2">{ret.map((r) => (
            <li key={r.os + r.osAnterior} className="rounded border border-border p-1.5">
              <b>O.S. {r.os}</b> ({r.tipo}, {fmt(r.data)}) ← retorno da <b>O.S. {r.osAnterior}</b> ({r.tipoAnterior}, {fmt(r.dataAnterior)}) · <b className={r.dias <= 30 ? "text-destructive" : "text-warning"}>{r.dias} dias</b>
              <p className="text-muted-foreground">{r.modelo} · {r.placa || r.chassi} · {r.cliente} · técnico anterior: <b className="text-foreground">{r.tecnicoAnterior || "—"}</b>{r.tecnico ? ` · atual: ${r.tecnico}` : ""}</p>
            </li>))}</ul>
        </div>)) : (!aval.length ? <p className="p-4 text-sm text-muted-foreground">Importe a planilha NPS para ver as RACs.</p> : (
        <div className="grid gap-3 p-3 lg:grid-cols-3">
          <div className="space-y-1 text-sm">
            <p className="flex justify-between"><span>Retrabalho (RAC)</span><b className={rac.length / aval.length > 0.05 ? "text-destructive" : "text-success"}>{pct(rac.length / aval.length)}</b></p>
            <p className="text-xs text-muted-foreground">RACs com motivo "problema continua" ou qualidade do reparo, de {uni(aval.length)} avaliações.</p>
          </div>
          <ul className="max-h-48 space-y-1 overflow-y-auto text-xs lg:col-span-2">{rac.map((x) => <li key={x.chassi + x.recebimento} className="rounded border border-border p-1.5"><b>{x.cliente}</b> · {x.veiculo} · {x.consultor} · nota {x.nota ?? "—"}<p className="text-muted-foreground">{x.motivo.toLowerCase()}{x.obs ? ` — ${x.obs}` : ""}</p></li>)}
            {!rac.length && <li className="text-muted-foreground">Nenhuma RAC de retrabalho. 👏</li>}</ul>
        </div>))}
    </Box>
  );
}
