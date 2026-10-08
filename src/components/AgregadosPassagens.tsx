import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { norm, num } from "./painel-ui";
import { lerPassagens } from "@/lib/mecanicos";
import { registrarUpdate } from "@/lib/update-log";

type Cons = { id: string; nome: string };
const br = (d: string) => d.split("-").reverse().join("/");
const chave = (s: string) => norm(s).replace(/\s+/g, " ");

/** Importa o relatório "Passagem tecnico+consultor": cada O.S. conta uma única vez por consultor (mesmo critério dos técnicos). */
export function AgregadosPassagens({ allCons, ini, end, onDone }: { allCons: Cons[]; ini: string; end: string; onDone: () => void }) {
  const [prev, setPrev] = useState<{ nome: string; passagens: number; id: string | undefined }[] | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const abrir = async (f: File | undefined) => {
    if (!f) return;
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await f.arrayBuffer(), { type: "array" });
      const raw = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]!]!, { header: 1, raw: true, defval: "" });
      const r = lerPassagens(raw);
      const map = new Map(allCons.map((c) => [chave(c.nome), c.id]));
      setPrev(r.consultores.map((c) => ({ ...c, id: map.get(chave(c.nome)) })));
      setMsg("");
    } catch (e) { setPrev(null); setMsg((e as Error).message); }
  };

  const salvar = async () => {
    if (!prev) return;
    const ok = prev.filter((p) => p.id);
    setBusy(true);
    const ids = ok.map((p) => p.id!);
    const del = await supabase.from("agg_visits").delete().in("consultant_id", ids).gte("dia", ini).lte("dia", end);
    if (del.error) { setBusy(false); setMsg("Erro: " + del.error.message); return; }
    const up = await supabase.from("agg_visits").insert(ok.map((p) => ({ consultant_id: p.id!, dia: end, passagens: p.passagens })));
    setBusy(false);
    if (up.error) { setMsg("Erro: " + up.error.message); return; }
    await registrarUpdate("Passagens agregados (importação)");
    setMsg(`Passagens importadas para ${ok.length} consultores (${br(ini)} a ${br(end)}). O.S. repetidas contadas uma única vez; o mês foi substituído, sem somar.${prev.length > ok.length ? ` ${prev.length - ok.length} não cadastrados foram ignorados.` : ""}`);
    setPrev(null);
    onDone();
  };

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-6">
      <div>
        <h3 className="font-semibold">Importar passagens por vendedor</h3>
        <p className="text-sm text-muted-foreground">Use o mesmo relatório "Passagem tecnico+consultor" da aba Técnicos. Cada O.S. conta uma única vez por consultor, mesmo que apareça em várias linhas. Substitui as passagens do mês dos consultores do relatório.</p>
      </div>
      <label className="inline-block cursor-pointer rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
        Escolher arquivo de passagens
        <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { abrir(e.target.files?.[0]); e.target.value = ""; }} />
      </label>
      {prev && (
        <div className="space-y-3">
          <table className="w-full max-w-md text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground"><tr><th className="py-1">Consultor</th><th className="text-right">Passagens</th></tr></thead>
            <tbody>
              {prev.map((p) => (
                <tr key={p.nome} className="border-t border-border">
                  <td className="py-1">{p.nome}{!p.id && <span className="ml-2 text-xs text-muted-foreground">(não cadastrado — ignorado)</span>}</td>
                  <td className="text-right">{num(p.passagens)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button disabled={busy || !prev.some((p) => p.id)} onClick={salvar} className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50">Confirmar passagens</button>
        </div>
      )}
      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
    </section>
  );
}
