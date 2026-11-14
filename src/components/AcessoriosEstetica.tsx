import { useCallback, useEffect, useMemo, useState } from "react";
import { SyncPlanilhas } from "@/components/SyncPlanilhas";
import { supabase } from "@/integrations/supabase/client";
import { Box, brl, div, pct, tone, uni, parseNum } from "@/components/painel-ui";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ehEncerrado } from "@/lib/os-controle";
import {
  CANAIS, CHASE, DEPTO_DMS, MARGEM_IDEAL, SEGMENTOS, STATUS_LABEL, diferencaRvd, estagnada, folhaComissao, parseRvd, possiveisDuplicadas, chaveDuplicada, statusConciliado, casarVendedor, radarDia, type LinhaRvd,
  type Depto, type StatusVenda, type VendaC,
  targetTicket,
} from "@/lib/acessorios-estetica";

type Venda = VendaC & { id: string; cliente: string; placa: string; produto: string; os_n: string; dia: string; mes: string; created_at?: string; criado_por?: string };
type Vend = { id: string; nome: string; segmento: string; canal: string; ativo: boolean };
type Vol = { vendedor: string; veiculos: number; target: number; atualizado_por: string; updated_at: string };
type Dms = Record<Depto, { fat: number; margem: number; meta: number }>;

const sel = "h-8 rounded-md border border-border bg-background px-2 text-xs";
const hojeBahia = () => new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);

export function AcessoriosEstetica({ mes, tot, dec, restrito }: { mes: string; tot: number; dec: number; restrito?: Depto }) {
  const [sub, setSub] = useState<Depto | "CONSOLIDADO">(restrito ?? "ACESSORIOS");
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [vends, setVends] = useState<Vend[]>([]);
  const [vols, setVols] = useState<Vol[]>([]);
  const [dms, setDms] = useState<Dms>({ ACESSORIOS: { fat: 0, margem: 0, meta: 0 }, ESTETICA: { fat: 0, margem: 0, meta: 0 } });

  const load = useCallback(async () => {
    const [v, s, vo, rp] = await Promise.all([
      supabase.from("vendas_complementares").select("*").eq("mes", mes).order("dia", { ascending: false }),
      supabase.from("vendedores_showroom").select("*").order("nome"),
      supabase.from("rvd_volumes_mes").select("*").eq("mes", mes),
      supabase.rpc("dep_painel", { p_mes: mes }),
    ]);
    const P = (rp.data ?? {}) as { dms?: Partial<Dms>; abertas?: string[]; faturadas?: string[] };
    let lista = (v.data ?? []) as unknown as Venda[];
    // Conciliação automática com Controle O.S.
    const abertas = P.abertas ?? [], faturadas = P.faturadas ?? [];
    const mudar = lista.map((x) => ({ x, novo: statusConciliado(x, abertas, faturadas) })).filter(({ x, novo }) => novo !== x.status);
    for (const { x, novo } of mudar) await supabase.from("vendas_complementares").update({ status: novo }).eq("id", x.id);
    if (mudar.length) lista = lista.map((x) => ({ ...x, status: mudar.find((c) => c.x.id === x.id)?.novo ?? x.status }));
    setVendas(lista); setVends((s.data ?? []) as Vend[]); setVols((vo.data ?? []) as Vol[]);
    const z = { fat: 0, margem: 0, meta: 0 };
    const out: Dms = { ACESSORIOS: { ...z, ...P.dms?.ACESSORIOS }, ESTETICA: { ...z, ...P.dms?.ESTETICA } };
    setDms(out);
  }, [mes]);
  useEffect(() => { void load(); }, [load]);

  const subs: [typeof sub, string][] = [["ACESSORIOS", "Acessórios · Geovana"], ["ESTETICA", "Estética · Marcela"], ["CONSOLIDADO", "Consolidado"]];
  return (
    <div className="space-y-3">
      {!restrito && <SyncPlanilhas fontes={["acessorios", "estetica"]} compacto />}
      {!restrito && <Radar vendas={vendas} vols={vols} />}
      {!restrito && <div className="flex flex-wrap gap-1">
        {subs.map(([k, l]) => <button key={k} type="button" onClick={() => setSub(k)} className={`rounded-md border px-3 py-1.5 text-xs font-semibold ${sub === k ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"}`}>{l}</button>)}
      </div>}
      {sub === "CONSOLIDADO"
        ? <Consolidado vendas={vendas} dms={dms} tot={tot} dec={dec} />
        : <Departamento key={sub} depto={sub} mes={mes} tot={tot} dec={dec} vendas={vendas.filter((v) => v.departamento === sub)} vends={vends} vols={vols} dms={dms[sub]} reload={load} />}
    </div>
  );
}

