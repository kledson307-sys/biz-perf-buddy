import { useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { daLoja, resumir, type NpsItem } from "@/lib/nps";
import { useResumoMes } from "@/hooks/use-resumo-mes";
import { AlertTriangle, ArrowRight, CalendarDays, ClipboardList, MapPin, Package, Star, Target, TrendingUp, Trophy, Wrench } from "lucide-react";
import { ITENS } from "@/lib/agregados";
import { bg, brl, div, pct, tone, uni } from "@/components/painel-ui";
import { lerOficinaMes } from "@/lib/oficina-mes";
import type { Diario } from "@/lib/diario-retorno";
import farois from "@/assets/hero-farois.jpg";

type L = { c: { id: string; nome: string; department_id: string | null }; servicos: number; pecas: number; mS: number; mP: number; perf: number; projPct: number };
type D = { nome: string; servicos: number; pecas: number; meta: number; projPct: number };
type S = { consultant_id: string; dia: string; servicos: number; pecas: number };

export function Bloco({ titulo, icon, ir, children, right, className = "" }: { titulo: string; icon?: ReactNode; ir?: () => void; children: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <section className={`lux-card flex min-h-0 flex-col p-3 ${className}`}>
      <div className="mb-1.5 flex shrink-0 items-center justify-between gap-2">
        <h2 className="flex min-w-0 items-center gap-2 truncate whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{icon}{titulo}</h2>
        <div className="flex items-center gap-2">{right}{ir && <button type="button" onClick={ir} className="flex shrink-0 items-center gap-1 whitespace-nowrap text-[11px] font-medium text-primary hover:underline">Ver <ArrowRight className="size-3" /></button>}</div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
    </section>
  );
}

export function Linha({ p, cor }: { p: number; cor?: string }) {
  return <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${cor ?? bg(p)}`} style={{ width: `${Math.min(Math.max(p, 0) * 100, 100)}%` }} /></div>;
}

export function Anel({ p, rot }: { p: number; rot: string }) {
  const r = 30, c = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <svg viewBox="0 0 80 80" className="size-12" role="img" aria-label={`${rot} ${pct(p)}`}>
        <circle cx="40" cy="40" r={r} fill="none" strokeWidth="7" className="stroke-muted" />
        <circle cx="40" cy="40" r={r} fill="none" strokeWidth="7" strokeLinecap="round" strokeDasharray={`${Math.min(p, 1) * c} ${c}`} transform="rotate(-90 40 40)"
          className={p >= 1 ? "stroke-success" : p >= 0.85 ? "stroke-warning" : "stroke-destructive"} />
        <text x="40" y="44" textAnchor="middle" className="fill-foreground text-[13px] font-bold">{pct(p)}</text>
      </svg>
      <span className="text-[11px] leading-tight text-muted-foreground">{rot}</span>
    </div>
  );
}

export function Cockpit({ linhas, porDept, mes, tot, dec, soPecas, setTab, sales = [], nome = "", deptName }: {
  linhas: L[]; porDept: D[]; mes: string; tot: number; dec: number; soPecas: (n: string) => boolean; setTab: (t: string) => void;
  sales?: S[]; nome?: string; deptName?: (id: string | null) => string;
}) {
  const [comOs, setComOs] = useState(true);
  const { os, pass, agg, mec, fluxo, parados, amarelos } = useResumoMes(mes);
  const [nps, setNps] = useState<ReturnType<typeof resumir> | null>(null);
  useEffect(() => { void supabase.from("nps_imports").select("itens").order("at", { ascending: false }).limit(1).maybeSingle().then(({ data }) => { const l = daLoja((data?.itens as unknown as NpsItem[]) ?? []); setNps(l.length ? resumir(l) : null); }); }, []);

  // Faturamento por data real (planilhas Peças/Passagens), quando importado.
  const [real, setReal] = useState<Diario>({});
  useEffect(() => { const f = () => void lerOficinaMes(mes).then((x) => setReal(x.diario)); f(); window.addEventListener("oficina-mes-atualizada", f); return () => window.removeEventListener("oficina-mes-atualizada", f); }, [mes]);
  const usaReal = Object.keys(real).length > 1;
  // Comparação com o mês anterior até o mesmo dia do mês.
  const [ant, setAnt] = useState<{ s: number; p: number } | null>(null);
  const diaCorte = useMemo(() => sales.reduce((m, x) => Math.max(m, Number(x.dia.slice(8, 10))), 0), [sales]);
  useEffect(() => {
    const [a, m] = mes.split("-").map(Number); const pa = m === 1 ? a! - 1 : a!, pm = m === 1 ? 12 : m! - 1;
    const ini = `${pa}-${String(pm).padStart(2, "0")}-01`, fimDia = Math.min(diaCorte || 31, new Date(pa, pm, 0).getDate());
    const fim = `${pa}-${String(pm).padStart(2, "0")}-${String(fimDia).padStart(2, "0")}`;
    const ids = linhas.map((l) => l.c.id); if (!ids.length) { setAnt(null); return; }
    void supabase.from("daily_sales").select("consultant_id,servicos,pecas").gte("dia", ini).lte("dia", fim).in("consultant_id", ids).then(({ data }) => {
      if (!data?.length) { setAnt(null); return; }
      const so = new Set(linhas.filter((l) => soPecas(l.c.nome)).map((l) => l.c.id));
      setAnt(data.reduce((x, r) => ({ s: x.s + (so.has(r.consultant_id) ? 0 : +r.servicos), p: x.p + +r.pecas }), { s: 0, p: 0 }));
    });
  }, [mes, diaCorte, linhas, soPecas]);
  const rest = Math.max(tot - dec, 0);
  const t = linhas.reduce((a, l) => {
    const so = soPecas(l.c.nome); const o = os[l.c.id] ?? { s: 0, p: 0 };
    return { s: a.s + (so ? 0 : l.servicos), p: a.p + l.pecas, ms: a.ms + (so ? 0 : l.mS), mp: a.mp + l.mP, os: a.os + (so ? 0 : o.s), op: a.op + o.p };
  }, { s: 0, p: 0, ms: 0, mp: 0, os: 0, op: 0 });
  const proj = (v: number) => (dec ? div(v, dec) * tot : 0);
  const pS = proj(t.s + (comOs ? t.os : 0)), pP = proj(t.p + (comOs ? t.op : 0));
  const altS = proj(t.s + (comOs ? 0 : t.os)), altP = proj(t.p + (comOs ? 0 : t.op));
  const metaT = t.ms + t.mp, pT = pS + pP;
  const ratio = div(t.p, t.s);
  const abaixo = linhas.filter((l) => l.mS + l.mP > 0 && l.projPct < 0.85).sort((a, b) => a.projPct - b.projPct);
  const ranking = [...linhas].filter((l) => l.mS + l.mP > 0).sort((a, b) => b.perf - a.perf);
  const deptFraco = [...porDept].filter((d) => d.meta > 0).sort((a, b) => a.projPct - b.projPct)[0];
  const [, mm] = mes.split("-").map(Number);
  const mesNome = new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(new Date(2000, (mm ?? 1) - 1, 1));
  const primeiro = (nome.split(/[.\-_\d]/)[0] ?? "").replace(/^./, (c) => c.toUpperCase()) || "Gestor";

  // Evolução: acumulado diário (serviços + peças) vs linha ideal da meta.
  const evol = useMemo(() => {
    const ids = new Set(linhas.map((l) => l.c.id));
    const porDia = new Map<string, number>();
    if (usaReal) for (const [d, v] of Object.entries(real)) porDia.set(d, (v.s ?? 0) + (v.p ?? 0));
    else for (const s of sales) if (ids.has(s.consultant_id)) porDia.set(s.dia, (porDia.get(s.dia) ?? 0) + +s.servicos + +s.pecas);
    let acc = 0;
    const pts = [...porDia.keys()].sort().map((d) => ({ d: Number(d.slice(8, 10)), v: (acc += porDia.get(d)!) }));
    return pts.length ? [{ d: 0, v: 0 }, ...pts] : pts;
  }, [sales, linhas, usaReal, real]);
  const [yy, mo] = mes.split("-").map(Number);
  const diasMes = new Date(yy!, mo!, 0).getDate();
  const maxY = Math.max(metaT, evol.at(-1)?.v ?? 0, 1);
  const W = 600, H = 120;
  const px = (d: number) => (d / diasMes) * W, py = (v: number) => H - (v / maxY) * (H - 10);
  const caminho = evol.map((p, i) => `${i ? "L" : "M"}${px(p.d).toFixed(1)},${py(p.v).toFixed(1)}`).join(" ");

  const acoes: { cor: string; txt: string; ir: string }[] = [];
  if (abaixo[0]) acoes.push({ cor: "bg-destructive", txt: `Conversar com ${abaixo[0].c.nome}: projeção em ${pct(abaixo[0].projPct)}.`, ir: "ranking" });
  if (parados) acoes.push({ cor: "bg-destructive", txt: `${parados} O.S. com mais de 30 dias na oficina.`, ir: "controle-os" });
  if (amarelos) acoes.push({ cor: "bg-warning", txt: `${amarelos} O.S. entre 21 e 30 dias — evitar que passem de 30.`, ir: "controle-os" });
  if (deptFraco && deptFraco.projPct < 1) acoes.push({ cor: "bg-warning", txt: `Foco em ${deptFraco.nome} (${pct(deptFraco.projPct)} da meta).`, ir: "painel" });
  if (t.s && ratio < 0.8) acoes.push({ cor: "bg-warning", txt: `Peças abaixo do esperado: ${ratio.toFixed(2).replace(".", ",")} de peça por R$ 1 de serviço.`, ir: "pecas" });

  if (nps && nps.pctProm < 0.85) acoes.push({ cor: "bg-warning", txt: `NPS: ${pct(nps.pctProm)} de promotores, abaixo da meta de 85%. Ver detratores e follow-up D-2.`, ir: "nps" });
  const resultado: [string, number, number, typeof Wrench, string][] = [
    ["Serviços", t.s, t.ms, Wrench, "bg-neon"], ["Peças", t.p, t.mp, Package, "bg-coral"], ["Faturamento total", t.s + t.p, metaT, TrendingUp, "bg-primary"],
  ];

  const pTot = div(pT, metaT);
  const aggRitmo = (() => { let q = 0, m = 0; for (const it of ITENS) { const a = agg[it.k]; if (a?.mq) { q += a.q; m += a.mq; } } return m && dec ? div(div(q, dec) * tot, m) : null; })();
  const st = (p: number | null) => p === null ? { r: "Sem dados", c: "bg-muted", t: "text-muted-foreground" } : p >= 1 ? { r: "Dentro da meta", c: "bg-success", t: "text-success" } : p >= 0.85 ? { r: "Atenção", c: "bg-warning", t: "text-warning" } : { r: "Crítico", c: "bg-destructive", t: "text-destructive" };
  const status: [string, number | null, string][] = [
    ["Serviços", div(pS, t.ms), "painel"], ["Peças", div(pP, t.mp), "pecas"], ["Oficina (serviços)", mec.ms ? div(mec.s, mec.ms) : null, "mecanicos"],
    ["NPS promotores", nps ? div(nps.pctProm, 0.85) : null, "nps"], ["Agregados (ritmo)", aggRitmo, "agregados"], ["Projeção mensal", pTot, "os"],
  ];
  const diario = useMemo(() => {
    const ids = new Set(linhas.map((l) => l.c.id)); const m = new Map<number, number>();
    if (usaReal) for (const [d, v] of Object.entries(real)) m.set(Number(d.slice(8, 10)), (v.s ?? 0) + (v.p ?? 0));
    else for (const s of sales) if (ids.has(s.consultant_id)) { const d = Number(s.dia.slice(8, 10)); m.set(d, (m.get(d) ?? 0) + +s.servicos + +s.pecas); }
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [sales, linhas, usaReal, real]);
  const maxDia = Math.max(1, ...diario.map(([, v]) => v));
  const resp: Record<string, string> = { ranking: "Consultores", "controle-os": "Oficina", painel: "Gestão", pecas: "Consultores", nps: "Consultores" };
  const lider = ranking[0];
  const res3: [string, number, number, typeof Wrench][] = [["Serviços", t.s, t.ms, Wrench], ["Peças", t.p, t.mp, Package], ["Total", t.s + t.p, metaT, TrendingUp]];
  const destaques: [string, string][] = [
    ["Ticket médio serviço", brl(div(t.s, pass))], ["Ticket médio peças", brl(div(t.p, pass))], ["Passagens no mês", uni(pass)],
    ["Peças por R$ 1 de serviço", ratio.toFixed(2).replace(".", ",")], ["Oficina (serviços)", mec.ms ? pct(div(mec.s, mec.ms)) : "—"],
  ];

  return (
    <div className="space-y-2 lg:grid lg:h-[calc(100dvh-7rem)] lg:min-h-[640px] lg:grid-cols-12 lg:grid-rows-[auto_minmax(0,1.05fr)_minmax(0,1.35fr)_minmax(0,1fr)_minmax(0,0.8fr)] lg:gap-2 lg:space-y-0">
      {/* Cabeçalho com faróis BMW */}
      <section className="relative flex flex-wrap items-center justify-between gap-2 overflow-hidden rounded-xl border border-border px-4 py-2 lg:col-span-12">
        <img src={farois} alt="" aria-hidden className="pointer-events-none absolute inset-y-0 right-0 h-full w-3/5 object-cover opacity-40 [mask-image:linear-gradient(to_left,black_40%,transparent)]" />
        <div className="relative"><h2 className="text-lg font-bold leading-tight">Olá, {primeiro}!</h2><p className="text-xs text-muted-foreground">Aqui está o resumo da performance do seu pós-venda.</p></div>
        <div className="relative flex flex-wrap gap-4 text-xs">
          <span className="flex items-center gap-2"><CalendarDays className="size-5 text-primary" /><span><b className="block capitalize">{mesNome}</b><span className="text-muted-foreground">dia útil {dec} de {tot}</span></span></span>
          <span className="flex items-center gap-2"><MapPin className="size-5 text-primary" /><span><b className="block">Haus Salvador</b><span className="text-muted-foreground">Concessionária BMW</span></span></span>
        </div>
      </section>

      {/* Linha 1 */}
      <Bloco titulo="Resultado do mês" icon={<Target className="size-4 text-primary" />} ir={() => setTab("painel")} className="lg:col-span-6">
        <div className="grid h-full gap-2 sm:grid-cols-3">{res3.map(([n, r, m, I]) => (
          <div key={n} className="flex flex-col justify-between rounded-lg border border-border bg-background/40 p-2">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase"><span className="flex size-6 items-center justify-center rounded-full bg-primary/20"><I className="size-3.5 text-primary" /></span>{n}</p>
            <div className="text-[11px] text-muted-foreground"><span>Realizado<b className="block text-base text-foreground">{brl(r)}</b></span><span>Meta <b className="font-normal text-foreground/80">{brl(m)}</b></span>
              {(() => { const base = ant ? (n === "Serviços" ? ant.s : n === "Peças" ? ant.p : ant.s + ant.p) : 0; if (!base) return <span className="block">vs mês anterior: —</span>; const v = r / base - 1;
                return <span className="block">vs mês ant. (até dia {diaCorte}): <b className={v >= 0 ? "text-success" : "text-destructive"}>{v >= 0 ? "▲" : "▼"} {pct(Math.abs(v))}</b> <span className="opacity-70">({brl(base)})</span></span>; })()}</div>
            <div className="flex items-center gap-2"><Linha p={div(r, m)} /><b className={`text-xs ${tone(div(r, m))}`}>{pct(div(r, m))}</b></div>
          </div>))}</div>
      </Bloco>
      <Bloco titulo="Projeção do mês" icon={<TrendingUp className="size-4 text-primary" />} className="relative overflow-hidden lg:col-span-3" right={
        <div className="flex rounded-full border border-border p-0.5 text-[10px]">
          <button type="button" onClick={() => setComOs(true)} className={`rounded-full px-2 py-0.5 ${comOs ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Com O.S.</button>
          <button type="button" onClick={() => setComOs(false)} className={`rounded-full px-2 py-0.5 ${!comOs ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Só faturado</button>
        </div>}>
        <img src={farois} alt="" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-25 [mask-image:linear-gradient(to_left,black,transparent)]" />
        <button type="button" onClick={() => setTab("os")} className="relative w-full text-left">
          <p className={`text-2xl font-bold ${tone(pTot)}`}>{brl(pT)}</p>
          <p className="text-sm"><b>{pct(pTot)}</b> <span className="text-xs text-muted-foreground">da meta {brl(metaT)}</span></p>
          <div className="mt-1.5 max-w-[70%]"><Linha p={pTot} cor="bg-primary" /></div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">Serviços <b className={tone(div(pS, t.ms))}>{pct(div(pS, t.ms))}</b> · Peças <b className={tone(div(pP, t.mp))}>{pct(div(pP, t.mp))}</b></p>
          <p className="text-[11px] text-muted-foreground">{comOs ? "Só faturado" : "Com O.S."}: {brl(altS + altP)}</p>
        </button>
      </Bloco>
      <Bloco titulo="Status da operação" icon={<ClipboardList className="size-4 text-primary" />} className="lg:col-span-3">
        <ul className="space-y-0.5 text-xs">{status.map(([n, p, ir]) => { const s = st(p); return (
          <li key={n}><button type="button" onClick={() => setTab(ir)} className="flex w-full items-center gap-2 rounded px-1 py-0.5 hover:bg-muted">
            <span className={`size-2.5 shrink-0 rounded-full ${s.c}`} /><span className="flex-1 text-left">{n}</span><span className={`text-[11px] ${s.t}`}>{s.r}</span><b className="w-11 text-right">{p === null ? "—" : pct(p)}</b>
          </button></li>); })}</ul>
      </Bloco>

      {/* Linha 2 */}
      <Bloco titulo="Onde devo atuar hoje?" icon={<AlertTriangle className="size-4 text-destructive" />} className="border-destructive/50 lg:col-span-3">
        {deptFraco && deptFraco.projPct < 1 ? (
          <div className="rounded-lg border-l-4 border-destructive bg-destructive/10 p-2 text-xs">
            <div className="flex items-center justify-between"><b className="uppercase">{deptFraco.nome}</b><span className="rounded bg-destructive px-1.5 py-0.5 text-[10px] font-bold text-destructive-foreground">{deptFraco.projPct < 0.85 ? "CRÍTICO" : "ATENÇÃO"}</span></div>
            <div className="mt-1 grid grid-cols-2 gap-1"><span className="text-muted-foreground">Gap atual<b className="block text-sm text-destructive">{brl(Math.max(deptFraco.meta - deptFraco.servicos - deptFraco.pecas, 0))}</b></span>
              <span className="text-muted-foreground">Necessário por dia<b className="block text-sm text-foreground">{brl(rest ? Math.max(deptFraco.meta - deptFraco.servicos - deptFraco.pecas, 0) / rest : 0)}</b></span></div>
          </div>) : <p className="text-sm text-success">✅ Todos os departamentos no ritmo.</p>}
        <ul className="mt-1.5 space-y-1">{acoes.slice(0, 3).map((a, i) => (
          <li key={i}><button type="button" onClick={() => setTab(a.ir)} className="flex w-full items-start gap-2 rounded bg-background/40 px-2 py-1 text-left text-[11px] hover:bg-muted">
            <span className={`mt-1 size-2 shrink-0 rounded-full ${a.cor}`} /><span className="flex-1">{a.txt}</span><ArrowRight className="size-3.5 shrink-0 text-primary" />
          </button></li>))}</ul>
      </Bloco>
      <Bloco titulo="Evolução do mês" icon={<TrendingUp className="size-4 text-primary" />} ir={() => setTab("painel")} className="lg:col-span-3">
        {evol.length === 0 ? <p className="text-sm text-muted-foreground">Sem vendas importadas neste mês.</p> : (
          <svg viewBox={`0 0 ${W} ${H + 18}`} preserveAspectRatio="none" className="h-[calc(100%-1.25rem)] min-h-24 w-full" role="img" aria-label="Faturamento acumulado do mês contra a meta">
            {[0.25, 0.5, 0.75, 1].map((f) => <line key={f} x1="0" x2={W} y1={py(maxY * f)} y2={py(maxY * f)} className="stroke-border" strokeWidth="1" />)}
            <line x1="0" y1={H} x2={W} y2={py(metaT)} className="stroke-muted-foreground" strokeWidth="1.5" strokeDasharray="5 5" />
            <path d={`${caminho} L${px(evol.at(-1)!.d)},${H} L${px(evol[0]!.d)},${H} Z`} fill="var(--primary)" fillOpacity="0.15" />
            <path d={caminho} fill="none" stroke="var(--primary)" strokeWidth="2.5" />
            <circle cx={px(evol.at(-1)!.d)} cy={py(evol.at(-1)!.v)} r="4" fill="var(--primary)" />
            {[1, 10, 20, diasMes].map((d) => <text key={d} x={Math.min(px(d), W - 12)} y={H + 14} className="fill-muted-foreground text-[10px]">{d}</text>)}
          </svg>)}
        <p className="flex gap-4 text-[11px] text-muted-foreground"><span><span className="mr-1 inline-block h-0.5 w-4 bg-primary align-middle" />Realizado</span><span>- - - Meta</span>{usaReal && <span>· por data real das O.S.</span>}</p>
      </Bloco>
      <Bloco titulo="Ranking dos consultores" icon={<Trophy className="size-4 text-warning" />} ir={() => setTab("ranking")} className="lg:col-span-3">
        <ol className="space-y-1">{ranking.slice(0, 5).map((l, i) => (
          <li key={l.c.id} className="flex items-center gap-2 text-xs">
            <span className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${i === 0 ? "bg-warning text-background" : i === 1 ? "bg-muted-foreground text-background" : i === 2 ? "bg-coral text-background" : "bg-muted"}`}>{i + 1}</span>
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">{l.c.nome.slice(0, 2)}</span>
            <div className="min-w-0 flex-1"><p className="truncate font-semibold">{l.c.nome}</p><Linha p={l.perf} /></div>
            <span className="text-right"><b className={tone(l.perf)}>{pct(l.perf)}</b><span className="block text-[10px] text-muted-foreground">{brl(l.servicos + l.pecas)}</span></span>
          </li>))}</ol>
      </Bloco>
      <Bloco titulo="Desempenho por departamento" icon={<Target className="size-4 text-primary" />} ir={() => setTab("painel")} className="lg:col-span-3">
        <div className="flex flex-wrap justify-around gap-1">{porDept.slice(0, 5).map((d) => <Anel key={d.nome} p={d.projPct} rot={d.nome} />)}</div>
        <p className="mt-1 text-[11px] text-muted-foreground">Faturamento total <b className="ml-1 text-sm text-foreground">{brl(t.s + t.p)}</b></p>
        {diario.length > 1 && <div className="mt-1 flex h-10 items-end gap-0.5" aria-label="Faturamento por dia">{diario.map(([d, v]) => <div key={d} title={`Dia ${d}: ${brl(v)}`} className="flex-1 rounded-t bg-primary" style={{ height: `${Math.max(div(v, maxDia) * 100, 4)}%` }} />)}</div>}
      </Bloco>

      {/* Linha 3 */}
      <Bloco titulo="Desempenho dos agregados" icon={<Package className="size-4 text-neon" />} ir={() => setTab("agregados")} className="lg:col-span-4 border-neon/40">
        {(() => {
          const fams = ITENS.map((it) => ({ it, a: agg[it.k] })).filter((x) => x.a && (x.a.mq || x.a.q));
          const q = fams.reduce((m, x) => m + x.a!.q, 0), v = fams.reduce((m, x) => m + x.a!.v, 0);
          if (!fams.length) return <p className="text-sm text-muted-foreground">Sem agregados importados neste mês.</p>;
          return <>
            <div className="flex flex-wrap justify-around gap-1">{fams.slice(0, 6).map(({ it, a }) => <Anel key={it.k} p={a!.mq && dec ? div(div(a!.q, dec) * tot, a!.mq) : 0} rot={it.nome} />)}</div>
            <p className="mt-1 flex flex-wrap justify-between gap-2 text-[11px] text-muted-foreground"><span>Vendidos <b className="text-neon">{uni(q)} un.</b></span><span>Faturamento <b className="text-foreground">{brl(v)}</b></span>{pass > 0 && <span>Aproveit. <b className="text-foreground">{div(q, pass).toFixed(1).replace(".", ",")} un./passagem</b></span>}</p>
          </>;
        })()}
      </Bloco>
      <Bloco titulo="Destaques do mês" icon={<Star className="size-4 text-primary" />} className="lg:col-span-4">
        <ul className="space-y-0.5 text-xs">{destaques.map(([n, v]) => <li key={n} className="flex justify-between border-b border-border/50 py-0.5"><span className="text-muted-foreground">{n}</span><b>{v}</b></li>)}
          {lider && <li className="flex justify-between py-0.5"><span className="text-muted-foreground">Líder do ranking</span><b className="text-warning">{lider.c.nome}</b></li>}</ul>
      </Bloco>
      <Bloco titulo="Próximas ações" icon={<ClipboardList className="size-4 text-primary" />} className="lg:col-span-4">
        {acoes.length === 0 ? <p className="text-sm text-success">Nenhuma ação pendente.</p> :
          <table className="w-full text-[11px]"><thead className="text-left text-muted-foreground"><tr><th className="font-normal">Ação</th><th className="font-normal">Responsável</th><th className="font-normal">Prazo</th><th className="font-normal">Status</th></tr></thead>
            <tbody>{acoes.map((a, i) => <tr key={i} className="cursor-pointer hover:bg-muted" onClick={() => setTab(a.ir)}><td className="max-w-[12rem] truncate py-0.5"><span className={`mr-1 inline-block size-2 rounded-full ${a.cor}`} />{a.txt}</td><td>{resp[a.ir] ?? "Gestão"}</td><td>Hoje</td><td className="text-destructive">Pendente</td></tr>)}</tbody></table>}
      </Bloco>

      {/* Linha 4 */}
      <Bloco titulo="Ordens de serviço" icon={<ClipboardList className="size-4 text-primary" />} ir={() => setTab("controle-os")} className="lg:col-span-4">
        {fluxo.length === 0 ? <p className="text-sm text-muted-foreground">Sem importação semanal.</p> :
          <div className="flex gap-1.5">{fluxo.slice(0, 6).map((f) => <div key={f.st} className="min-w-0 flex-1 rounded-lg border border-border bg-background/40 px-1.5 py-1"><p className="truncate text-[10px] text-muted-foreground">{f.st}</p><p className="text-base font-bold">{f.n}</p></div>)}
            <div className="rounded-lg border border-border bg-background/40 px-2 py-1 text-[10px]"><p className="text-muted-foreground">Na oficina</p><p className="text-warning">{amarelos} &gt;20d</p><p className="text-destructive">{parados} &gt;30d</p></div></div>}
      </Bloco>
      <Bloco titulo="Agendamentos de amanhã (D+1)" icon={<CalendarDays className="size-4 text-primary" />} ir={() => setTab("agendamentos")} className="lg:col-span-3">
        <CartaoAgendamento mes={mes} />
      </Bloco>
      <Bloco titulo="NPS / qualidade" icon={<Star className="size-4 text-primary" />} ir={() => setTab("nps")} className="lg:col-span-2">
        {!nps ? <p className="text-sm text-muted-foreground">Aguardando planilha NPS.</p> :
          <div className="grid grid-cols-4 gap-1 text-center">{([["NPS", `${(nps.nps * 100).toFixed(1).replace(".", ",")}`, nps.nps >= 0.7], ["Promot.", pct(nps.pctProm), nps.pctProm >= 0.85], ["Detrat.", uni(nps.det), nps.det === 0], ["RAC", uni(nps.racs), nps.racs === 0]] as [string, string, boolean][]).map(([n, v, ok]) => (
            <div key={n} className="rounded-lg border border-border bg-background/40 py-1"><p className="text-[10px] text-muted-foreground">{n}</p><p className={`text-sm font-bold ${ok ? "text-success" : "text-warning"}`}>{v}</p></div>))}</div>}
      </Bloco>
      <Bloco titulo="Metas" icon={<Target className="size-4 text-primary" />} ir={() => setTab("metas")} className="lg:col-span-4">
        <table className="w-full text-[10px] [&_td]:px-0.5"><thead className="text-muted-foreground"><tr><th className="text-left font-normal">Mensal</th><th className="text-right font-normal">Meta</th><th className="text-right font-normal">Realizado</th><th className="text-right font-normal">Ating.</th><th className="text-right font-normal">Gap</th></tr></thead>
          <tbody>{res3.map(([n, r, m]) => <tr key={n}><td>{n}</td><td className="text-right">{brl(m)}</td><td className="text-right">{brl(r)}</td><td className={`text-right font-semibold ${tone(div(r, m))}`}>{pct(div(r, m))}</td><td className="text-right text-destructive">{brl(Math.min(r - m, 0))}</td></tr>)}</tbody></table>
      </Bloco>
    </div>
  );
}
