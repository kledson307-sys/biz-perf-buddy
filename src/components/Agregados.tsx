import { Fragment, useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Barra, Box, Kpi, Tabela, brl, div, norm, parseNum, pct, tone, uni } from "./painel-ui";
import { GRUPO_NOME, ITENS, naoVende, naoVendeAgregado, splitCods, type Grupo } from "@/lib/agregados";
import { AgregadosImport } from "./AgregadosImport";
import { AgregadosIA } from "./AgregadosIA";
import { registrarUpdate } from "@/lib/update-log";

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
  const [codigos, setCodigos] = useState<Record<string, string[]>>(() => Object.fromEntries(ITENS.map((i) => [i.k, i.cod])));

  const [y, m] = mes.split("-").map(Number);
  const fim = new Date(y!, m!, 0).getDate();
  const ini = `${mes}-01`, end = `${mes}-${fim}`;

  const load = useCallback(async () => {
    const [s, g, v, c] = await Promise.all([
      supabase.from("agg_sales").select("consultant_id,dia,item,codigo,qtd,valor").gte("dia", ini).lte("dia", end),
      supabase.from("agg_goals").select("consultant_id,item,meta_qtd,meta_valor").eq("mes", mes),
      supabase.from("agg_visits").select("consultant_id,dia,passagens").gte("dia", ini).lte("dia", end),
      supabase.from("agg_codes").select("item,codigos"),
    ]);
    setSales((s.data ?? []).map((x) => ({ ...x, qtd: +x.qtd, valor: +x.valor })));
    setGoals((g.data ?? []).map((x) => ({ ...x, meta_qtd: +x.meta_qtd, meta_valor: +x.meta_valor })));
    setVisits((v.data ?? []).map((x) => ({ ...x, passagens: +x.passagens })));
    const salvo = new Map((c.data ?? []).map((x) => [x.item, splitCods(x.codigos)]));
    setCodigos(Object.fromEntries(ITENS.map((i) => [i.k, salvo.get(i.k) ?? i.cod])));
  }, [mes, ini, end]);
  useEffect(() => { load(); }, [load]);

  const rest = Math.max(tot - dec, 0);
  /** Quem não vende agregados fica fora de totais, rankings, metas e recomendações. */
  const consAgg = cons.filter((c) => !naoVendeAgregado(c.nome));
  const stat = (ids: string[], items: string[]) => {
    const idSet = new Set(ids), itSet = new Set(items);
    let qtd = 0, valor = 0, mq = 0, mv = 0, pass = 0;
    for (const s of sales) if (idSet.has(s.consultant_id) && itSet.has(s.item)) { qtd += s.qtd; valor += s.valor; }
    for (const g of goals) if (idSet.has(g.consultant_id) && itSet.has(g.item)) { mq += g.meta_qtd; mv += g.meta_valor; }
    for (const v of visits) if (idSet.has(v.consultant_id)) pass += v.passagens;
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
    for (const it of ITENS) for (const l of ranking([it.k])) rows.push([GRUPO_NOME[it.g], it.nome, l.c.nome, deptName(l.c.department_id), fi(l.qtd), fi(l.mq), pct(l.perfQ), fi(l.projQ), f(l.valor), f(l.mv), pct(l.perfV), f(l.projV), fi(l.pass), pct(l.aprov)]);
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Agregados · {mes}</h2>
          <p className="text-xs text-muted-foreground">Acompanhamento separado — estes valores não entram nos totais das outras abas.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
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
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Quantidade vendida" value={uni(T.qtd)} cls={tone(T.perfQ)} sub={<ItensDetalhe perItem={perItem} T={T} modo="qtd" />} />
        <Kpi label="Projeção (qtd)" value={uni(T.projQ)} cls={tone(T.projPctQ)} sub={<ItensDetalhe perItem={perItem} T={T} modo="proj" rest={rest} />} />
        <Kpi label="Valor vendido" value={brl(T.valor)} cls={tone(T.perfV)} sub={<ItensDetalhe perItem={perItem} T={T} modo="valor" />} />
        <Kpi label="Aproveitamento" value={pct(T.aprov)} sub={<ItensDetalhe perItem={perItem} T={T} modo="aprov" />} />
      </div>

      <Box title={`Resumo por item — ${GRUPO_NOME[g]}`}>
        <Tabela head={["Item", "Qtd", "Meta", "Perf.", "Projeção", "Proj. %", "Valor", "Meta R$", "Perf. R$", "Aproveit.", "Líder"]}>
          {perItem.map(({ it, s }) => {
            const lid = ranking([it.k])[0];
            return (
              <tr key={it.k} className="border-t border-border">
                <td className="px-3 py-2 font-medium">{it.nome}</td>
                <td className="px-3 py-2">{uni(s.qtd)}</td>
                <td className="px-3 py-2 text-muted-foreground">{uni(s.mq)}</td>
                <td className={`px-3 py-2 font-semibold ${tone(s.perfQ)}`}>{pct(s.perfQ)}</td>
                <td className="px-3 py-2">{uni(s.projQ)}</td>
                <td className="px-3 py-2"><Barra p={s.projPctQ} /></td>
                <td className="px-3 py-2">{brl(s.valor)}</td>
                <td className="px-3 py-2 text-muted-foreground">{brl(s.mv)}</td>
                <td className={`px-3 py-2 ${tone(s.perfV)}`}>{pct(s.perfV)}</td>
                <td className="px-3 py-2">{pct(s.aprov)}</td>
                <td className="px-3 py-2 font-medium text-primary">{lid && lid.qtd > 0 ? lid.c.nome : "—"}</td>
              </tr>
            );
          })}
        </Tabela>
      </Box>

      <RankTable title={`Ranking geral — ${GRUPO_NOME[g]}`} rows={ranking(keys)} deptName={deptName} sales={sales} items={keys} />
      {items.map((it) => <RankTable key={it.k} title={`Ranking — ${it.nome}`} rows={ranking([it.k])} deptName={deptName} sales={sales} items={[it.k]} />)}
    </>
  );
}

/** Linha por item dentro dos cartões de KPI: vendido/projeção/valor/aproveitamento de cada tópico, com total. */
function ItensDetalhe({ perItem, T, modo, rest = 0 }: { perItem: { it: (typeof ITENS)[number]; s: Stat }[]; T: Stat; modo: "qtd" | "proj" | "valor" | "aprov"; rest?: number }) {
  const linha = (s: Stat) =>
    modo === "qtd" ? `${uni(s.qtd)} de ${uni(s.mq)}`
    : modo === "proj" ? `${uni(s.projQ)} de ${uni(s.mq)}`
    : modo === "valor" ? `${brl(s.valor)} de ${brl(s.mv)}`
    : `${pct(s.aprov)}`;
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
    <Box title={title}>
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
              <td className="px-3 py-2">{pct(l.aprov)}</td>
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
