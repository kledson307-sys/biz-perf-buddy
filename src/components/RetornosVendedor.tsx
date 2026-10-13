import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { analisar, fmt, hoje, retornoDevido, type OsItem } from "@/lib/os-controle";

type Dados = { itens: OsItem[]; acomp: { os_n: string; prev_manual: string | null }[]; retornos: { os_n: string; data_ref: string }[] };

/** Alertas de retorno ao cliente para o vendedor logado; somem quando ele marca como feito. */
export function RetornosVendedor() {
  const [d, setD] = useState<Dados | null>(null);
  const [notas, setNotas] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const load = async () => {
    const { data, error } = await supabase.rpc("minhas_os");
    if (error) { setMsg(error.message); return; }
    setD((data as unknown as Dados) ?? null);
  };
  useEffect(() => { void load(); }, []);
  if (!d) return msg ? <p className="text-sm text-destructive">{msg}</p> : null;

  const ref = hoje();
  const pend = d.itens.map(i => {
    const due = retornoDevido(i, ref);
    if (!due || d.retornos.some(r => r.os_n === i.n && r.data_ref >= due)) return null;
    const a = analisar(i, undefined, ref, d.acomp.find(x => x.os_n === i.n)?.prev_manual);
    return { i, due, prev: a.prev };
  }).filter(Boolean) as { i: OsItem; due: string; prev: string | null }[];
  if (!pend.length) return null;

  const feito = async (n: string, due: string) => {
    const nota = (notas[n] ?? "").trim();
    if (!nota) { setMsg("Escreva o que foi dito ao cliente antes de marcar como feito."); return; }
    const { error } = await supabase.rpc("registrar_retorno", { p_os: n, p_data: due, p_nota: nota });
    if (error) setMsg(error.message); else { setMsg(""); await load(); }
  };

  return (
    <div className="update-alert space-y-3 rounded-lg border-2 border-destructive bg-destructive/10 p-4">
      <div className="flex items-center gap-2 font-semibold text-destructive"><BellRing className="size-5" />Retorno ao cliente hoje ({pend.length})</div>
      {pend.map(({ i, due, prev }) => <div key={i.n} className="space-y-2 rounded border border-border bg-card p-3 text-sm">
        <div><b>O.S. {i.n}</b> · {i.cli} · {i.mod} {i.placa}</div>
        <div className="text-xs text-muted-foreground">{i.st === "diag" ? "Em diagnóstico há mais de 7 dias sem mudança" : "Aguardando peça"} · retorno previsto em {fmt(due)}{i.st === "pecas" ? ` · ${prev ? `peça prevista para ${fmt(prev)}` : "sem previsão da peça"}` : ""}</div>
        <textarea rows={2} value={notas[i.n] ?? ""} onChange={e => setNotas(p => ({ ...p, [i.n]: e.target.value }))} placeholder="O que foi dito ao cliente (canal, prazo do diagnóstico/peça informado)…"
          aria-label={`Retorno O.S. ${i.n}`} className="block w-full rounded border border-input bg-background px-2 py-1 text-sm" />
        <Button size="sm" onClick={() => void feito(i.n, due)}>Marcar como feito</Button>
      </div>)}
      {msg && <p className="text-sm text-destructive">{msg}</p>}
    </div>
  );
}
