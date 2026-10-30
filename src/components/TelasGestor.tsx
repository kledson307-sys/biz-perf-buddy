import { useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { daLoja, resumir, type NpsItem } from "@/lib/nps";
import { useResumoMes } from "@/hooks/use-resumo-mes";
import { ITENS } from "@/lib/agregados";
import { AlertTriangle, ArrowRight, CalendarDays, ClipboardList, Download, MapPin, Printer, Target, TrendingUp, Trophy, Users } from "lucide-react";
import { Anel, Bloco } from "@/components/Cockpit";
import { brl, div, pct, tone, uni } from "@/components/painel-ui";
import { MixConsultores } from "@/components/MixConsultores";
import type { PerformanceCalc } from "@/lib/performance";
import farois from "@/assets/hero-farois.jpg";

type L = { c: { id: string; nome: string; department_id: string | null }; servicos: number; pecas: number; mS: number; mP: number; meta: number; real: number; perf: number; perfS: number; perfP: number; projPct: number; proj: number; nec: number };
type D = { nome: string; servicos: number; pecas: number; meta: number; mS: number; mP: number; projPct: number; projPctS: number; projPctP: number; proj: number };
type S = { consultant_id: string; dia: string; servicos: number; pecas: number };

const GRID = "space-y-2 lg:grid lg:h-[calc(100dvh-7rem)] lg:min-h-[620px] lg:gap-2 lg:space-y-0";

/** Cabeçalho padrão das telas do gestor (título, subtítulo, mês e loja), igual às referências. */
export function CabecalhoTela({ titulo, sub, mes, dec, tot, className = "" }: { titulo: string; sub: string; mes: string; dec: number; tot: number; className?: string }) {
  const [, mm] = mes.split("-").map(Number);
  const mesNome = new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(new Date(2000, (mm ?? 1) - 1, 1));
  return (
    <section className={`relative flex flex-wrap items-center justify-between gap-2 overflow-hidden rounded-xl border border-border px-4 py-2 ${className}`}>
      <img src={farois} alt="" aria-hidden className="pointer-events-none absolute inset-y-0 right-0 h-full w-1/2 object-cover opacity-30 [mask-image:linear-gradient(to_left,black_30%,transparent)]" />
      <div className="relative"><h2 className="text-lg font-bold leading-tight">{titulo}</h2><p className="text-xs text-primary/90">{sub}</p></div>
      <div className="relative flex flex-wrap gap-4 text-xs">
        <span className="flex items-center gap-2"><CalendarDays className="size-5 text-primary" /><span><b className="block capitalize">{mesNome}</b><span className="text-muted-foreground">dia útil {dec} de {tot}</span></span></span>
        <span className="flex items-center gap-2"><MapPin className="size-5 text-primary" /><span><b className="block">Haus Salvador</b><span className="text-muted-foreground">Concessionária BMW</span></span></span>
      </div>
    </section>
  );
}

export function KpiCard({ label, value, cls = "", sub, className = "" }: { label: string; value: ReactNode; cls?: string; sub?: ReactNode; className?: string }) {
  return (
    <div className={`lux-card flex flex-col justify-center px-4 py-2 ${className}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold leading-tight tabular-nums ${cls}`}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

/** Gráfico acumulado (área) do realizado contra a linha da meta. */
export function GraficoEvolucao({ sales, ids, meta, mes }: { sales: S[]; ids: string[]; meta: number; mes: string }) {
  const pts = useMemo(() => {
    const set = new Set(ids); const m = new Map<string, number>();
    for (const s of sales) if (set.has(s.consultant_id)) m.set(s.dia, (m.get(s.dia) ?? 0) + +s.servicos + +s.pecas);
    let acc = 0;
    const p = [...m.keys()].sort().map((d) => ({ d: Number(d.slice(8, 10)), v: (acc += m.get(d)!) }));
    return p.length ? [{ d: 0, v: 0 }, ...p] : p;
  }, [sales, ids]);
  const [y, mo] = mes.split("-").map(Number);
  const dias = new Date(y!, mo!, 0).getDate();
  const W = 600, H = 150, maxY = Math.max(meta, pts.at(-1)?.v ?? 0, 1);
  const px = (d: number) => (d / dias) * W, py = (v: number) => H - (v / maxY) * (H - 10);
  const cam = pts.map((p, i) => `${i ? "L" : "M"}${px(p.d).toFixed(1)},${py(p.v).toFixed(1)}`).join(" ");
  if (!pts.length) return <p className="text-sm text-muted-foreground">Sem vendas importadas neste mês.</p>;
  return (
    <div className="flex h-full min-h-28 flex-col">
      <svg viewBox={`0 0 ${W} ${H + 18}`} preserveAspectRatio="none" className="min-h-0 w-full flex-1" role="img" aria-label="Realizado acumulado contra a meta">
        {[0.25, 0.5, 0.75, 1].map((f) => <line key={f} x1="0" x2={W} y1={py(maxY * f)} y2={py(maxY * f)} className="stroke-border" strokeWidth="1" />)}
        <line x1="0" y1={H} x2={W} y2={py(meta)} className="stroke-muted-foreground" strokeWidth="1.5" strokeDasharray="6 5" />
        <path d={`${cam} L${px(pts.at(-1)!.d)},${H} L0,${H} Z`} fill="var(--primary)" fillOpacity="0.18" />
        <path d={cam} fill="none" stroke="var(--primary)" strokeWidth="2.5" />
        <circle cx={px(pts.at(-1)!.d)} cy={py(pts.at(-1)!.v)} r="4" fill="var(--primary)" />
        {[1, 5, 10, 15, 20, 25, dias].map((d) => <text key={d} x={Math.min(px(d), W - 14)} y={H + 14} className="fill-muted-foreground text-[10px]">{d}</text>)}
      </svg>
      <p className="flex justify-end gap-4 text-[11px] text-muted-foreground"><span>- - Meta {brl(meta)}</span><span><span className="mr-1 inline-block h-0.5 w-4 bg-primary align-middle" />Realizado</span></p>
    </div>
  );
}

const estado = (p: number | null) => p === null ? { r: "Sem dados", c: "text-muted-foreground", b: "border-border" }
  : p >= 1 ? { r: "Dentro da meta", c: "text-success", b: "border-success/50 bg-success/10" }
  : p >= 0.85 ? { r: "Atenção", c: "text-warning", b: "border-warning/50 bg-warning/5" }
  : { r: "Crítico", c: "text-destructive", b: "border-destructive/50 bg-destructive/5" };

/** Central de Gestão (referência 16:9): status da operação, prioridades, plano de ação, evolução e resultado. */
export function CentralGestao({ linhas, porDept, total, sales, mes, tot, dec, setTab, exportar, imprimir, fechamento, whats }: {
  linhas: L[]; porDept: D[]; total: PerformanceCalc; sales: S[]; mes: string; tot: number; dec: number;
  setTab: (t: string) => void; exportar: () => void; imprimir: () => void; fechamento: () => void; whats: ReactNode;
}) {
  const { agg, mec, parados, amarelos } = useResumoMes(mes);
  const [nps, setNps] = useState<ReturnType<typeof resumir> | null>(null);
  useEffect(() => { void supabase.from("nps_imports").select("itens").order("at", { ascending: false }).limit(1).maybeSingle().then(({ data }) => { const l = daLoja((data?.itens as unknown as NpsItem[]) ?? []); setNps(l.length ? resumir(l) : null); }); }, []);
  const rest = Math.max(tot - dec, 0);
  const t = total;
  const acess = porDept.find((d) => /ACESS/i.test(d.nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "")));
  const aggRitmo = (() => { let q = 0, m = 0; for (const it of ITENS) { const a = agg[it.k]; if (a?.mq) { q += a.q; m += a.mq; } } return m && dec ? div(div(q, dec) * tot, m) : null; })();
  const status: [string, number | null, string][] = [
    ["Serviços", t.mS ? t.projPctS : null, "proj-serv"], ["Peças", t.mP ? t.projPctP : null, "pecas"],
    ["Acessórios", acess?.meta ? acess.projPct : null, "painel"], ["NPS", nps ? div(nps.pctProm, 0.85) : null, "nps"],
    ["Agregados", aggRitmo, "agregados"], ["Projeção", t.meta ? t.projPct : null, "proj-total"],
  ];
  const gapP = Math.max(t.mP - t.pecas, 0), gapS = Math.max(t.mS - t.servicos, 0);
  type P = { nivel: "CRÍTICO" | "ATENÇÃO"; titulo: string; l1: string; l2?: string | undefined; ir: string };
  const prior: P[] = [];
  const piorGrupo = t.projPctP <= t.projPctS ? { n: "Peças", gap: gapP, p: t.projPctP, ir: "pecas" } : { n: "Serviços", gap: gapS, p: t.projPctS, ir: "proj-serv" };
  if (piorGrupo.p < 1 && piorGrupo.gap > 0) prior.push({ nivel: piorGrupo.p < 0.85 ? "CRÍTICO" : "ATENÇÃO", titulo: piorGrupo.n, l1: `Gap de ${brl(piorGrupo.gap)}`, l2: rest ? `Necessário por dia: ${brl(piorGrupo.gap / rest)}` : undefined, ir: piorGrupo.ir });
  const fraco = [...linhas].filter((l) => l.meta > 0 && l.projPct < 0.85).sort((a, b) => a.projPct - b.projPct)[0];
  if (fraco) prior.push({ nivel: "ATENÇÃO", titulo: `Consultor ${fraco.c.nome}`, l1: `${pct(fraco.perf)} da meta · projeção ${pct(fraco.projPct)}`, ir: "ranking" });
  if (mec.ms && div(mec.s, mec.ms) < 0.85) prior.push({ nivel: "ATENÇÃO", titulo: "Oficina", l1: `Técnicos em ${pct(div(mec.s, mec.ms))} da meta de serviços`, ir: "mecanicos" });
  else if (parados) prior.push({ nivel: "ATENÇÃO", titulo: "Oficina", l1: `${parados} O.S. com mais de 30 dias`, ir: "controle-os" });

  type A = { acao: string; resp: string; prazo: string; st: "Em andamento" | "Pendente"; ir: string };
  const plano: A[] = [];
  if (gapP > 0) plano.push({ acao: "Recuperar oportunidades de peças", resp: "Consultores", prazo: "Hoje", st: "Em andamento", ir: "pecas" });
  if (parados || amarelos) plano.push({ acao: `Revisar O.S. abertas (${parados + amarelos} acima de 20 dias)`, resp: "Oficina", prazo: "Hoje", st: "Pendente", ir: "controle-os" });
  if (aggRitmo !== null && aggRitmo < 1) plano.push({ acao: "Aumentar venda de agregados", resp: "Consultores", prazo: "Hoje", st: "Em andamento", ir: "agregados" });
  if (fraco) plano.push({ acao: `Acompanhar consultor ${fraco.c.nome}`, resp: "Gerência", prazo: "Hoje", st: "Pendente", ir: "ranking" });
  if (nps && nps.det) plano.push({ acao: `Reverter ${nps.det} detrator(es) do NPS`, resp: "Consultores", prazo: "Hoje", st: "Pendente", ir: "nps" });
  if (mec.ms && div(mec.s, mec.ms) < 1) plano.push({ acao: "Reunião com equipe de oficina", resp: "Gerência", prazo: "Amanhã", st: "Pendente", ir: "mecanicos" });
  if (gapS > 0) plano.push({ acao: "Revisar orçamentos de serviço pendentes", resp: "Consultores", prazo: "Hoje", st: "Pendente", ir: "proj-serv" });

  return (
    <div className={`${GRID} lg:grid-cols-12 lg:grid-rows-[auto_auto_minmax(0,1fr)_minmax(0,1.1fr)_auto]`}>
      <CabecalhoTela className="lg:col-span-12" titulo="Central de Gestão" sub="Visão estratégica da operação. Foque no que realmente importa." mes={mes} dec={dec} tot={tot} />
      <Bloco titulo="Status da operação" className="lg:col-span-12">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">{status.map(([n, p, ir]) => { const s = estado(p); return (
          <button key={n} type="button" onClick={() => setTab(ir)} className={`rounded-lg border px-3 py-1.5 text-left transition hover:brightness-125 ${s.b}`}>
            <p className="text-sm font-semibold">{n}</p><p className={`text-xs font-semibold ${s.c}`}>{s.r}</p>
            <p className={`text-xl font-bold tabular-nums ${s.c}`}>{p === null ? "—" : pct(p)}</p>
          </button>); })}</div>
      </Bloco>
      <Bloco titulo="Prioridades de hoje" icon={<AlertTriangle className="size-4 text-destructive" />} className="lg:col-span-5 [&_h2]:text-primary">
        {!prior.length ? <p className="text-sm text-success">✅ Nenhuma prioridade crítica hoje.</p> :
          <ul className="space-y-1.5">{prior.slice(0, 3).map((p) => (
            <li key={p.titulo}><button type="button" onClick={() => setTab(p.ir)} className="flex w-full items-start gap-2 rounded-lg border border-border bg-background/40 px-2 py-1.5 text-left hover:bg-muted">
              <span className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${p.nivel === "CRÍTICO" ? "bg-destructive text-destructive-foreground" : "bg-warning text-background"}`}>!</span>
              <span className="min-w-0 flex-1 text-xs"><b className="block text-sm">{p.titulo}</b>{p.l1}{p.l2 && <span className="block text-muted-foreground">{p.l2}</span>}</span>
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${p.nivel === "CRÍTICO" ? "bg-destructive text-destructive-foreground" : "bg-warning text-background"}`}>{p.nivel}</span>
            </button></li>))}</ul>}
      </Bloco>
      <Bloco titulo="Plano de ação" icon={<ClipboardList className="size-4 text-primary" />} className="lg:col-span-7">
        {!plano.length ? <p className="text-sm text-success">Nenhuma ação pendente.</p> :
          <table className="w-full text-xs"><thead className="text-left text-muted-foreground"><tr><th className="py-1 font-normal">Ação</th><th className="font-normal">Responsável</th><th className="font-normal">Prazo</th><th className="font-normal">Status</th></tr></thead>
            <tbody>{plano.slice(0, 5).map((a) => <tr key={a.acao} className="cursor-pointer border-t border-border/60 hover:bg-muted" onClick={() => setTab(a.ir)}>
              <td className="py-1.5 pr-2">{a.acao}</td><td>{a.resp}</td><td>{a.prazo}</td>
              <td><span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${a.st === "Pendente" ? "border-warning text-warning" : "border-destructive text-destructive"}`}><span className={`size-1.5 rounded-full ${a.st === "Pendente" ? "bg-warning" : "bg-destructive"}`} />{a.st}</span></td>
            </tr>)}</tbody></table>}
      </Bloco>
      <Bloco titulo="Evolução geral" icon={<TrendingUp className="size-4 text-primary" />} className="lg:col-span-8">
        <GraficoEvolucao sales={sales} ids={linhas.map((l) => l.c.id)} meta={t.meta} mes={mes} />
      </Bloco>
      <Bloco titulo="Resultado do mês" icon={<Target className="size-4 text-primary" />} className="lg:col-span-4">
        <div className="flex h-full flex-col justify-between gap-2">
          <div><p className="text-[11px] text-muted-foreground">Realizado</p><p className="flex items-baseline justify-between gap-2"><b className="text-2xl tabular-nums">{brl(t.real)}</b><b className={`text-xl ${tone(t.perf)}`}>{pct(t.perf)} <span className="text-[10px] font-normal text-muted-foreground">da meta</span></b></p>
            <div className="mt-1 h-1 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(t.perf, 1) * 100}%` }} /></div></div>
          <div><p className="text-[11px] text-muted-foreground">Projeção</p><p className="flex items-baseline justify-between gap-2"><b className="text-xl tabular-nums">{brl(t.proj)}</b><b className={`text-lg ${tone(t.projPct)}`}>{pct(t.projPct)} <span className="text-[10px] font-normal text-muted-foreground">da meta</span></b></p>
            <p className="text-[11px] text-muted-foreground">Serviços {brl(t.projS)} · Peças {brl(t.projP)} · precisa {brl(t.nec)}/dia</p></div>
          <button type="button" onClick={() => setTab("proj-total")} className="mx-auto flex items-center gap-1 rounded-md border border-primary px-3 py-1 text-xs font-medium text-primary hover:bg-primary/10">Ver detalhes completos <ArrowRight className="size-3" /></button>
        </div>
      </Bloco>
      <footer className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-1.5 text-xs lg:col-span-12 print:hidden">
        <span><b>BMW Pós-Venda</b> <span className="text-muted-foreground">| Haus Salvador · Excelência no atendimento. Performance em cada detalhe.</span></span>
        <span className="flex flex-wrap gap-1.5">
          {whats}
          <button type="button" onClick={exportar} className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1 hover:bg-muted"><Download className="size-3.5" />Exportar CSV</button>
          <button type="button" onClick={imprimir} className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1 hover:bg-muted"><Printer className="size-3.5" />Imprimir / PDF</button>
          <button type="button" onClick={fechamento} className="flex items-center gap-1 rounded-md border border-primary px-2.5 py-1 text-primary hover:bg-primary/10"><Printer className="size-3.5" />Relatório de fechamento</button>
        </span>
      </footer>
    </div>
  );
}

