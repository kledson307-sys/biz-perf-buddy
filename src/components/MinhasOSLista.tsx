import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Box, brl } from "@/components/painel-ui";
import { analisar, comStatusManual, fmt, hoje, normalizar, STATUS, type OsItem, type Status } from "@/lib/os-controle";
import { unificarPecas } from "@/lib/os-agrupar";

type Dados = { at?: string; itens: OsItem[]; acomp: { os_n: string; prev_manual: string | null; acoes?: Record<string, unknown> }[] };

/** Carteira de O.S. do consultor logado com status (mesmos grupos do Controle O.S.). */
export function MinhasOSLista() {
  const [d, setD] = useState<Dados | null>(null);
  const [f, setF] = useState<Status | "todos">("todos");
  const [busca, setBusca] = useState("");
  useEffect(() => { void supabase.rpc("minhas_os").then(({ data }) => setD((data as unknown as Dados) ?? { itens: [], acomp: [] })); }, []);
  const ref = hoje();
  const itens = useMemo(() => {
    if (!d) return [];
    const ac = new Map(d.acomp.map((a) => [a.os_n, a]));
    return unificarPecas(normalizar(d.itens).map((i) => comStatusManual(i, ac.get(i.n)?.acoes, d.at ?? "")))
      .map((g) => ({ g, prev: analisar(g, undefined, ref, ac.get(g.ns[0]!)?.prev_manual).prev }));
  }, [d, ref]);
  if (!d) return <p className="p-4 text-sm text-muted-foreground">Carregando O.S.…</p>;
  const cont = (k: Status) => itens.filter((x) => x.g.st === k).length;
  const q = busca.trim().toLowerCase();
  const lista = itens.filter((x) => (f === "todos" || x.g.st === f) && (!q || [x.g.n, x.g.placa, x.g.cli, x.g.mod].some((v) => v.toLowerCase().includes(q))))
    .sort((a, b) => b.g.dias - a.g.dias);
  const nome = (k: string) => STATUS.find((s) => s.k === k)?.nome ?? k;
  return (
    <Box title={`Minhas O.S. abertas (${itens.length})`}>
      <div className="space-y-2 p-3">
        <div className="flex flex-wrap gap-1 text-xs">
          <button type="button" onClick={() => setF("todos")} className={`rounded-full border px-2 py-0.5 ${f === "todos" ? "bg-primary text-primary-foreground" : "border-border"}`}>Todas ({itens.length})</button>
          {STATUS.filter((s) => s.k !== "encerrado" && cont(s.k)).map((s) => <button key={s.k} type="button" onClick={() => setF(s.k)} className={`rounded-full border px-2 py-0.5 ${f === s.k ? "bg-primary text-primary-foreground" : "border-border"}`}>{s.nome} ({cont(s.k)})</button>)}
        </div>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar O.S., placa, cliente ou modelo" aria-label="Buscar O.S." className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm" />
        <ul className="max-h-[60vh] space-y-1.5 overflow-y-auto text-sm">
          {lista.map(({ g, prev }) => <li key={g.n} className="rounded border border-border p-2">
            <div className="flex flex-wrap justify-between gap-2"><b>O.S. {g.n} · {g.placa || "sem placa"}</b><span className="text-xs text-primary">{nome(g.st)}</span></div>
            <p className="text-xs text-muted-foreground">{g.cli} · {g.mod} · {g.dias} d na oficina · peças {brl(g.pec)} · serviços {brl(g.serv)}</p>
            {g.st === "pecas" && <p className="text-xs text-muted-foreground">{prev ? `Peça prevista para ${fmt(prev)}` : "Sem previsão da peça"}</p>}
          </li>)}
          {!lista.length && <li className="text-muted-foreground">Nenhuma O.S. neste filtro.</li>}
        </ul>
      </div>
    </Box>
  );
}