function kpis(vendas: VendaC[], d: { fat: number; margem: number; meta: number }, tot: number, dec: number) {
  const aFaturar = vendas.filter((v) => v.status === "A_FATURAR" || v.status === "OS_ABERTA").reduce((s, v) => s + v.valor, 0);
  const proj = d.fat + aFaturar;
  const rest = Math.max(tot - dec, 0);
  return { aFaturar, proj, p: div(proj, d.meta), nec: rest ? Math.max(d.meta - proj, 0) / rest : 0 };
}

function Faixa({ depto, d, vendas, tot, dec }: { depto: Depto; d: { fat: number; margem: number; meta: number }; vendas: VendaC[]; tot: number; dec: number }) {
  const k = kpis(vendas, d, tot, dec);
  const mg = div(d.margem, d.fat); const ideal = MARGEM_IDEAL[depto];
  const cards: [string, string, string, string?][] = [
    ["Faturado (DMS)", brl(d.fat), `Departamento ${DEPTO_DMS[depto]}`],
    ["A faturar", brl(k.aFaturar), "Lançamentos ainda não faturados"],
    ["Projeção do mês", brl(k.proj), "Faturado + a faturar", tone(k.p)],
    ["Meta do mês", d.meta ? pct(k.p) : "—", d.meta ? `Meta ${brl(d.meta)}` : "Cadastre a meta em Metas", tone(k.p)],
    ["Margem", d.fat ? pct(mg) : "—", `Ideal ${pct(ideal)}`, mg >= ideal ? "text-success" : mg >= ideal * 0.85 ? "text-warning" : "text-destructive"],
    ["Necessidade diária", brl(k.nec), `${Math.max(tot - dec, 0)} dia(s) restantes`],
  ];
  return <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
    {cards.map(([l, v, s, c]) => <div key={l} className="lux-card px-3 py-2"><p className="text-[11px] uppercase text-muted-foreground">{l}</p><p className={`text-lg font-bold ${c ?? ""}`}>{v}</p><p className="text-[11px] text-muted-foreground">{s}</p></div>)}
  </div>;
}