/** Consultores (referência 16:9): 4 KPIs, ranking geral e rodapé com evolução, mix e departamentos. */
export function ConsultoresTela({ linhas, porDept, total, sales, mes, tot, dec, setTab, soPecas }: {
  linhas: L[]; porDept: D[]; total: PerformanceCalc; sales: S[]; mes: string; tot: number; dec: number; setTab: (t: string) => void; soPecas: (n: string) => boolean;
}) {
  const [pass, setPass] = useState<Record<string, number>>({});
  useEffect(() => {
    const [y, m] = mes.split("-").map(Number);
    void supabase.from("agg_visits").select("consultant_id,passagens").gte("dia", `${mes}-01`).lte("dia", `${mes}-${new Date(y!, m!, 0).getDate()}`).then(({ data }) => {
      const r: Record<string, number> = {}; for (const x of data ?? []) r[x.consultant_id] = (r[x.consultant_id] ?? 0) + +x.passagens; setPass(r);
    });
  }, [mes]);
  const rank = [...linhas].sort((a, b) => (b.meta ? b.perf : -1) - (a.meta ? a.perf : -1));
  const totPass = Object.values(pass).reduce((a, n) => a + n, 0);
  const t = total;
  return (
    <div className={`${GRID} lg:grid-cols-12 lg:grid-rows-[auto_auto_minmax(0,1.6fr)_minmax(0,1fr)]`}>
      <CabecalhoTela className="lg:col-span-12" titulo="Consultores" sub="Performance individual e coletiva do time de vendas." mes={mes} dec={dec} tot={tot} />
      <div className="grid grid-cols-2 gap-2 lg:col-span-12 lg:grid-cols-4">
        <KpiCard label="Total de consultores" value={uni(linhas.length)} sub={`${linhas.filter((l) => l.meta > 0).length} com meta no mês`} />
        <KpiCard label="Meta (M.O. + Peças)" value={brl(t.meta)} sub={`M.O. ${brl(t.mS)} · Peças ${brl(t.mP)}`} />
        <KpiCard label="Realizado" value={brl(t.real)} sub={`M.O. ${brl(t.servicos)} · Peças ${brl(t.pecas)}`} />
        <KpiCard label="Atingimento" value={pct(t.perf)} cls={tone(t.perf)} sub={`Projeção ${pct(t.projPct)}`} className={t.perf >= 1 ? "border-success/40" : t.perf >= 0.85 ? "border-warning/40" : "border-destructive/40"} />
      </div>
      <Bloco titulo="Ranking geral" icon={<Trophy className="size-4 text-warning" />} className="lg:col-span-12">
        <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm tabular-nums">
          <thead className="sticky top-0 bg-card text-[11px] text-muted-foreground"><tr className="text-right">
            <th className="w-8 py-1 text-left font-normal">#</th><th className="text-left font-normal">Consultor</th><th className="font-normal">Meta</th><th className="font-normal">Realizado</th><th className="font-normal">%</th><th className="font-normal">M.O.</th><th className="font-normal">Peças</th><th className="font-normal">Ticket médio</th><th className="font-normal">Passagens</th>
          </tr></thead>
          <tbody>{rank.map((l, i) => { const p = pass[l.c.id] ?? 0; const so = soPecas(l.c.nome); return (
            <tr key={l.c.id} className="border-t border-border/60 text-right">
              <td className="py-1.5 text-left"><span className={`inline-flex size-5 items-center justify-center rounded-full text-[10px] font-bold ${i === 0 ? "bg-warning text-background" : i === 1 ? "bg-muted-foreground text-background" : i === 2 ? "bg-coral text-background" : "text-muted-foreground"}`}>{i + 1}</span></td>
              <td className="text-left font-semibold">{l.c.nome}</td>
              <td className="text-muted-foreground">{brl(l.meta)}</td><td>{brl(l.real)}</td>
              <td className={`font-bold ${l.meta ? tone(l.perf) : ""}`}>{l.meta ? pct(l.perf) : "—"}</td>
              <td className="text-xs">{so ? "—" : <>{brl(l.servicos)} <span className={tone(l.perfS)}>{l.mS ? pct(l.perfS) : ""}</span></>}</td>
              <td className="text-xs">{brl(l.pecas)} <span className={tone(l.perfP)}>{l.mP ? pct(l.perfP) : ""}</span></td>
              <td>{p ? brl(div(l.real, p)) : "—"}</td><td>{p ? uni(p) : "—"}</td>
            </tr>); })}
            {!rank.length && <tr><td colSpan={9} className="py-8 text-center text-muted-foreground">Sem consultores no mês.</td></tr>}
          </tbody>
          {rank.length > 0 && <tfoot><tr className="border-t border-border text-right font-bold"><td /><td className="py-1 text-left">TOTAL</td><td>{brl(t.meta)}</td><td>{brl(t.real)}</td><td className={tone(t.perf)}>{pct(t.perf)}</td><td>{brl(t.servicos)}</td><td>{brl(t.pecas)}</td><td>{totPass ? brl(div(t.real, totPass)) : "—"}</td><td>{totPass ? uni(totPass) : "—"}</td></tr></tfoot>}
        </table></div>
        <button type="button" onClick={() => setTab("proj-total")} className="mt-1.5 flex items-center gap-1 rounded-md border border-primary px-3 py-1 text-xs font-medium text-primary hover:bg-primary/10"><Users className="size-3.5" />Ver detalhes de cada consultor <ArrowRight className="size-3" /></button>
      </Bloco>
      <Bloco titulo="Evolução do time" icon={<TrendingUp className="size-4 text-primary" />} className="lg:col-span-5">
        <GraficoEvolucao sales={sales} ids={linhas.map((l) => l.c.id)} meta={t.meta} mes={mes} />
      </Bloco>
      <div className="min-h-0 overflow-auto lg:col-span-4 [&_.lux-card]:h-full"><MixConsultores mes={mes} /></div>
      <Bloco titulo="Desempenho por departamento" icon={<Target className="size-4 text-primary" />} className="lg:col-span-3 [&_h2]:text-primary">
        <div className="flex h-full flex-wrap items-center justify-around gap-2">
          <Anel p={t.perfS} rot="M.O." /><Anel p={t.perfP} rot="Peças" /><Anel p={t.projPct} rot="Projeção" />
        </div>
        <ul className="mt-1 space-y-0.5 text-[11px]">{porDept.slice(0, 4).map((d) => <li key={d.nome} className="flex justify-between"><span className="truncate text-muted-foreground">{d.nome}</span><b className={tone(d.projPct)}>{pct(d.projPct)}</b></li>)}</ul>
      </Bloco>
    </div>
  );
}
