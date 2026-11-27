import { Fragment, useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Barra, Box, Kpi, Tabela, brl, div, norm, parseNum, pct, tone, uni } from "./painel-ui";
import { GRUPO_NOME, ITENS, naoVende, naoVendeAgregado, splitCods, bonusLimpar, BONUS_LIMPAR_UN, potencialNaMesa, type Grupo } from "@/lib/agregados";
import { AgregadosImport } from "./AgregadosImport";
import { AgregadosIA } from "./AgregadosIA";
import { registrarUpdate } from "@/lib/update-log";
import { consultorMoto, type MixCons } from "@/lib/mecanicos";
import { BASE_TUNAP, CAMPANHA_TUNAP, mesesCheios, premioTunap } from "@/lib/campanha-tunap";

/** Un./passagem de revisão: Carro = BSI + Revisão C7; Moto = Revisão N7. */
const aprovFmt = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " un/pass";

type Cons = { id: string; nome: string; department_id: string | null };
type ASale = { consultant_id: string; dia: string; item: string; codigo: string; qtd: number; valor: number };
type AGoal = { consultant_id: string; item: string; meta_qtd: number; meta_valor: number };
type AVisit = { consultant_id: string; dia: string; passagens: number };

type Props = {
  mes: string; cons: Cons[]; allCons: Cons[]; tot: number; dec: number;
  deptName: (id: string | null) => string; reloadCons: () => void; relatorio?: boolean;
};

