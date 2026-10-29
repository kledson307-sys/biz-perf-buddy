import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/components/painel-ui";

type Dev = { id: string; consultant_id: string; valor: number; motivo: string | null; nf: string | null };

/** Ajuste manual de devoluções de peças: abatido do faturamento bruto para gerar o líquido de metas/ranking. */
export function Devolucoes({ mes, cons, onChange }: { mes: string; cons: { id: string; nome: string }[]; onChange: () => void }) {
  const [rows, setRows] = useState<Dev[]>([]);
  const [f, setF] = useState({ cid: "", valor: "", motivo: "", nf: "" });
  const [erro, setErro] = useState("");
  const load = useCallback(async () => {
    const r = await supabase.from("parts_returns").select("id,consultant_id,valor,motivo,nf").eq("mes", mes).order("created_at");
    setRows((r.data ?? []).map((x) => ({ ...x, valor: +x.valor })));
  }, [mes]);
  useEffect(() => { load(); }, [load]);
  const nome = (id: string) => cons.find((c) => c.id === id)?.nome ?? "—";
  const add = async () => {
    const v = Number(f.valor.replace(",", "."));
    if (!f.cid || !(v > 0)) { setErro("Escolha o consultor e informe um valor maior que zero."); return; }
    const r = await supabase.from("parts_returns").insert({ mes, consultant_id: f.cid, valor: v, motivo: f.motivo || null, nf: f.nf || null });
    if (r.error) { setErro("Não foi possível salvar: " + r.error.message); return; }
    setErro(""); setF({ cid: "", valor: "", motivo: "", nf: "" }); load(); onChange();
  };
  const del = async (id: string) => { await supabase.from("parts_returns").delete().eq("id", id); load(); onChange(); };
  const total = rows.reduce((a, r) => a + r.valor, 0);
  const inp = "rounded-md border border-border bg-background px-2 py-1.5 text-sm";
  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">Valores abatidos das peças do consultor no mês (faturamento líquido usado em metas, projeções e ranking).</p>
      <div className="flex flex-wrap gap-2">
        <select className={inp} value={f.cid} onChange={(e) => setF({ ...f, cid: e.target.value })}>
          <option value="">Consultor…</option>
          {cons.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <input className={`${inp} w-28`} placeholder="Valor R$" value={f.valor} onChange={(e) => setF({ ...f, valor: e.target.value })} />
        <input className={`${inp} w-28`} placeholder="NF" value={f.nf} onChange={(e) => setF({ ...f, nf: e.target.value })} />
        <input className={`${inp} flex-1 min-w-40`} placeholder="Motivo" value={f.motivo} onChange={(e) => setF({ ...f, motivo: e.target.value })} />
        <button onClick={add} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">Lançar</button>
      </div>
      {erro && <p className="text-xs text-destructive">{erro}</p>}
      {rows.length > 0 && (
        <table className="w-full text-sm">
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="py-1.5">{nome(r.consultant_id)}</td><td>{r.nf ?? "—"}</td><td className="text-muted-foreground">{r.motivo ?? ""}</td>
                <td className="text-right">{brl(r.valor)}</td>
                <td className="text-right"><button onClick={() => del(r.id)} className="text-xs text-destructive">remover</button></td>
              </tr>
            ))}
            <tr className="border-t border-border font-semibold"><td colSpan={3} className="py-1.5">Total devolvido</td><td className="text-right">{brl(total)}</td><td /></tr>
          </tbody>
        </table>
      )}
    </div>
  );
}
