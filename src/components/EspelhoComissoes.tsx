import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Box, brl, pct } from "@/components/painel-ui";
import { Button } from "@/components/ui/button";
import { ExtratoComissao } from "@/components/ExtratoComissao";
import { PERFIS, calcularComissao, dsrComissao, npsPorMarca, perfilTecnico, perfisDoLogin, somaComplementares, type Complementares, type Extrato, type Metricas, type Perfil } from "@/lib/comissoes";
import { pneusPorVendedor } from "@/lib/pecas-itens";
import type { NpsItem } from "@/lib/nps";
import { toast } from "sonner";

type L = { nome: string; servicos: number; pecas: number; margem: number };
type Tec = { nome: string; grupo: string; servicos: number; pecas: number; meta_servicos: number; meta_pecas: number };
type Gat = Record<string, Record<string, boolean>>;
type Linha = { perfil: Perfil; met: Metricas; ext: Extrato };
const OCULTOS = ["VINICIUS", "DELMIR", "LUIS SANDRO"];

/** Espelho de comissões da loja (só gestão): gatilhos manuais, RH e congelamento do mês. */
export function EspelhoComissoes({ mes, linhas }: { mes: string; tot: number; dec: number; linhas: L[] }) {
  const [tec, setTec] = useState<Tec[]>([]);
  const [nps, setNps] = useState<NpsItem[]>([]);
  const [veic, setVeic] = useState(0);
  const [gat, setGat] = useState<Gat>({});
  const [fechado, setFechado] = useState<{ at: string; linhas: { nome: string; cargo: string; fixo: number; comissao: number; dsr: number; premios: number; corte: number; total: number }[] } | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [comp, setComp] = useState<Complementares>({ porVendedor: {}, total: { ACESSORIOS: 0, ESTETICA: 0 } });
  const [pneus, setPneus] = useState<Record<string, number> | null>(null);
  const load = useCallback(async () => {
    const pi = await supabase.from("parts_items").select("itens").eq("mes", mes).maybeSingle();
    setPneus(pi.data ? pneusPorVendedor((pi.data.itens ?? []) as never) : null);
    const vc = await supabase.from("vendas_complementares").select("departamento,vendedor,valor,devolucao,status").eq("mes", mes).eq("status", "FATURADO");
    setComp(somaComplementares(vc.data ?? []));
    const [t, n, v, g] = await Promise.all([
      supabase.from("mech_month").select("nome,grupo,servicos,pecas,meta_servicos,meta_pecas").eq("mes", mes),
      supabase.from("nps_imports").select("itens").order("at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("rvd_volumes_mes").select("veiculos").eq("mes", mes),
      supabase.from("simulado_imports").select("tipo,dados").in("tipo", ["comissao", "comissao-fechado"]).eq("mes", mes),
    ]);
    setTec((t.data ?? []) as Tec[]);
    setNps(((n.data?.itens ?? []) as unknown) as NpsItem[]);
    setVeic((v.data ?? []).reduce((s, x) => s + (+x.veiculos || 0), 0));
    setGat(((g.data ?? []).find((x) => x.tipo === "comissao")?.dados ?? {}) as Gat);
    setFechado(((g.data ?? []).find((x) => x.tipo === "comissao-fechado")?.dados ?? null) as never);
  }, [mes]);
  useEffect(() => { void load(); }, [load]);

  const dsr = dsrComissao(mes);
  const rows = useMemo<Linha[]>(() => {
    const out: Linha[] = [];
    for (const l of linhas) for (const pf of perfisDoLogin(l.nome)) {
      const nd = npsPorMarca(nps.filter((x) => x.loja_padrao === "1"), mes); const npsDep = pf.segmento === "moto" ? nd.moto : nd.carro;
      const dep = pf.chave === "GEOVANA.M" ? "ACESSORIOS" : pf.chave === "MARCELA.S" ? "ESTETICA" : null;
      // Geovana/Marcela: base = total faturado do departamento (Acessórios & Estética); sem lançamentos, usa o DMS.
      const vol = dep ? (comp.total[dep] || l.servicos + l.pecas) : l.servicos + l.pecas;
      const cv = comp.porVendedor[pf.chave] ?? { ACESSORIOS: 0, ESTETICA: 0 };
      const met: Metricas = { mo: l.servicos, pecas: l.pecas, margemPct: l.pecas ? l.margem / l.pecas : null, npsBmw: npsDep, npsMini: null, pneus: pneus ? (pneus[pf.chave] ?? 0) : null, volume: vol, ticket: veic ? vol / veic : null, acessorios: dep ? 0 : cv.ACESSORIOS, ppf: dep ? 0 : cv.ESTETICA };
      out.push({ perfil: pf, met, ext: calcularComissao(pf, met, dsr, gat[pf.chave]) });
    }
    const carro = tec.filter((t) => t.grupo === "carro");
    for (const t of tec.filter((x) => x.grupo !== "outros" && !OCULTOS.some((o) => x.nome.toUpperCase().startsWith(o)))) {
      const pf = perfilTecnico(t.nome, t.grupo), met = { mo: +t.servicos, pecas: +t.pecas };
      out.push({ perfil: pf, met, ext: calcularComissao(pf, met, dsr, gat[pf.chave]) });
    }
    const fat = carro.reduce((s, t) => s + +t.servicos + +t.pecas, 0), meta = carro.reduce((s, t) => s + +t.meta_servicos + +t.meta_pecas, 0);
    const met: Metricas = { metaOficinaOk: meta ? fat >= meta : null, npsBmw: npsPorMarca(nps.filter((x) => x.loja_padrao === "1"), mes).carro };
    out.push({ perfil: PERFIS["DELMIR"]!, met, ext: calcularComissao(PERFIS["DELMIR"]!, met, 0, gat["DELMIR"]) });
    return out;
  }, [linhas, tec, nps, veic, gat, dsr, mes, comp, pneus]);

  const salvarGat = async (chave: string, id: string, v: boolean | undefined) => {
    if (fechado) { toast.error("Mês congelado. Reabra para alterar."); return; }
    const g = { ...gat, [chave]: { ...(gat[chave] ?? {}) } };
    if (v === undefined) delete g[chave]![id]; else g[chave]![id] = v;
    setGat(g);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("simulado_imports").upsert({ user_id: u.user!.id, tipo: "comissao", mes, dados: g as never, arquivo: "gatilhos", updated_at: new Date().toISOString() }, { onConflict: "user_id,tipo,mes" });
    if (error) toast.error("Não foi possível salvar.");
  };
  const resumo = (r: Linha) => ({ nome: r.perfil.nome, cargo: r.perfil.cargo, fixo: r.ext.fixo, comissao: r.ext.comissao, dsr: r.ext.dsr, premios: r.ext.premiosValidos, corte: r.ext.corteNps, total: r.ext.total });
  const congelar = async () => {
    const { data: u } = await supabase.auth.getUser();
    const dados = { at: new Date().toISOString(), linhas: rows.map(resumo) };
    const { error } = await supabase.from("simulado_imports").upsert({ user_id: u.user!.id, tipo: "comissao-fechado", mes, dados: dados as never, arquivo: "espelho", updated_at: dados.at }, { onConflict: "user_id,tipo,mes" });
    if (error) toast.error("Não foi possível congelar."); else { setFechado(dados); toast.success("Espelho do mês congelado."); }
  };
  const reabrir = async () => {
    if (!confirm("Reabrir o mês? O retrato congelado será descartado.")) return;
    await supabase.from("simulado_imports").delete().eq("tipo", "comissao-fechado").eq("mes", mes);
    setFechado(null);
  };
  const lista = fechado?.linhas ?? rows.map(resumo);
  const exportar = async () => {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.json_to_sheet(lista.map((l) => ({ Nome: l.nome, Cargo: l.cargo, Fixo: l.fixo, Comissão: +l.comissao.toFixed(2), DSR: +l.dsr.toFixed(2), Premiações: +l.premios.toFixed(2), "Corte NPS": +l.corte.toFixed(2), Total: +l.total.toFixed(2) })));
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Comissões");
    XLSX.writeFile(wb, `espelho-comissoes-${mes}.xlsx`);
  };
  const atual = rows.find((r) => r.perfil.chave === sel);
  const total = lista.reduce((s, l) => s + l.total, 0);

  return (
    <div className="grid items-start gap-3 xl:grid-cols-[1.3fr_1fr]">
      <Box title={`Espelho de comissões · DSR ${pct(dsr)} (mês seguinte)`} right={<div className="flex gap-1">
        <Button size="sm" variant="outline" onClick={() => void exportar()}>Exportar RH</Button>
        {fechado ? <Button size="sm" variant="outline" onClick={() => void reabrir()}>Reabrir mês</Button> : <Button size="sm" onClick={() => void congelar()}>Congelar mês</Button>}
      </div>}>
        {fechado && <p className="px-4 py-2 text-xs text-warning">🔒 Congelado em {new Date(fechado.at).toLocaleString("pt-BR")} — valores protegidos contra reimportações.</p>}
        <div className="overflow-x-auto text-sm"><table className="w-full">
          <thead className="text-xs text-muted-foreground"><tr className="border-b"><th className="px-3 py-2 text-left">Colaborador</th><th className="px-2 text-right">Comissão+DSR</th><th className="px-2 text-right">Premiações</th><th className="px-2 text-right">Corte NPS</th><th className="px-3 text-right">Total</th></tr></thead>
          <tbody>{lista.map((l, i) => { const k = fechado ? null : rows[i]?.perfil.chave; return (
            <tr key={`${l.nome}${i}`} onClick={() => k && setSel(k)} className={`cursor-pointer border-b border-border/40 hover:bg-muted/40 ${sel === k ? "bg-muted/60" : ""}`}>
              <td className="px-3 py-1.5"><b>{l.nome}</b> <span className="text-xs text-muted-foreground">{l.cargo}</span></td>
              <td className="px-2 text-right">{brl(l.fixo + l.comissao + l.dsr)}</td><td className="px-2 text-right">{brl(l.premios)}</td>
              <td className={`px-2 text-right ${l.corte > 0 ? "text-destructive" : "text-muted-foreground"}`}>{l.corte > 0 ? `−${brl(l.corte)}` : "—"}</td><td className="px-3 text-right font-semibold">{brl(l.total)}</td>
            </tr>); })}</tbody>
          <tfoot><tr className="font-semibold"><td className="px-3 py-2">Total da loja</td><td colSpan={3} /><td className="px-3 text-right">{brl(total)}</td></tr></tfoot>
        </table></div>
      </Box>
      <div className="space-y-3">
        {!atual && <p className="lux-card p-4 text-sm text-muted-foreground">Clique em um colaborador para ver o extrato e confirmar gatilhos manuais (PAC, vídeos, pneus etc.).</p>}
        {atual && <>
          {atual.perfil.premios.some((p) => p.tipo !== "escada") && <Box title={`Gatilhos · ${atual.perfil.nome}`}>
            <div className="divide-y text-sm">{atual.perfil.premios.filter((p) => p.tipo !== "escada").map((p) => {
              const v = gat[atual.perfil.chave]?.[p.id];
              return <div key={p.id} className="flex items-center justify-between gap-2 px-4 py-2"><span>{p.rotulo}</span><div className="flex gap-1">
                {([["Sim", true], ["Não", false], ["Auto", undefined]] as const).map(([r, b]) => <Button key={r} size="sm" variant={v === b ? "default" : "outline"} onClick={() => void salvarGat(atual.perfil.chave, p.id, b)}>{r}</Button>)}
              </div></div>;
            })}</div>
          </Box>}
          <ExtratoComissao atual={atual.ext} />
        </>}
      </div>
    </div>
  );
}