export function Agregados({ mes, cons, allCons, tot, dec, deptName, reloadCons, relatorio, modo = "ver" }: Props & { modo?: "ver" | "importar" | "metas" }) {
  const [sub, setSub] = useState<"servicos" | "pecas" | "ia" | "importar" | "metas">("servicos");
  const [sales, setSales] = useState<ASale[]>([]);
  const [goals, setGoals] = useState<AGoal[]>([]);
  const [visits, setVisits] = useState<AVisit[]>([]);
  const [mix, setMix] = useState<Map<string, MixCons>>(new Map());
  const [mixMeses, setMixMeses] = useState<{ mes: string; nome: string; m: MixCons }[]>([]);
  const [codigos, setCodigos] = useState<Record<string, string[]>>(() => Object.fromEntries(ITENS.map((i) => [i.k, i.cod])));

  const [y, m] = mes.split("-").map(Number);
  const fim = new Date(y!, m!, 0).getDate();
  const ini = `${mes}-01`, end = `${mes}-${fim}`;

  const [de, setDe] = useState(ini), [ate, setAte] = useState(end);
  useEffect(() => { setDe(ini); setAte(end); }, [ini, end]);
  const periodo = de !== ini || ate !== end;
  const load = useCallback(async () => {
    const [s, g, v, c] = await Promise.all([
      supabase.from("agg_sales").select("consultant_id,dia,item,codigo,qtd,valor").gte("dia", de).lte("dia", ate),
      supabase.from("agg_goals").select("consultant_id,item,meta_qtd,meta_valor").eq("mes", mes),
      supabase.from("agg_visits").select("consultant_id,dia,passagens").gte("dia", de).lte("dia", ate),
      supabase.from("agg_codes").select("item,codigos"),
    ]);
    const mx = await supabase.from("cons_mix").select("nome,composicao").eq("mes", mes);
    setMix(new Map((mx.data ?? []).map((r) => [r.nome.trim().toUpperCase(), r.composicao as unknown as MixCons])));
    const mm = await supabase.from("cons_mix").select("mes,nome,composicao").gte("mes", de.slice(0, 7)).lte("mes", ate.slice(0, 7));
    setMixMeses((mm.data ?? []).map((r) => ({ mes: r.mes, nome: r.nome.trim().toUpperCase(), m: r.composicao as unknown as MixCons })));
    setSales((s.data ?? []).map((x) => ({ ...x, qtd: +x.qtd, valor: +x.valor })));
    setGoals((g.data ?? []).map((x) => ({ ...x, meta_qtd: +x.meta_qtd, meta_valor: +x.meta_valor })));
    setVisits((v.data ?? []).map((x) => ({ ...x, passagens: +x.passagens })));
    const salvo = new Map((c.data ?? []).map((x) => [x.item, splitCods(x.codigos)]));
    setCodigos({ ...Object.fromEntries(ITENS.map((i) => [i.k, salvo.get(i.k) ?? i.cod])), __ignorar: salvo.get("__ignorar") ?? [] });
  }, [mes, de, ate]);
  useEffect(() => { load(); }, [load]);

  const rest = Math.max(tot - dec, 0);
  /** Quem não vende agregados fica fora de totais, rankings, metas e recomendações. */
  const consAgg = cons.filter((c) => !naoVendeAgregado(c.nome));
  const stat = (ids: string[], items: string[]) => {
    const idSet = new Set(ids), itSet = new Set(items);
    let qtd = 0, valor = 0, mq = 0, mv = 0, pass = 0;
    for (const s of sales) if (idSet.has(s.consultant_id) && itSet.has(s.item)) { qtd += s.qtd; valor += s.valor; }
    for (const g of goals) if (idSet.has(g.consultant_id) && itSet.has(g.item)) { mq += g.meta_qtd; mv += g.meta_valor; }
    for (const c of cons) if (idSet.has(c.id)) {
      const m = mix.get(c.nome.trim().toUpperCase());
      if (m) pass += consultorMoto(c.nome) ? (m.rev?.length ?? 0) : (m.bsi?.length ?? 0) + (m.rev?.length ?? 0);
      else for (const v of visits) if (v.consultant_id === c.id) pass += v.passagens;
    }
    const projQ = div(qtd, dec) * tot, projV = div(valor, dec) * tot;
    return {
      qtd, valor, mq, mv, pass, projQ, projV,
      perfQ: div(qtd, mq), perfV: div(valor, mv), projPctQ: div(projQ, mq), projPctV: div(projV, mv),
      aprov: div(qtd, pass), necQ: rest ? Math.max(mq - qtd, 0) / rest : 0,
    };
  };
  const ranking = (items: string[]) =>
    consAgg.filter((c) => items.length !== 1 || !naoVende(items[0]!, c.nome))
      .map((c) => ({ c, ...stat([c.id], items) })).sort((a, b) => b.perfQ - a.perfQ || b.qtd - a.qtd);

  const exportar = () => {
    const h = ["Grupo", "Item", "Consultor", "Departamento", "Qtd", "Meta Qtd", "Perf. Qtd", "Projeção Qtd", "Valor", "Meta R$", "Perf. R$", "Projeção R$", "Passagens", "Aproveitamento"];
    const f = (n: number) => n.toFixed(2).replace(".", ",");
    const fi = (n: number) => String(Math.round(n));
    const rows: string[][] = [];
    for (const it of ITENS) for (const l of ranking([it.k])) rows.push([GRUPO_NOME[it.g], it.nome, l.c.nome, deptName(l.c.department_id), fi(l.qtd), fi(l.mq), pct(l.perfQ), fi(l.projQ), f(l.valor), f(l.mv), pct(l.perfV), f(l.projV), fi(l.pass), aprovFmt(l.aprov)]);
    const csv = "\uFEFF" + [h, ...rows].map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(";")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `agregados-${mes}.csv`; a.click();
  };

  const subs: [typeof sub, string][] = [["servicos", "Serviços agregados"], ["pecas", "Peças agregadas"], ["ia", "Recomendações IA"]];

  if (modo === "metas") return <Metas cons={consAgg} goals={goals} mes={mes} deptName={deptName} onSaved={load} />;
  if (modo === "importar") return (
    <AgregadosImport allCons={allCons} codigos={codigos} ini={ini} end={end} onDone={() => { load(); reloadCons(); }} />
  );

  return (
    <div className="space-y-3">
      <details className="rounded-xl border border-border bg-card/60 p-2">
        <summary className="cursor-pointer text-sm font-semibold text-primary">📥 Importar relatório de agregados aqui</summary>
        <div className="mt-2"><AgregadosImport allCons={allCons} codigos={codigos} ini={ini} end={end} onDone={() => { load(); reloadCons(); }} /></div>
      </details>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Agregados · {periodo ? `${de.split("-").reverse().join("/")} a ${ate.split("-").reverse().join("/")}` : mes}</h2>
          <p className="text-xs text-muted-foreground">Acompanhamento separado — estes valores não entram nos totais das outras abas.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <label className="flex items-center gap-1 text-xs text-muted-foreground">De
            <input type="date" value={de} onChange={(e) => e.target.value && setDe(e.target.value)} className="rounded-md border border-border bg-card px-2 py-1 text-foreground" /></label>
          <label className="flex items-center gap-1 text-xs text-muted-foreground">a
            <input type="date" value={ate} onChange={(e) => e.target.value && setAte(e.target.value)} className="rounded-md border border-border bg-card px-2 py-1 text-foreground" /></label>
          {periodo && <button onClick={() => { setDe(ini); setAte(end); }} className="rounded-md border border-border px-2 py-1 text-xs">Mês inteiro</button>}
          <nav className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
            {subs.map(([k, l]) => (
              <button key={k} onClick={() => setSub(k)} className={`rounded-md px-3 py-1.5 text-sm font-medium ${sub === k ? "bg-card shadow-sm" : "text-muted-foreground"}`}>{l}</button>
            ))}
          </nav>
          <button onClick={exportar} className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">Exportar CSV</button>
        </div>
      </div>

      {relatorio ? (<>
        <GrupoView g="servicos" stat={stat} ranking={ranking} ids={consAgg.map((c) => c.id)} deptName={deptName} rest={rest} sales={sales} />
        <GrupoView g="pecas" stat={stat} ranking={ranking} ids={consAgg.map((c) => c.id)} deptName={deptName} rest={rest} sales={sales} />
      </>) : (sub === "servicos" || sub === "pecas") && (
        <GrupoView g={sub} stat={stat} ranking={ranking} ids={consAgg.map((c) => c.id)} deptName={deptName} rest={rest} sales={sales} />
      )}
      {!relatorio && sub === "servicos" && (() => {
        const l = consAgg.map((c) => ({ c, q: bonusLimpar(sales.filter((x) => x.consultant_id === c.id)) })).filter((x) => x.q.qtd > 0).sort((a, b) => b.q.bonus - a.q.bonus);
        return <section className="lux-card px-3 py-2 text-xs">
          <h3 className="text-sm font-semibold">Bonificação Limpar · R$ {BONUS_LIMPAR_UN.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} por serviço <span className="font-normal text-muted-foreground">— paga pela Limpar direto ao consultor, fora da folha, além da comissão do serviço</span></h3>
          {l.length ? <div className="mt-1 flex flex-wrap gap-2">{l.map(({ c, q }) => <span key={c.id} className="rounded-full border border-success/50 bg-success/10 px-2 py-0.5"><b>{c.nome}</b> · {uni(q.qtd)} serv. = <b className="text-success">{brl(q.bonus)}</b></span>)}
            <span className="rounded-full border border-primary px-2 py-0.5 font-semibold">Total: {brl(l.reduce((n, x) => n + x.q.bonus, 0))}</span></div>
            : <p className="text-muted-foreground">Nenhum serviço Limpar vendido no mês.</p>}
        </section>;
      })()}
      {!relatorio && sub === "servicos" && (() => {
        const ks = ITENS.filter((i) => i.g === "servicos").map((i) => i.k);
        const l = consAgg.map((c) => { const s = stat([c.id], ks); return { c, pass: s.pass, branco: Math.max(s.pass - s.qtd, 0), pen: div(s.qtd, s.pass) }; }).filter((x) => x.pass > 0).sort((a, b) => b.branco - a.branco);
        const tp = l.reduce((n, x) => n + x.pass, 0), tb = l.reduce((n, x) => n + x.branco, 0);
        return <section className="lux-card px-3 py-2 text-xs">
          <h3 className="text-sm font-semibold">Passagens em branco · serviços agregados <span className="font-normal text-muted-foreground">— no mínimo {uni(tb)} de {uni(tp)} passagens sem nenhum agregado vendido</span></h3>
          {l.length ? <div className="mt-1 flex flex-wrap gap-2">{l.map((x, i) => <span key={x.c.id} className={`rounded-full border px-2 py-0.5 ${x.pen >= 0.3 ? "border-success/50" : x.pen >= 0.15 ? "border-warning/50" : "border-destructive/50"}`}>{i === l.length - 1 && l.length > 1 ? "🏆 " : ""}<b>{x.c.nome}</b> · {uni(x.branco)} em branco · penetração <b>{pct(x.pen)}</b></span>)}</div>
            : <p className="text-muted-foreground">Importe as Passagens para ver este quadro.</p>}
        </section>;
      })()}
      {!relatorio && (sub === "servicos" || sub === "pecas") && (() => {
        const its = ITENS.filter((i) => i.g === sub).map((it) => ({ it, p: potencialNaMesa(consAgg.filter((c) => !naoVende(it.k, c.nome)).map((c) => { const s = stat([c.id], [it.k]); return { nome: c.nome, qtd: s.qtd, valor: s.valor, pass: s.pass }; })) })).filter((x) => x.p.valor > 0);
        const total = its.reduce((n, x) => n + x.p.valor, 0);
        return <section className="lux-card px-3 py-2 text-xs">
          <h3 className="text-sm font-semibold">💸 Potencial deixado na mesa · <span className="text-destructive">{brl(total)}</span> <span className="font-normal text-muted-foreground">— se quem está abaixo chegasse à penetração média da equipe em cada item (preço médio praticado)</span></h3>
          {its.length ? <div className="mt-1 space-y-1">{its.map(({ it, p }) => <div key={it.k} className="flex flex-wrap items-center gap-1.5"><b className="w-40 shrink-0">{it.nome} <span className="font-normal text-muted-foreground">({pct(p.media)})</span></b>{p.porConsultor.map((x) => <span key={x.nome} className={`rounded-full border px-2 py-0.5 ${x.zerado && dec >= 5 ? "border-destructive bg-destructive/10 text-destructive" : "border-warning/50"}`}>{x.zerado && dec >= 5 ? "⛔ " : ""}{x.nome} · +{uni(x.un)} un = <b>{brl(x.valor)}</b></span>)}</div>)}</div>
            : <p className="text-muted-foreground">Sem potencial a recuperar (ou passagens ainda não importadas).</p>}
          <p className="mt-1 text-[10px] text-muted-foreground">⛔ = nenhuma venda do item no mês após 5+ dias decorridos.</p>
        </section>;
      })()}
      {!relatorio && (sub === "servicos" || sub === "pecas") && (() => {
        // Meses fechados da campanha vêm da base apurada no DMS; demais meses, dos dados importados (revisões somadas mês a mês).
        const base = mesesCheios(de, ate).filter((k) => BASE_TUNAP[k]);
        const fora = (dia: string) => !base.includes(dia.slice(0, 7));
        const linhas = consAgg.map((c) => {
          const nome = c.nome.trim().toUpperCase(), moto = consultorMoto(c.nome);
          let qtd = 0, valor = 0, pass = 0;
          for (const s of sales) if (s.consultant_id === c.id && s.item === "tunap" && fora(s.dia)) { qtd += s.qtd; valor += s.valor; }
          for (const r of mixMeses) if (r.nome === nome && !base.includes(r.mes)) pass += moto ? (r.m.rev?.length ?? 0) : (r.m.bsi?.length ?? 0) + (r.m.rev?.length ?? 0);
          for (const k of base) { const b = BASE_TUNAP[k]![nome]; if (b) { pass += b[0]; qtd += b[1]; valor += b[2]; } }
          return { c, moto, pass, qtd, valor, p: premioTunap(moto ? "moto" : "auto", qtd, pass) };
        }).filter((x) => x.pass > 0 || x.qtd > 0).sort((a, b) => b.p.conv - a.p.conv);
        const tp = linhas.reduce((n, x) => n + x.pass, 0), tq = linhas.reduce((n, x) => n + x.qtd, 0), tv = linhas.reduce((n, x) => n + x.valor, 0);
        const loja = premioTunap("loja", tq, tp);
        const ganho = linhas.reduce((n, x) => n + (x.p.atual?.valor ?? 0), 0) + (loja.atual?.valor ?? 0);
        const camp = de === CAMPANHA_TUNAP.de && ate === CAMPANHA_TUNAP.ate;
        const aprov = (q: number, ps: number) => `${aprovFmt(div(q, ps))} · ${pct(div(q, ps))}`;
        return <details className="lux-card px-3 py-2 text-xs">
          <summary className="cursor-pointer text-sm font-semibold">🎯 Copa TUNAP · conversão e prêmios <span className="font-normal text-muted-foreground">— bateu, levou (Jul–Nov/2026)</span></summary>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button onClick={() => { if (camp) { setDe(ini); setAte(end); } else { setDe(CAMPANHA_TUNAP.de); setAte(CAMPANHA_TUNAP.ate); } }} className="rounded-md border border-primary px-2 py-1 text-primary">{camp ? "Voltar ao mês" : "Período da campanha (01/07–30/11)"}</button>
            <span className="text-muted-foreground">Cálculo pelo período selecionado no topo.</span>
          </div>
          <div className="overflow-x-auto"><table className="mt-2 w-full min-w-[560px] tabular-nums">
            <thead className="text-muted-foreground"><tr><th className="text-left">Consultor</th><th className="text-right">Revisões</th><th className="text-right">Qtd</th><th className="text-right">Valor</th><th className="text-right">Aproveit.</th><th className="pl-3 text-left">Prêmio atual</th></tr></thead>
            <tbody>{linhas.map((x) => <tr key={x.c.id} className="border-t border-border"><td>{x.c.nome} <span className="rounded bg-muted px-1 text-[10px] text-muted-foreground">{x.moto ? "Moto" : "Carro"}</span></td><td className="text-right">{uni(x.pass)}</td><td className="text-right font-semibold">{uni(x.qtd)}</td><td className="text-right">{brl(x.valor)}</td><td className={`text-right font-semibold ${tone(x.p.conv)}`}>{aprov(x.qtd, x.pass)}</td><td className="pl-3">{x.p.atual ? <span className="text-success">🏆 {x.p.atual.premio}</span> : <span className="text-muted-foreground">—</span>}</td></tr>)}</tbody>
            <tfoot><tr className="border-t-2 border-primary font-semibold"><td>Total</td><td className="text-right">{uni(tp)}</td><td className="text-right">{uni(tq)}</td><td className="text-right">{brl(tv)}</td><td className="text-right">{aprov(tq, tp)}</td><td className="pl-3">{loja.atual ? `🎉 ${loja.atual.premio}` : "—"}</td></tr></tfoot>
          </table></div>
          <h4 className="mt-3 text-sm font-semibold">💰 O que estamos ganhando até agora · <span className="text-success">{brl(ganho)}</span></h4>
          <div className="mt-1 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg border border-primary/50 bg-primary/5 p-2"><b>Confraternização da loja</b> · {aprov(tq, tp)}<br />{loja.atual ? <span className="text-success">🎉 {loja.atual.premio} ({brl(loja.atual.valor)})</span> : <span className="text-muted-foreground">Ainda não destravada</span>}{loja.prox && <><br /><span className="text-warning">Faltam {uni(loja.faltam)} un para: {loja.prox.premio}</span></>}</div>
            {linhas.map((x) => <div key={x.c.id} className={`rounded-lg border p-2 ${x.p.atual ? "border-success/50 bg-success/5" : "border-border"}`}><b>{x.c.nome}</b> · {x.moto ? "Moto" : "Carro"}<br />{x.p.atual ? <span className="text-success">🏆 {x.p.atual.premio} ({brl(x.p.atual.valor)})</span> : <span className="text-muted-foreground">Nenhum prêmio ainda</span>}{x.p.prox ? <><br /><span className="text-warning">Faltam {uni(x.p.faltam)} un para: {x.p.prox.premio}</span></> : <><br /><span className="text-success">Faixa máxima atingida</span></>}</div>)}
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">Revisões = passagens de revisão (Carro: BSI + Revisão; Moto: Revisão). Faixas: Moto 1,0/1,5/2,0 · Carro 1,0/1,5/1,8 · Loja 1,0/1,5/2,0 un/pass. Valores = teto do regulamento; pagamento em dez/2026.</p>
        </details>;
      })()}
      {sub === "ia" && <AgregadosIA mes={mes} cons={consAgg} tot={tot} dec={dec} stat={stat} deptName={deptName} />}
      {sub === "metas" && <Metas cons={consAgg} goals={goals} mes={mes} deptName={deptName} onSaved={load} />}
    </div>
  );
}

