import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { brl, norm, parseNum } from "@/components/painel-ui";
import { GRUPO_NOME, grupoDe, ocultoDaLista, type Grupo } from "@/lib/mecanicos";
import { registrarUpdate } from "@/lib/update-log";

type Row = { id?: string; nome: string; grupo: Grupo; servicos: number; pecas: number; passagens: number; meta_servicos: number; meta_pecas: number };
const asGrupo = (v: string): Grupo => (v === "carro" || v === "moto" ? v : "outros");

/** Metas mensais dos técnicos — lançadas aqui em Configurar; a aba Técnicos só exibe. */
export function TecnicosMetas({ mes }: { mes: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [ed, setEd] = useState<Record<string, { s: string; p: string }>>({});
  const [lote, setLote] = useState<{ grupo: Grupo; s: string; p: string }>({ grupo: "carro", s: "", p: "" });
  const [novo, setNovo] = useState("");
  const [grupoNovo, setGrupoNovo] = useState<Grupo>("carro");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data, error } = await supabase.from("mech_month").select("id,nome,grupo,servicos,pecas,passagens,meta_servicos,meta_pecas").eq("mes", mes).order("nome");
    if (error) { setMsg(error.message); return; }
    const lst = (data ?? []).map(r => ({ ...r, grupo: asGrupo(r.grupo) })).filter(r => !ocultoDaLista(r.nome));
    setRows(lst);
    setEd(Object.fromEntries(lst.map(r => [r.nome, { s: r.meta_servicos ? String(r.meta_servicos) : "", p: r.meta_pecas ? String(r.meta_pecas) : "" }])));
  };
  useEffect(() => { void load(); }, [mes]);

  const gravar = async (lst: Row[], origem: string) => {
    setBusy(true);
    const { error } = await supabase.from("mech_month").upsert(lst.map(({ id: _i, ...r }) => ({ ...r, mes, updated_at: new Date().toISOString() })), { onConflict: "user_id,mes,nome" });
    setBusy(false);
    if (error) { setMsg("Erro ao salvar: " + error.message); return false; }
    await registrarUpdate(origem, mes); await load();
    window.dispatchEvent(new Event("tecnicos-atualizados"));
    return true;
  };

  const salvarUm = (r: Row) => {
    const e = ed[r.nome]; if (!e) return;
    const s = parseNum(e.s), p = parseNum(e.p);
    if (s !== r.meta_servicos || p !== r.meta_pecas) void gravar([{ ...r, meta_servicos: s, meta_pecas: p }], "Técnicos (metas)");
  };

  const [confirmar, setConfirmar] = useState(false);
  const aplicarLote = async () => {
    const alvo = rows.filter(r => r.grupo === lote.grupo);
    if (!alvo.length) { setMsg("Nenhum técnico nesse grupo."); return; }
    const s = lote.s.trim() ? parseNum(lote.s) : null, p = lote.p.trim() ? parseNum(lote.p) : null;
    if (s === null && p === null) { setMsg("Informe a meta de serviços e/ou de peças."); return; }
    if (!confirmar) {
      setConfirmar(true);
      setMsg(`Clique em "Confirmar" para aplicar a ${alvo.length} técnicos (${GRUPO_NOME[lote.grupo]}).${s !== null ? ` Serviços ${brl(s)}.` : ""}${p !== null ? ` Peças ${brl(p)}.` : ""}`);
      return;
    }
    setConfirmar(false);
    if (await gravar(alvo.map(r => ({ ...r, ...(s !== null ? { meta_servicos: s } : {}), ...(p !== null ? { meta_pecas: p } : {}) })), "Técnicos (metas em lote)")) {
      setMsg(`Metas aplicadas a ${alvo.length} técnicos.`); setLote({ ...lote, s: "", p: "" });
    }
  };

  const adicionar = async () => {
    const nome = novo.trim().toUpperCase();
    if (!nome || rows.some(r => norm(r.nome) === norm(nome))) return;
    if (await gravar([{ nome, grupo: grupoNovo === "outros" ? grupoDe(nome) : grupoNovo, servicos: 0, pecas: 0, passagens: 0, meta_servicos: 0, meta_pecas: 0 }], "Técnicos (cadastro)")) setNovo("");
  };

  const inp = "w-full rounded border border-input bg-background px-2 py-1";
  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-6">
      <h2 className="text-lg font-semibold">Técnicos e metas de {mes}</h2>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Metas em lote:</span>
        <select value={lote.grupo} onChange={e => setLote({ ...lote, grupo: e.target.value as Grupo })} className="rounded-lg border border-input bg-background px-2 py-2">
          <option value="carro">Carro</option><option value="moto">Moto</option>
        </select>
        <input value={lote.s} onChange={e => setLote({ ...lote, s: e.target.value })} placeholder="Meta serviços" inputMode="decimal" className="w-32 rounded-lg border border-input bg-background px-3 py-2" />
        <input value={lote.p} onChange={e => setLote({ ...lote, p: e.target.value })} placeholder="Meta peças" inputMode="decimal" className="w-32 rounded-lg border border-input bg-background px-3 py-2" />
        <Button onClick={aplicarLote} disabled={busy}>{confirmar ? "Confirmar" : "Aplicar"}</Button>
        {confirmar && <Button variant="outline" onClick={() => { setConfirmar(false); setMsg(""); }}>Cancelar</Button>}
      </div>
      {(["carro", "moto", "outros"] as const).map(g => {
        const lst = rows.filter(r => r.grupo === g);
        if (!lst.length) return null;
        return (
          <div key={g}>
            <p className="mt-2 text-xs font-semibold uppercase text-muted-foreground">{GRUPO_NOME[g]}</p>
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground"><tr><th className="py-2">Técnico</th><th>Meta Serviços</th><th>Meta Peças</th></tr></thead>
              <tbody>
                {lst.map(r => {
                  const e = ed[r.nome] ?? { s: "", p: "" };
                  return (
                    <tr key={r.nome} className="border-t border-border">
                      <td className="py-2 pr-2 font-medium">{r.nome}</td>
                      <td className="pr-2"><input inputMode="decimal" value={e.s} disabled={busy} onChange={x => setEd({ ...ed, [r.nome]: { ...e, s: x.target.value } })} onBlur={() => salvarUm(r)} className={inp} /></td>
                      <td className="pr-2"><input inputMode="decimal" value={e.p} disabled={busy} onChange={x => setEd({ ...ed, [r.nome]: { ...e, p: x.target.value } })} onBlur={() => salvarUm(r)} className={inp} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
      {!rows.length && <p className="text-sm text-muted-foreground">Nenhum técnico neste mês. Importe o faturamento na aba Técnicos ou adicione abaixo.</p>}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <input value={novo} onChange={e => setNovo(e.target.value)} placeholder="Novo técnico" className="rounded-lg border border-input bg-background px-3 py-2" />
        <select value={grupoNovo} onChange={e => setGrupoNovo(e.target.value as Grupo)} className="rounded-lg border border-input bg-background px-2 py-2">
          <option value="carro">Carro</option><option value="moto">Moto</option>
        </select>
        <Button variant="outline" disabled={!novo.trim() || busy} onClick={adicionar}>Adicionar técnico</Button>
      </div>
      {msg && <p role="status" className="text-sm">{msg}</p>}
      <p className="text-xs text-muted-foreground">As metas são salvas ao sair do campo e valem para o mês selecionado no topo. Técnicos de diagnóstico não têm meta.</p>
    </section>
  );
}
