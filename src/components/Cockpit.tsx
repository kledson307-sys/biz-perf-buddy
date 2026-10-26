import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, ArrowRight, CalendarDays, Car, ClipboardList, Gem, MapPin, Package, Star, Target, TrendingUp, Trophy, Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { loadOpenOrders, type OpenOrders } from "@/lib/open-orders.functions";
import { ITENS } from "@/lib/agregados";
import { STATUS, type OsImport } from "@/lib/os-controle";
import { bg, brl, div, pct, tone, uni } from "@/components/painel-ui";
import heroFarois from "@/assets/hero-farois.jpg";
import carroSilhueta from "@/assets/carro-silhueta.jpg";

type L = { c: { id: string; nome: string; department_id: string | null }; servicos: number; pecas: number; mS: number; mP: number; perf: number; projPct: number };
type D = { nome: string; servicos: number; pecas: number; meta: number; projPct: number };
type S = { consultant_id: string; dia: string; servicos: number; pecas: number };

function Bloco({ titulo, icon, ir, children, right, className = "" }: { titulo: string; icon?: ReactNode; ir?: () => void; children: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <section className={`lux-card p-4 ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">{icon}{titulo}</h2>
        <div className="flex items-center gap-2">{right}{ir && <button type="button" onClick={ir} className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">Ver detalhes <ArrowRight className="size-3" /></button>}</div>
      </div>
      {children}
    </section>
  );
}

function Linha({ p, cor }: { p: number; cor?: string }) {
  return <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${cor ?? bg(p)}`} style={{ width: `${Math.min(Math.max(p, 0) * 100, 100)}%` }} /></div>;
}

function Anel({ p, rot }: { p: number; rot: string }) {
  const r = 30, c = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <svg viewBox="0 0 80 80" className="size-20" role="img" aria-label={`${rot} ${pct(p)}`}>
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
  const [os, setOs] = useState<OpenOrders>({});
  const [pass, setPass] = useState(0);
  const [agg, setAgg] = useState<Record<string, { q: number; v: number; mq: number }>>({});
  const [mec, setMec] = useState({ s: 0, p: 0, ms: 0, mp: 0, pass: 0 });
  const [fluxo, setFluxo] = useState<{ st: string; n: number }[]>([]);
  const [parados, setParados] = useState(0);
  const [amarelos, setAmarelos] = useState(0);

  useEffect(() => {
    let off = false;
    const [y, m] = mes.split("-").map(Number);
    const fim = `${mes}-${new Date(y!, m!, 0).getDate()}`;
    void (async () => {
      const [o, v, s, g, mm, oi] = await Promise.all([
        loadOpenOrders({ data: { mes } }).catch(() => null),
        supabase.from("agg_visits").select("passagens").gte("dia", `${mes}-01`).lte("dia", fim),
        supabase.from("agg_sales").select("item,qtd,valor").gte("dia", `${mes}-01`).lte("dia", fim),
        supabase.from("agg_goals").select("item,meta_qtd").eq("mes", mes),
        supabase.from("mech_month").select("servicos,pecas,meta_servicos,meta_pecas,passagens").eq("mes", mes),
        supabase.from("os_imports").select("id,at,nome,arquivo,itens").order("at", { ascending: false }).limit(1),
      ]);
      if (off) return;
      setOs(o?.valores ?? {});
      setPass((v.data ?? []).reduce((a, x) => a + +x.passagens, 0));
      const a: Record<string, { q: number; v: number; mq: number }> = {};
      for (const x of s.data ?? []) { const r = (a[x.item] ??= { q: 0, v: 0, mq: 0 }); r.q += +x.qtd; r.v += +x.valor; }
      for (const x of g.data ?? []) { const r = (a[x.item] ??= { q: 0, v: 0, mq: 0 }); r.mq += +x.meta_qtd; }
      setAgg(a);
      setMec((mm.data ?? []).reduce((t, x) => ({ s: t.s + +x.servicos, p: t.p + +x.pecas, ms: t.ms + +x.meta_servicos, mp: t.mp + +x.meta_pecas, pass: t.pass + +x.passagens }), { s: 0, p: 0, ms: 0, mp: 0, pass: 0 }));
      const itens = ((oi.data?.[0] as unknown as OsImport | undefined)?.itens ?? []);
      setFluxo(STATUS.filter((x) => x.k !== "encerrado").map((x) => ({ st: x.nome, n: itens.filter((i) => i.st === x.k).length })).filter((x) => x.n));
      setParados(itens.filter((i) => i.dias > 30 && i.st !== "encerrado").length);
      setAmarelos(itens.filter((i) => i.dias > 20 && i.dias <= 30 && i.st !== "encerrado").length);
    })();
    return () => { off = true; };
  }, [mes]);

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
    for (const s of sales) if (ids.has(s.consultant_id)) porDia.set(s.dia, (porDia.get(s.dia) ?? 0) + +s.servicos + +s.pecas);
    let acc = 0;
    const pts = [...porDia.keys()].sort().map((d) => ({ d: Number(d.slice(8, 10)), v: (acc += porDia.get(d)!) }));
    return pts.length ? [{ d: 0, v: 0 }, ...pts] : pts;
  }, [sales, linhas]);
  const [yy, mo] = mes.split("-").map(Number);
  const diasMes = new Date(yy!, mo!, 0).getDate();
  const maxY = Math.max(metaT, evol.at(-1)?.v ?? 0, 1);
  const W = 600, H = 180;
  const px = (d: number) => (d / diasMes) * W, py = (v: number) => H - (v / maxY) * (H - 10);
  const caminho = evol.map((p, i) => `${i ? "L" : "M"}${px(p.d).toFixed(1)},${py(p.v).toFixed(1)}`).join(" ");

  const acoes: { cor: string; txt: string; ir: string }[] = [];
  if (abaixo[0]) acoes.push({ cor: "bg-destructive", txt: `Conversar com ${abaixo[0].c.nome}: projeção em ${pct(abaixo[0].projPct)}.`, ir: "ranking" });
  if (parados) acoes.push({ cor: "bg-destructive", txt: `${parados} O.S. com mais de 30 dias na oficina.`, ir: "controle-os" });
  if (amarelos) acoes.push({ cor: "bg-warning", txt: `${amarelos} O.S. entre 21 e 30 dias — evitar que passem de 30.`, ir: "controle-os" });
  if (deptFraco && deptFraco.projPct < 1) acoes.push({ cor: "bg-warning", txt: `Foco em ${deptFraco.nome} (${pct(deptFraco.projPct)} da meta).`, ir: "painel" });
  if (t.s && ratio < 0.8) acoes.push({ cor: "bg-warning", txt: `Peças abaixo do esperado: ${ratio.toFixed(2).replace(".", ",")} de peça por R$ 1 de serviço.`, ir: "pecas" });

  const resultado: [string, number, number, typeof Wrench, string][] = [
    ["Serviços", t.s, t.ms, Wrench, "bg-neon"], ["Peças", t.p, t.mp, Package, "bg-coral"], ["Faturamento total", t.s + t.p, metaT, TrendingUp, "bg-primary"],
  ];

  return (
    <div className="space-y-4">
      {/* Cabeçalho executivo com faróis */}
      <section className="relative overflow-hidden rounded-2xl border border-border">
        <img src={heroFarois} alt="Dianteira BMW com faróis LED acesos" width={1600} height={560} className="absolute inset-0 size-full object-cover object-right" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/10" />
        <div className="relative space-y-3 p-5 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">BMW Pós-Venda · Haus Motors</p>
          <h2 className="text-2xl font-bold sm:text-3xl">Olá, {primeiro}!</h2>
          <p className="max-w-md text-sm text-muted-foreground">Aqui está o resumo do seu pós-venda hoje.</p>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="flex items-center gap-1.5 rounded-full border border-border bg-card/70 px-3 py-1"><CalendarDays className="size-3.5 text-primary" />{mesNome} · dia {dec} de {tot}</span>
            <span className="flex items-center gap-1.5 rounded-full border border-border bg-card/70 px-3 py-1"><MapPin className="size-3.5 text-primary" />Salvador</span>
            <span className={`flex items-center gap-1.5 rounded-full border border-border bg-card/70 px-3 py-1 font-semibold ${tone(div(pT, metaT))}`}><Target className="size-3.5" />Projeção {pct(div(pT, metaT))}</span>
          </div>
        </div>
      </section>

      {/* Resultado do mês */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {resultado.map(([n, r, m, I, cor]) => (
          <button key={n} type="button" onClick={() => setTab("painel")} className="lux-card col-span-1 p-4 text-left">
            <div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">{n}</p><I strokeWidth={1.5} className="size-5 text-primary" /></div>
            <p className="mt-1 text-lg font-bold sm:text-xl">{brl(r)}</p>
            <div className="my-2"><Linha p={div(r, m)} cor={cor} /></div>
            <p className={`text-xs font-semibold ${tone(div(r, m))}`}>{pct(div(r, m))} <span className="font-normal text-muted-foreground">de {brl(m)}</span></p>
          </button>
        ))}
        <button type="button" onClick={() => setTab("agregados")} className="lux-card p-4 text-left">
          <p className="text-xs text-muted-foreground">Ticket médio</p>
          <p className="mt-1 text-sm">Serviços <b>{brl(div(t.s, pass))}</b></p>
          <p className="text-sm">Peças <b>{brl(div(t.p, pass))}</b></p>
          <p className="text-sm">Passagens <b>{uni(pass)}</b></p>
        </button>
        <button type="button" onClick={() => setTab("nps")} className="lux-card col-span-2 border-dashed p-4 text-left lg:col-span-1">
          <div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">NPS / CSI</p><Star strokeWidth={1.5} className="size-5 text-primary" /></div>
          <p className="mt-1 text-xl font-bold text-muted-foreground">—</p>
          <p className="text-xs text-muted-foreground">Em estruturação</p>
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Projeção do mês */}
        <Bloco titulo="Projeção do mês" icon={<TrendingUp className="size-4 text-primary" />} ir={() => setTab("os")} className="relative overflow-hidden lg:col-span-2" right={
          <div className="flex rounded-full border border-border p-0.5 text-[11px]">
            <button type="button" onClick={() => setComOs(true)} className={`rounded-full px-2.5 py-1 ${comOs ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Com O.S. abertas</button>
            <button type="button" onClick={() => setComOs(false)} className={`rounded-full px-2.5 py-1 ${!comOs ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Só faturado</button>
          </div>}>
          <img src={carroSilhueta} alt="" aria-hidden loading="lazy" width={1152} height={576} className="pointer-events-none absolute -bottom-6 right-0 w-1/2 opacity-30 mix-blend-screen" />
          <div className="relative">
            <p className={`text-3xl font-bold ${tone(div(pT, metaT))}`}>{brl(pT)}</p>
            <p className="text-xs text-muted-foreground">{pct(div(pT, metaT))} da meta {brl(metaT)} · {comOs ? "com O.S. abertas" : "somente faturado"}</p>
            <div className="mt-2 max-w-md"><Linha p={div(pT, metaT)} cor="bg-neon" /></div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[["Serviços", pS, t.ms, altS, t.s + (comOs ? t.os : 0)], ["Peças", pP, t.mp, altP, t.p + (comOs ? t.op : 0)]].map(([n, p, m, alt, base]) => (
                <div key={n as string} className="rounded-lg border border-border bg-background/40 p-3">
                  <p className="text-xs text-muted-foreground">Projeção {n}</p>
                  <p className={`text-lg font-bold ${tone(div(p as number, m as number))}`}>{brl(p as number)} <span className="text-sm">{pct(div(p as number, m as number))}</span></p>
                  <p className="text-xs text-muted-foreground">Meta {brl(m as number)} · precisa {brl(rest ? Math.max((m as number) - (base as number), 0) / rest : 0)}/dia</p>
                  <p className="text-xs text-muted-foreground">{comOs ? "Só faturado" : "Com O.S."}: {brl(alt as number)} ({pct(div(alt as number, m as number))})</p>
                </div>
              ))}
            </div>
          </div>
        </Bloco>

        {/* Onde devo atuar hoje */}
        <Bloco titulo="Onde devo atuar hoje?" icon={<AlertTriangle className="size-4 text-destructive" />} className="border-destructive/50">
          {acoes.length === 0 ? <p className="text-sm text-success">✅ Nenhum ponto crítico agora. Mantenha o ritmo.</p> :
            <ul className="space-y-2">{acoes.map((a, i) => (
              <li key={i}><button type="button" onClick={() => setTab(a.ir)} className="flex w-full items-start gap-2 rounded-lg bg-background/40 p-2 text-left text-sm hover:bg-muted">
                <span className={`mt-1.5 size-2 shrink-0 rounded-full ${a.cor}`} /><span className="flex-1">{a.txt}</span><ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              </button></li>
            ))}</ul>}
          {abaixo.length > 1 && <p className="mt-3 text-xs text-muted-foreground">Abaixo de 85%: {abaixo.map((l) => l.c.nome).join(", ")}</p>}
        </Bloco>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Evolução do mês */}
        <Bloco titulo="Evolução do mês" icon={<TrendingUp className="size-4 text-primary" />} ir={() => setTab("painel")} className="lg:col-span-2">
          {evol.length === 0 ? <p className="text-sm text-muted-foreground">Sem vendas importadas neste mês.</p> : (
            <svg viewBox={`0 0 ${W} ${H + 18}`} className="w-full" role="img" aria-label="Faturamento acumulado do mês contra a meta">
              {[0.25, 0.5, 0.75, 1].map((f) => <line key={f} x1="0" x2={W} y1={py(maxY * f)} y2={py(maxY * f)} className="stroke-border" strokeWidth="1" />)}
              <line x1="0" y1={H} x2={W} y2={py(metaT)} className="stroke-muted-foreground" strokeWidth="1.5" strokeDasharray="5 5" />
              <path d={`${caminho} L${px(evol.at(-1)!.d)},${H} L${px(evol[0]!.d)},${H} Z`} fill="var(--neon)" fillOpacity="0.12" />
              <path d={caminho} fill="none" stroke="var(--neon)" strokeWidth="2.5" />
              <circle cx={px(evol.at(-1)!.d)} cy={py(evol.at(-1)!.v)} r="4" fill="var(--neon)" />
              {[1, 10, 20, diasMes].map((d) => <text key={d} x={Math.min(px(d), W - 12)} y={H + 14} className="fill-muted-foreground text-[10px]">{d}</text>)}
            </svg>
          )}
          <p className="mt-1 flex flex-wrap gap-4 text-[11px] text-muted-foreground"><span><span className="mr-1 inline-block h-0.5 w-4 bg-neon align-middle" />Realizado acumulado</span><span>- - - Ritmo da meta</span></p>
        </Bloco>

        {/* Ranking */}
        <Bloco titulo="Ranking consultores" icon={<Trophy className="size-4 text-warning" />} ir={() => setTab("ranking")}>
          <ol className="space-y-2">{ranking.slice(0, 6).map((l, i) => (
            <li key={l.c.id} className="flex items-center gap-2 text-sm">
              <span className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${i === 0 ? "bg-warning text-background" : i < 3 ? "bg-primary/30" : "bg-muted"}`}>{i + 1}</span>
              <div className="min-w-0 flex-1"><p className="truncate">{l.c.nome}{deptName ? <span className="ml-1 text-[10px] text-muted-foreground">{deptName(l.c.department_id)}</span> : null}</p><Linha p={l.perf} /></div>
              <span className={`w-14 text-right font-semibold ${tone(l.perf)}`}>{pct(l.perf)}</span>
            </li>
          ))}</ol>
        </Bloco>
      </div>

      {/* Departamentos */}
      <Bloco titulo="Desempenho por departamento" icon={<Target className="size-4 text-primary" />} ir={() => setTab("painel")}>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">{porDept.map((d) => <Anel key={d.nome} p={d.projPct} rot={d.nome} />)}</div>
      </Bloco>

      <div className="grid gap-4 md:grid-cols-3">
        <Bloco titulo="Ordens de serviço" icon={<ClipboardList className="size-4 text-primary" />} ir={() => setTab("controle-os")}>
          {fluxo.length === 0 ? <p className="text-sm text-muted-foreground">Sem importação semanal.</p> :
            <div className="grid grid-cols-2 gap-2">{fluxo.map((f) => <div key={f.st} className="rounded-lg bg-background/40 p-2"><p className="text-xl font-bold">{f.n}</p><p className="text-[11px] text-muted-foreground">{f.st}</p></div>)}</div>}
          {(parados > 0 || amarelos > 0) && <p className="mt-2 text-xs"><span className="text-warning">{amarelos} &gt;20 dias</span> · <span className="text-destructive">{parados} &gt;30 dias</span></p>}
        </Bloco>
        <Bloco titulo="Oficina & técnicos" icon={<Car className="size-4 text-primary" />} ir={() => setTab("mecanicos")}>
          <div className="space-y-2 text-sm">
            <div><p className="flex justify-between"><span>Serviços</span><span className={tone(div(mec.s, mec.ms))}>{brl(mec.s)} · {pct(div(mec.s, mec.ms))}</span></p><Linha p={div(mec.s, mec.ms)} cor="bg-neon" /></div>
            <div><p className="flex justify-between"><span>Peças</span><span className={tone(div(mec.p, mec.mp))}>{brl(mec.p)} · {pct(div(mec.p, mec.mp))}</span></p><Linha p={div(mec.p, mec.mp)} cor="bg-coral" /></div>
            <p className="flex justify-between"><span>Passagens</span><b>{uni(mec.pass)}</b></p>
          </div>
        </Bloco>
        <Bloco titulo="Agregados" icon={<Gem className="size-4 text-primary" />} ir={() => setTab("agregados")}>
          <ul className="space-y-1.5 text-sm">{ITENS.map((it) => {
            const a = agg[it.k] ?? { q: 0, v: 0, mq: 0 };
            const ritmo = dec ? div(div(a.q, dec) * tot, a.mq) : 0;
            return <li key={it.k} className="flex justify-between gap-2"><span className="truncate">{it.nome}</span><span className="shrink-0">{uni(a.q)} un{a.mq ? ` / ${uni(a.mq)}` : ""} · {brl(a.v)}{a.mq ? <b className={`ml-1 ${tone(ritmo)}`}>{pct(ritmo)}</b> : null}</span></li>;
          })}</ul>
        </Bloco>
      </div>

      <footer className="flex flex-col items-center gap-2 py-4">
        <div className="m-stripe w-24 rounded-full" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">Juntos pela melhor experiência.</p>
      </footer>
    </div>
  );
}