type Stat = { qtd: number; valor: number; mq: number; mv: number; pass: number; projQ: number; projV: number; perfQ: number; perfV: number; projPctQ: number; projPctV: number; aprov: number; necQ: number };
type Row = Stat & { c: Cons };

function GrupoView({ g, stat, ranking, ids, deptName, rest, sales }: {
  g: Grupo; stat: (ids: string[], items: string[]) => Stat; ranking: (items: string[]) => Row[]; ids: string[]; deptName: (id: string | null) => string; rest: number; sales: ASale[];
}) {
  const items = ITENS.filter((i) => i.g === g);
  const keys = items.map((i) => i.k);
  const T = stat(ids, keys);
  const perItem = items.map((it) => ({ it, s: stat(ids, [it.k]) }));
  const [sel, setSel] = useState<string | null>(null);
  return (
    <>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Quantidade vendida" value={uni(T.qtd)} cls={tone(T.perfQ)} sub={<ItensDetalhe perItem={perItem} T={T} modo="qtd" />} />
        <Kpi label="Projeção (qtd)" value={uni(T.projQ)} cls={tone(T.projPctQ)} sub={<ItensDetalhe perItem={perItem} T={T} modo="proj" rest={rest} />} />
        <Kpi label="Valor vendido" value={brl(T.valor)} cls={tone(T.perfV)} sub={<ItensDetalhe perItem={perItem} T={T} modo="valor" />} />
        <Kpi label="Aproveitamento (un/passagem de revisão)" value={aprovFmt(T.aprov)} sub={<ItensDetalhe perItem={perItem} T={T} modo="aprov" />} />
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {perItem.map(({ it, s }) => {
          const lid = ranking([it.k])[0]; const on = sel === it.k;
          return <button key={it.k} type="button" onClick={() => setSel(on ? null : it.k)} className={`lux-card px-3 py-2 text-left ${on ? "ring-2 ring-primary" : ""}`}>
            <p className="flex justify-between text-sm font-semibold"><span>{it.nome}</span><span className={tone(s.projPctQ)}>{pct(s.projPctQ)}</span></p>
            <p className="text-lg font-bold">{uni(s.qtd)} <span className="text-xs font-normal text-muted-foreground">de {uni(s.mq)} un · proj. {uni(s.projQ)}</span></p>
            <p className="text-xs text-muted-foreground">{brl(s.valor)} de {brl(s.mv)} · conversão {aprovFmt(s.aprov)}</p>
            <div className="my-1"><Barra p={s.projPctQ} /></div>
            <p className="text-[11px] text-primary">{lid && lid.qtd > 0 ? `Líder: ${lid.c.nome}` : "—"} · {on ? "mostrando abaixo" : "clique para ver por consultor"}</p>
          </button>;
        })}
      </div>
      {sel ? <RankTable title={`Por consultor — ${items.find((i) => i.k === sel)?.nome}`} rows={ranking([sel])} deptName={deptName} sales={sales} items={[sel]} />
        : <RankTable title={`Consolidado por consultor — ${GRUPO_NOME[g]}`} rows={ranking(keys)} deptName={deptName} sales={sales} items={keys} />}
    </>
  );
}