function Departamento({ depto, mes, tot, dec, vendas, vends, vols, dms, reload }: { depto: Depto; mes: string; tot: number; dec: number; vendas: Venda[]; vends: Vend[]; vols: Vol[]; dms: Dms[Depto]; reload: () => void }) {
  const est = depto === "ESTETICA";
  const vazio = { cliente: "", placa: "", vendedor: "", segmento: "CARRO", canal: "NOVO", produto: "", valor: "", premiacao: "", os_n: "", obsoleto: false, dia: hojeBahia() };
  const [f, setF] = useState(vazio);
  const [aba, setAba] = useState<"vendas" | "rvd" | "comissao" | "vendedores">("vendas");
  const hoje = hojeBahia();

  const escolherVendedor = (nome: string) => { const x = vends.find((v) => v.nome === nome); setF({ ...f, vendedor: nome, segmento: x?.segmento ?? f.segmento, canal: x?.canal ?? f.canal }); };
  const escolherProduto = (nome: string) => { const p = CHASE.find((c) => c.nome === nome); setF({ ...f, produto: nome, valor: p ? String(p.valor) : f.valor, premiacao: p ? String(p.premio) : f.premiacao }); };

  const salvar = async () => {
    const valor = parseNum(f.valor);
    if (!f.cliente.trim() || !f.vendedor || !valor) { toast.error("Informe cliente, vendedor e valor"); return; }
    const nova = { departamento: depto, cliente: f.cliente, vendedor: f.vendedor, valor, os_n: f.os_n, produto: f.produto, canal: f.canal, segmento: f.segmento, premiacao: 0, devolucao: 0, obsoleto: false, status: "A_FATURAR" } as VendaC;
    const dup = vendas.find((x) => x.status !== "CANCELADO" && chaveDuplicada(nova, x));
    if (dup && !confirm(`Possível venda duplicada: ${dup.cliente} · ${dup.vendedor} · ${brl(dup.valor)} lançada em ${dup.dia.slice(8, 10)}/${dup.dia.slice(5, 7)}${dup.os_n ? ` (O.S. ${dup.os_n})` : ""}.\n\nLançar mesmo assim?`)) return;
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("vendas_complementares").insert({
      mes, dia: f.dia, departamento: depto, cliente: f.cliente.trim().toUpperCase(), placa: f.placa.trim().toUpperCase(), vendedor: f.vendedor,
      segmento: f.segmento, canal: f.canal, produto: f.produto, valor, premiacao: est ? parseNum(f.premiacao) : 0, obsoleto: !est && f.obsoleto,
      os_n: f.os_n.trim(), status: "A_FATURAR", criado_por: u.user?.email ?? "",
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Venda lançada"); setF({ ...vazio, vendedor: f.vendedor, segmento: f.segmento, canal: f.canal }); reload();
  };
  const atualizar = async (id: string, patch: { os_n?: string; status?: string }) => { const { error } = await supabase.from("vendas_complementares").update(patch).eq("id", id); if (error) toast.error(error.message); else reload(); };
  const excluir = async (id: string) => { if (!confirm("Excluir esta venda?")) return; await supabase.from("vendas_complementares").delete().eq("id", id); reload(); };

  const abas: [typeof aba, string][] = [["vendas", "Vendas & carteira"], ["rvd", "Matriz RVD"], ["comissao", est ? "Premiação RH" : "Comissão RH"]];
  const paradas = vendas.filter((v) => estagnada(v, hoje)).length;
  const dups = useMemo(() => possiveisDuplicadas(vendas), [vendas]);

  return <div className="space-y-3">
    <Faixa depto={depto} d={dms} vendas={vendas} tot={tot} dec={dec} />
    {dups.size > 0 && <p className="rounded-md border border-destructive px-3 py-1.5 text-xs text-destructive">🔎 Revisor: {dups.size} venda(s) parecem duplicadas na planilha online (marcadas com ⚠). Corrija na planilha de origem.</p>}
    {paradas > 0 && <p className="rounded-md border border-warning px-3 py-1.5 text-xs text-warning">⚠️ {paradas} venda(s) a faturar há mais de 15 dias sem O.S. aberta.</p>}
    <div className="flex flex-wrap gap-1">{abas.map(([k, l]) => <button key={k} type="button" onClick={() => setAba(k)} className={`rounded-md px-2.5 py-1 text-xs ${aba === k ? "bg-muted font-semibold" : "text-muted-foreground hover:bg-muted"}`}>{l}</button>)}</div>

    {aba === "vendas" && <div className="grid items-start gap-3">
      <Box title={`Carteira do mês · ${vendas.length} venda(s)`} fit="xl:max-h-[calc(100vh-22rem)]">
        <div className="overflow-x-auto"><table className="w-full text-xs">
          <thead><tr className="text-left text-muted-foreground"><th className="py-1">Data</th><th>Cliente</th><th>Vendedor</th><th>Canal</th><th>{est ? "Produto" : "Itens"}</th><th className="text-right">Valor</th><th className="pl-3">O.S.</th><th>Status</th></tr></thead>
          <tbody>{vendas.map((v) => <tr key={v.id} className={`border-t border-border ${estagnada(v, hoje) ? "text-warning" : ""}`}>
            <td className="py-1">{v.dia.slice(8, 10)}/{v.dia.slice(5, 7)}</td><td>{dups.has(v.id) && <span title="Possível duplicada" className="mr-1 text-destructive">⚠</span>}{v.cliente}</td><td>{v.vendedor}</td><td>{v.canal} · {v.segmento}</td><td>{v.produto}{v.obsoleto ? " (obsoleto)" : ""}</td>
            <td className="text-right">{brl(v.valor)}</td>
            <td className="pl-3">{v.os_n || "—"}</td>
            <td>{STATUS_LABEL[v.status as StatusVenda] ?? v.status}</td>
          </tr>)}</tbody>
        </table></div>
        <p className="mt-2 text-[11px] text-muted-foreground">Somente leitura: os dados vêm da planilha online. O status muda sozinho: O.S. no Controle O.S. → "O.S. aberta"; O.S. encerrada pelo faturamento → "Faturado".</p>
      </Box>
    </div>}
    {aba === "rvd" && <MatrizRvd mes={mes} vendas={vendas} vends={vends} vols={vols} reload={reload} />}
    {aba === "comissao" && <Comissao depto={depto} mes={mes} vendas={vendas} />}
  </div>;
}

function MatrizRvd({ mes, vendas, vends, vols, reload }: { mes: string; vendas: Venda[]; vends: Vend[]; vols: Vol[]; reload: () => void }) {
  const grupos = CANAIS.flatMap((c) => SEGMENTOS.map((s) => [c, s] as const));
  return <div className="grid gap-3 xl:grid-cols-2">
    {grupos.map(([c, s]) => {
      const daPlanilha = new Set(vols.map((x) => x.vendedor));
      const lista = vends.filter((v) => v.ativo && v.canal === c && v.segmento === s && (!vols.length || daPlanilha.has(v.nome)));
      if (!lista.length) return null;
      return <Box key={c + s} title={`${c} · ${s}`}>
        <table className="w-full text-xs"><thead><tr className="text-left text-muted-foreground"><th>Vendedor</th><th className="text-right">Faturado</th><th className="text-right">A faturar</th><th className="text-right">Veículos</th><th className="text-right">Ticket</th><th className="text-right">Target</th><th className="text-right">Oportunidade</th></tr></thead>
          <tbody>{lista.map((v) => {
            const vs = vendas.filter((x) => x.vendedor === v.nome && x.status !== "CANCELADO");
            const fat = vs.filter((x) => x.status === "FATURADO").reduce((a, x) => a + x.valor, 0);
            const af = vs.filter((x) => x.status !== "FATURADO").reduce((a, x) => a + x.valor, 0);
            const vol = vols.find((x) => x.vendedor === v.nome);
            const n = vol?.veiculos ?? 0; const tk = div(fat + af, n); const tg = targetTicket(v.canal, v.segmento);
            return <tr key={v.id} className="border-t border-border">
              <td className="py-1">{v.nome}</td><td className="text-right">{brl(fat)}</td><td className="text-right">{brl(af)}</td>
              <td className="text-right">{n}</td>
              <td className="text-right">{n ? brl(tk) : "—"}</td>
              <td className="text-right">{tg ? brl(tg) : "—"}</td>
              <td className={`text-right ${tg && n ? (tk >= tg ? "text-success" : "text-destructive") : ""}`}>{tg && n ? brl((tg - tk) * n * -1) : "—"}</td>
            </tr>;
          })}</tbody></table>
      </Box>;
    })}
    {!vends.length && <p className="text-xs text-muted-foreground">Cadastre os vendedores para montar a matriz.</p>}
    <p className="text-[11px] text-muted-foreground xl:col-span-2">Somente leitura: vendedores e veículos vêm da planilha RVD online; target de ticket fixo por canal (Novo Carro 8.000 · Novo Moto 4.500 · Seminovo Carro 2.000 · Seminovo Moto 1.000 · Oficina 300). Ticket = (faturado + a faturar) ÷ veículos. Oportunidade negativa = quanto falta para o target.</p>
  </div>;
}

function Comissao({ depto, mes, vendas }: { depto: Depto; mes: string; vendas: Venda[] }) {
  const est = depto === "ESTETICA";
  const linhas = useMemo(() => folhaComissao(vendas, depto), [vendas, depto]);
  const total = linhas.reduce((s, l) => s + l.total, 0);
  const exportar = async () => {
    const XLSX = await import("xlsx");
    const rows = est
      ? linhas.map((l) => ({ Vendedor: l.vendedor, Itens: l.itens, "Faturado (R$)": l.faturado, "Devolução (R$)": l.devolucao, "Premiação (R$)": l.total }))
      : linhas.map((l) => ({ Canal: l.canal, Vendedor: l.vendedor, "Faturado (R$)": l.faturado, "Devolução (R$)": l.devolucao, "Produção líquida (R$)": l.producao, "% comissão": l.pct, "Comissão (R$)": l.comissao, "Obsoleto (R$)": l.obsoleto, "Comissão obsoleto 2% (R$)": l.comObsoleto, "Total a pagar (R$)": l.total }));
    const det = vendas.filter((v) => v.status === "FATURADO").map((v) => ({ Data: v.dia, Vendedor: v.vendedor, Cliente: v.cliente, "O.S.": v.os_n, [est ? "Produto" : "Itens"]: v.produto, "Valor (R$)": v.valor, ...(est ? { "Premiação (R$)": v.premiacao } : { Obsoleto: v.obsoleto ? "Sim" : "Não" }) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([...rows, est ? { Vendedor: "TOTAL", "Premiação (R$)": total } : { Vendedor: "TOTAL", "Total a pagar (R$)": total }]), est ? "Premiação" : "Comissão");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(det), "Detalhe por venda");
    XLSX.writeFile(wb, `${est ? "premiacao-estetica" : "comissao-acessorios"}-${mes}.xlsx`);
  };
  return <Box title={est ? `Premiação Estética (Chase) · ${mes}` : `Comissão Acessórios · ${mes}`} right={<Button size="sm" variant="outline" onClick={exportar} disabled={!linhas.length}>Exportar para o RH</Button>}>
    <table className="w-full text-xs"><thead><tr className="text-left text-muted-foreground">{!est && <th>Canal</th>}<th>Vendedor</th><th className="text-right">Itens</th><th className="text-right">Faturado</th><th className="text-right">Devolução</th>{!est && <><th className="text-right">Produção</th><th className="text-right">%</th><th className="text-right">Comissão</th><th className="text-right">Obsoleto 2%</th></>}<th className="text-right">Total a pagar</th></tr></thead>
      <tbody>{linhas.map((l) => <tr key={l.vendedor + l.canal} className="border-t border-border">{!est && <td className="py-1">{l.canal === "OFICINA" ? "PÓS-VENDAS" : l.canal}</td>}<td className="py-1">{l.vendedor}</td><td className="text-right">{uni(l.itens)}</td><td className="text-right">{brl(l.faturado)}</td><td className="text-right">{brl(l.devolucao)}</td>{!est && <><td className="text-right">{brl(l.producao)}</td><td className="text-right">{pct(l.pct)}</td><td className="text-right">{brl(l.comissao)}</td><td className="text-right">{brl(l.comObsoleto)}</td></>}<td className="text-right font-semibold">{l.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td></tr>)}
        <tr className="border-t border-border font-bold"><td colSpan={est ? 4 : 8} className="py-1">Total</td><td className="text-right">{total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td></tr></tbody></table>
    <p className="mt-2 text-[11px] text-muted-foreground">{est ? "Premiação fixa por produto da tabela Chase Auto Care (inclui PPF). Só vendas faturadas." : "Showroom: até R$ 30 mil 3% · até R$ 45 mil 4% · acima 5% (sobre produção líquida). Pós-vendas 3%. Obsoleto 2%. Só vendas faturadas."}</p>
  </Box>;
}

function Consolidado({ vendas, dms, tot, dec }: { vendas: Venda[]; dms: Dms; tot: number; dec: number }) {
  const ds: Depto[] = ["ACESSORIOS", "ESTETICA"];
  const r = ds.map((d) => ({ d, ...kpis(vendas.filter((v) => v.departamento === d), dms[d], tot, dec), ...dms[d], com: folhaComissao(vendas, d).reduce((s, l) => s + l.total, 0) }));
  const soma = r.reduce((a, x) => ({ fat: a.fat + x.fat, af: a.af + x.aFaturar, proj: a.proj + x.proj, meta: a.meta + x.meta, com: a.com + x.com }), { fat: 0, af: 0, proj: 0, meta: 0, com: 0 });
  return <Box title="Consolidado Acessórios + Estética">
    <table className="w-full text-sm"><thead><tr className="text-left text-xs text-muted-foreground"><th>Frente</th><th className="text-right">Faturado</th><th className="text-right">A faturar</th><th className="text-right">Projeção</th><th className="text-right">Meta</th><th className="text-right">% proj.</th><th className="text-right">Comissões</th></tr></thead>
      <tbody>{r.map((x) => <tr key={x.d} className="border-t border-border"><td className="py-1.5">{x.d === "ACESSORIOS" ? "Acessórios · Geovana" : "Estética · Marcela"}</td><td className="text-right">{brl(x.fat)}</td><td className="text-right">{brl(x.aFaturar)}</td><td className="text-right">{brl(x.proj)}</td><td className="text-right">{brl(x.meta)}</td><td className={`text-right ${tone(x.p)}`}>{x.meta ? pct(x.p) : "—"}</td><td className="text-right">{brl(x.com)}</td></tr>)}
        <tr className="border-t border-border font-bold"><td className="py-1.5">Total</td><td className="text-right">{brl(soma.fat)}</td><td className="text-right">{brl(soma.af)}</td><td className="text-right">{brl(soma.proj)}</td><td className="text-right">{brl(soma.meta)}</td><td className={`text-right ${tone(div(soma.proj, soma.meta))}`}>{soma.meta ? pct(div(soma.proj, soma.meta)) : "—"}</td><td className="text-right">{brl(soma.com)}</td></tr></tbody></table>
    <p className="mt-2 text-[11px] text-muted-foreground">Visão extra da gestão. As comissões de cada frente continuam em relatórios separados para o RH.</p>
  </Box>;
}

/** Radar do dia: mostra à gestão se Geovana (Acessórios) e Marcela (Estética) lançaram vendas/volumes hoje. */
function Radar({ vendas, vols }: { vendas: Venda[]; vols: Vol[] }) {
  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const hora = (s?: string) => (s ? new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");
  const itens: [Depto, string][] = [["ACESSORIOS", "Geovana · Acessórios"], ["ESTETICA", "Marcela · Estética"]];
  return <div className="grid gap-2 sm:grid-cols-2">{itens.map(([d, l]) => {
    const vs = vendas.filter((v) => v.departamento === d && v.produto !== "IMPORTAÇÃO RVD");
    const r = radarDia(vs, d === "ACESSORIOS" ? vols : [], hoje);
    return <div key={d} className={`lux-card flex items-center justify-between gap-2 px-3 py-2 text-xs ${r.ok ? "" : "border-destructive"}`}>
      <b>{l}</b>
      <span className={r.ok ? "text-success" : "text-destructive"}>{r.ok ? `✅ Atualizado hoje · ${r.vendasHoje} venda(s)${r.volumesHoje ? ` · ${r.volumesHoje} volume(s)` : ""}` : "❌ Nada lançado hoje"} <span className="text-muted-foreground">· último {hora(r.ultima)}</span></span>
    </div>;
  })}</div>;
}
