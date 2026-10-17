import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { analisar, normalizar, foraDosAlertas, hoje, STATUS, type OsImport, type OsItem } from "@/lib/os-controle";
import { norm } from "@/components/painel-ui";
import { nomeVendedor } from "@/lib/sales-report";
import { NOTIFICATIONS_EVENT } from "@/components/Notificacoes";

type Consultor = { nome: string; department_id: string | null };
export function OsSemMudanca({ cons, deptName, abrir }: {
  cons: Consultor[]; deptName: (id: string | null) => string; abrir: () => void;
}) {
  const [imports, setImports] = useState<OsImport[]>([]);
  const [error, setError] = useState(false);
  const [judiciais, setJudiciais] = useState<Set<string>>(new Set());
  useEffect(() => {
    let active = true;
    const load = async () => {
      const [result, ac] = await Promise.all([
        supabase.from("os_imports").select("id,at,nome,arquivo,itens").order("at", { ascending: false }).limit(2),
        supabase.from("os_acompanhamento").select("os_n,acoes"),
      ]);
      if (active && !ac.error) setJudiciais(new Set((ac.data ?? []).filter(x => foraDosAlertas(x.acoes)).map(x => x.os_n)));
      if (!active) return;
      setError(Boolean(result.error));
      if (!result.error) setImports((result.data ?? []).map(i => ({ ...i, itens: normalizar(i.itens as unknown as OsItem[]) })));
    };
    const refresh = () => { void load(); };
    refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener(NOTIFICATIONS_EVENT, refresh);
    const timer = window.setInterval(refresh, 60000);
    return () => {
      active = false;
      window.removeEventListener("focus", refresh);
      window.removeEventListener(NOTIFICATIONS_EVENT, refresh);
      window.clearInterval(timer);
    };
  }, []);
  if (error) return <p role="status" className="my-4 text-sm text-destructive print:hidden">Não foi possível conferir as O.S. sem mudança.</p>;
  const anterior = imports[1];
  if (!anterior) return null;
  const paradas = (imports[0]?.itens ?? []).map(i => analisar(i, anterior, hoje())).filter(a => a.semMudanca && a.item.st !== "judicial" && !judiciais.has(a.item.n));
  if (!paradas.length) return null;
  const chave = (s: string) => norm(nomeVendedor(s)).replace(/\s+/g, "");
  return (
    <section aria-label="O.S. sem mudança de status" className="my-4 border-l-4 border-destructive bg-destructive/10 p-4 print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-semibold text-destructive"><AlertTriangle className="size-5 shrink-0" />O.S. sem mudança na atualização semanal ({paradas.length})</h2>
        <Button size="sm" variant="outline" onClick={abrir}>Ver no Controle O.S.</Button>
      </div>
      <ul className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 xl:grid-cols-3">
        {paradas.map(a => {
          const consultor = cons.find(c => chave(c.nome) === chave(a.item.cons));
          return <li key={a.item.n} className="min-w-0 break-words"><span className="font-semibold">O.S. {a.item.n} · {consultor ? deptName(consultor.department_id) : "Departamento não identificado"}</span><span className="block text-xs text-muted-foreground">{a.item.cons} · {STATUS.find(s => s.k === a.item.st)?.nome} · {a.diasStatus} dias no status</span></li>;
        })}
      </ul>
    </section>
  );
}