/** Linha por item dentro dos cartões de KPI: vendido/projeção/valor/aproveitamento de cada tópico, com total. */
function ItensDetalhe({ perItem, T, modo, rest = 0 }: { perItem: { it: (typeof ITENS)[number]; s: Stat }[]; T: Stat; modo: "qtd" | "proj" | "valor" | "aprov"; rest?: number }) {
  const linha = (s: Stat) =>
    modo === "qtd" ? `${uni(s.qtd)} de ${uni(s.mq)}`
    : modo === "proj" ? `${uni(s.projQ)} de ${uni(s.mq)}`
    : modo === "valor" ? `${brl(s.valor)} de ${brl(s.mv)}`
    : aprovFmt(s.aprov);
  const total =
    modo === "qtd" ? `${uni(T.qtd)} de ${uni(T.mq)} · ${pct(T.perfQ)}`
    : modo === "proj" ? `${uni(T.projQ)} de ${uni(T.mq)} · ${pct(T.projPctQ)} · precisa ${Math.ceil(T.necQ)}/dia (${rest} dias)`
    : modo === "valor" ? `${brl(T.valor)} de ${brl(T.mv)} · ${pct(T.perfV)} · projeção ${brl(T.projV)}`
    : `${uni(T.qtd)} itens em ${uni(T.pass)} passagens`;
  return (
    <span className="block space-y-1">
      {perItem.map(({ it, s }) => (
        <span key={it.k} className="flex items-baseline justify-between gap-3">
          <span className="truncate">{it.nome}</span>
          <span className="whitespace-nowrap tabular-nums">{linha(s)}</span>
        </span>
      ))}
      <span className="flex items-baseline justify-between gap-3 border-t border-border pt-1 font-semibold text-foreground">
        <span>Total</span>
        <span className="whitespace-nowrap tabular-nums text-right">{total}</span>
      </span>
    </span>
  );
}

function RankTable({ title, rows, deptName, sales, items }: { title: string; rows: Row[]; deptName: (id: string | null) => string; sales: ASale[]; items: string[] }) {
  const lider = rows[0] && (rows[0].qtd > 0 || rows[0].perfQ > 0) ? rows[0] : null;
  const usaMeta = rows.some((r) => r.mq > 0);
  const [aberto, setAberto] = useState<string | null>(null);
  const itSet = new Set(items);
  /** Detalhe por código de um consultor, só dos itens deste ranking. */
  const detalhe = (cid: string) => {
    const m = new Map<string, { codigo: string; qtd: number; valor: number }>();
    for (const s of sales) {
      if (s.consultant_id !== cid || !itSet.has(s.item)) continue;
      const k = s.codigo || "(sem código)";
      const r = m.get(k) ?? { codigo: k, qtd: 0, valor: 0 };
      r.qtd += s.qtd; r.valor += s.valor;
      m.set(k, r);
    }
    return [...m.values()].sort((a, b) => b.qtd - a.qtd);
  };
  return (
    <Box title={title} fit="xl:max-h-[calc(100vh-715px)] xl:min-h-[175px]">
      <Tabela head={["#", "Consultor", "Depto", "Qtd", "Meta", "Perf.", "Projeção", "Proj. %", "Valor", "Meta R$", "Perf. R$", "Aproveit.", "Nec./dia", "vs. Líder"]}>
        {rows.length === 0 && <tr><td colSpan={14} className="px-3 py-8 text-center text-muted-foreground">Nenhum consultor cadastrado.</td></tr>}
        {rows.map((l, i) => {
          const gap = lider ? (usaMeta ? `−${((lider.perfQ - l.perfQ) * 100).toFixed(1)} pts` : `−${uni(lider.qtd - l.qtd)} un.`) : "—";
          const det = aberto === l.c.id ? detalhe(l.c.id) : null;
          return (
            <Fragment key={l.c.id}>
            <tr className="border-t border-border">
              <td className="px-3 py-2">{i + 1}</td>
              <td className="px-3 py-2 font-medium">
                <button onClick={() => setAberto(aberto === l.c.id ? null : l.c.id)} className="underline decoration-dotted underline-offset-2 hover:text-primary" title="Ver detalhe por código">
                  {l.c.nome} {aberto === l.c.id ? "▴" : "▾"}
                </button>
              </td>
              <td className="px-3 py-2 text-muted-foreground">{deptName(l.c.department_id)}</td>
              <td className="px-3 py-2 font-semibold">{uni(l.qtd)}</td>
              <td className="px-3 py-2 text-muted-foreground">{uni(l.mq)}</td>
              <td className={`px-3 py-2 font-semibold ${tone(l.perfQ)}`}>{pct(l.perfQ)}</td>
              <td className="px-3 py-2">{uni(l.projQ)}</td>
              <td className="px-3 py-2"><Barra p={l.projPctQ} /></td>
              <td className="px-3 py-2">{brl(l.valor)}</td>
              <td className="px-3 py-2 text-muted-foreground">{brl(l.mv)}</td>
              <td className={`px-3 py-2 ${tone(l.perfV)}`}>{pct(l.perfV)}</td>
              <td className="px-3 py-2">{aprovFmt(l.aprov)}</td>
              <td className="px-3 py-2">{l.necQ ? Math.ceil(l.necQ) : "—"}</td>
              <td className="whitespace-nowrap px-3 py-2">{lider && lider.c.id === l.c.id ? <span className="font-semibold text-primary">Líder</span> : <span className="text-destructive">{gap}</span>}</td>
            </tr>
            {det && (
              <tr className="border-t border-border bg-muted/40">
                <td colSpan={14} className="px-6 py-2">
                  {det.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Sem detalhe por código — reimporte o relatório do mês para gravar os códigos.</p>
                  ) : (
                    <table className="w-full text-xs">
                      <thead className="text-left text-muted-foreground"><tr><th className="py-1">Código</th><th className="text-right">Vendas</th><th className="text-right">Valor</th></tr></thead>
                      <tbody>
                        {det.map((d) => (
                          <tr key={d.codigo} className="border-t border-border/50">
                            <td className="py-1 font-mono">{d.codigo}</td>
                            <td className="text-right">{uni(d.qtd)}</td>
                            <td className="text-right">{brl(d.valor)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </td>
              </tr>
            )}
            </Fragment>
          );
        })}
      </Tabela>
    </Box>
  );
}


function Metas({ cons, goals, mes, deptName, onSaved }: { cons: Cons[]; goals: AGoal[]; mes: string; deptName: (id: string | null) => string; onSaved: () => void }) {
  const [m, setM] = useState<Record<string, { q: number; v: number }>>({});
  useEffect(() => { setM(Object.fromEntries(goals.map((g) => [`${g.consultant_id}|${g.item}`, { q: g.meta_qtd, v: g.meta_valor }]))); }, [goals]);
  const salvar = async (cid: string, item: string) => {
    const x = m[`${cid}|${item}`] ?? { q: 0, v: 0 };
    await supabase.from("agg_goals").upsert({ consultant_id: cid, mes, item, meta_qtd: x.q, meta_valor: x.v }, { onConflict: "consultant_id,mes,item" });
    onSaved();
  };
  const inp = "w-16 rounded border border-input bg-background px-2 py-1 text-right";
  return (
    <div className="space-y-6">
      {(["servicos", "pecas"] as Grupo[]).map((g) => {
        const items = ITENS.filter((i) => i.g === g);
        return (
          <Box key={g} title={`Metas de ${GRUPO_NOME[g].toLowerCase()} — ${mes}`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left" rowSpan={2}>Consultor</th>
                    <th className="px-3 py-2 text-left" rowSpan={2}>Depto</th>
                    {items.map((it) => <th key={it.k} colSpan={2} className="border-l border-border px-3 py-2">{it.nome}</th>)}
                  </tr>
                  <tr>{items.map((it) => [<th key={it.k + "q"} className="border-l border-border px-2 py-1">Meta qtd</th>, <th key={it.k + "v"} className="px-2 py-1">Meta R$</th>])}</tr>
                </thead>
                <tbody>
                  {cons.map((c) => (
                    <tr key={c.id} className="border-t border-border">
                      <td className="whitespace-nowrap px-3 py-2 font-medium">{c.nome}</td>
                      <td className="px-3 py-2 text-muted-foreground">{deptName(c.department_id)}</td>
                      {items.map((it) => {
                        const key = `${c.id}|${it.k}`, x = m[key] ?? { q: 0, v: 0 };
                        return [
                          <td key={it.k + "q"} className="border-l border-border px-2 py-1"><input type="number" value={x.q || ""} onChange={(e) => setM({ ...m, [key]: { ...x, q: +e.target.value } })} onBlur={() => salvar(c.id, it.k)} className={inp} /></td>,
                          <td key={it.k + "v"} className="px-2 py-1"><input type="number" value={x.v || ""} onChange={(e) => setM({ ...m, [key]: { ...x, v: +e.target.value } })} onBlur={() => salvar(c.id, it.k)} className={`${inp} w-24`} /></td>,
                        ];
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Box>
        );
      })}
      <p className="text-xs text-muted-foreground">As metas são salvas ao sair do campo e valem para o mês selecionado no topo. A performance e o ranking usam a meta de quantidade; a meta em R$ é acompanhada à parte.</p>
    </div>
  );
}
