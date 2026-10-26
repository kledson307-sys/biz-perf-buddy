import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { loadOpenOrders, type OpenOrders } from "@/lib/open-orders.functions";
import { ITENS } from "@/lib/agregados";
import { STATUS, type OsImport } from "@/lib/os-controle";
import { Barra, brl, div, pct, tone, uni } from "@/components/painel-ui";

type L = { c: { id: string; nome: string; department_id: string | null }; servicos: number; pecas: number; mS: number; mP: number; perf: number; projPct: number };
type D = { nome: string; servicos: number; pecas: number; meta: number; projPct: number };

function Bloco({ titulo, ir, children, right }: { titulo: string; ir?: () => void; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</h2>
        <div className="flex items-center gap-2">{right}{ir && <button type="button" onClick={ir} className="text-xs font-medium text-primary hover:underline">Abrir ›</button>}</div>
      </div>
      {children}
    </section>
  );
}

export function Cockpit({ linhas, porDept, mes, tot, dec, soPecas, setTab }: {
  linhas: L[]; porDept: D[]; mes: string; tot: number; dec: number; soPecas: (n: string) => boolean; setTab: (t: string) => void;
}) {
  const [comOs, setComOs] = useState(true);
  const [os, setOs] = useState<OpenOrders>({});
  const [pass, setPass] = useState(0);
  const [agg, setAgg] = useState<Record<string, { q: number; v: number; mq: number }>>({});
  const [mec, setMec] = useState({ s: 0, p: 0, ms: 0, mp: 0, pass: 0 });
  const [fluxo, setFluxo] = useState<{ st: string; n: number }[]>([]);
  const [parados, setParados] = useState(0);

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
  const ratio = div(t.p, t.s);
  const abaixo = linhas.filter((l) => l.mS + l.mP > 0 && l.projPct < 0.85);
  const card = "rounded-lg bg-muted/40 p-3";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[["Serviços", t.s, t.ms], ["Peças", t.p, t.mp], ["Total", t.s + t.p, t.ms + t.mp]].map(([n, r, m]) => (
          <button key={n as string} type="button" onClick={() => setTab("painel")} className="rounded-xl border border-border bg-card p-4 text-left">
            <p className="text-xs text-muted-foreground">Realizado {n}</p>
            <p className="text-lg font-bold">{brl(r as number)}</p>
            <p className={`text-xs font-semibold ${tone(div(r as number, m as number))}`}>{pct(div(r as number, m as number))} de {brl(m as number)}</p>
          </button>
        ))}
        <button type="button" onClick={() => setTab("agregados")} className="rounded-xl border border-border bg-card p-4 text-left">
          <p className="text-xs text-muted-foreground">Ticket médio</p>
          <p className="text-sm">Serviços <b>{brl(div(t.s, pass))}</b></p>
          <p className="text-sm">Peças <b>{brl(div(t.p, pass))}</b></p>
          <p className="text-sm">Passagens <b>{uni(pass)}</b></p>
        </button>
        <button type="button" onClick={() => setTab("nps")} className="rounded-xl border border-dashed border-border bg-card p-4 text-left">
          <p className="text-xs text-muted-foreground">NPS</p>
          <p className="text-lg font-bold text-muted-foreground">—</p>
          <p className="text-xs text-muted-foreground">Em estruturação</p>
        </button>
      </div>

      <Bloco titulo="Projeção do mês" ir={() => setTab("os")} right={
        <div className="flex rounded-full border border-border p-0.5 text-xs">
          <button type="button" onClick={() => setComOs(true)} className={`rounded-full px-3 py-1 ${comOs ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Com O.S. abertas</button>
          <button type="button" onClick={() => setComOs(false)} className={`rounded-full px-3 py-1 ${!comOs ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Só faturado</button>
        </div>}>
        <div className="grid gap-3 sm:grid-cols-2">
          {[["Serviços", pS, t.ms, altS, t.s + (comOs ? t.os : 0)], ["Peças", pP, t.mp, altP, t.p + (comOs ? t.op : 0)]].map(([n, p, m, alt, base]) => (
            <div key={n as string} className={card}>
              <p className="text-xs text-muted-foreground">Projeção {n}</p>
              <p className={`text-xl font-bold ${tone(div(p as number, m as number))}`}>{brl(p as number)} <span className="text-sm">{pct(div(p as number, m as number))}</span></p>
              <div className="my-2"><Barra p={div(p as number, m as number)} /></div>
              <p className="text-xs text-muted-foreground">Meta {brl(m as number)} · precisa {brl(rest ? Math.max((m as number) - (base as number), 0) / rest : 0)}/dia</p>
              <p className="text-xs text-muted-foreground">{comOs ? "Só faturado" : "Com O.S."}: {brl(alt as number)} ({pct(div(alt as number, m as number))})</p>
            </div>
          ))}
        </div>
      </Bloco>

      <div className="grid gap-4 lg:grid-cols-3">
        <Bloco titulo="Alertas">
          <ul className="space-y-2 text-sm">
            {abaixo.length > 0 && <li className="text-destructive">⚠️ {abaixo.length} consultor(es) projetando abaixo de 85%: {abaixo.map((l) => l.c.nome).join(", ")}</li>}
            {parados > 0 && <li><button type="button" className="text-left text-destructive hover:underline" onClick={() => setTab("controle-os")}>⚠️ {parados} O.S. há mais de 30 dias na oficina</button></li>}
            <li className="text-muted-foreground">Peças por R$ 1 de serviço: <b className="text-foreground">{ratio.toFixed(2).replace(".", ",")}</b></li>
            {abaixo.length === 0 && parados === 0 && <li className="text-success">✅ Nenhum alerta crítico agora.</li>}
          </ul>
        </Bloco>
        <Bloco titulo="Departamentos" ir={() => setTab("painel")}>
          <div className="space-y-2">{porDept.map((d) => (
            <div key={d.nome}><div className="flex justify-between text-sm"><span>{d.nome}</span><span className={`font-semibold ${tone(d.projPct)}`}>{pct(d.projPct)}</span></div><Barra p={d.projPct} /></div>
          ))}</div>
        </Bloco>
        <Bloco titulo="Ranking" ir={() => setTab("ranking")}>
          <ol className="space-y-1 text-sm">{linhas.slice(0, 5).map((l, i) => (
            <li key={l.c.id} className="flex justify-between"><span>{["🥇", "🥈", "🥉"][i] ?? `${i + 1}º`} {l.c.nome}</span><span className={`font-semibold ${tone(l.perf)}`}>{pct(l.perf)}</span></li>
          ))}</ol>
        </Bloco>
        <Bloco titulo="Fluxo de O.S." ir={() => setTab("controle-os")}>
          {fluxo.length === 0 ? <p className="text-sm text-muted-foreground">Sem importação semanal.</p> :
            <ul className="space-y-1 text-sm">{fluxo.map((f) => <li key={f.st} className="flex justify-between"><span>{f.st}</span><b>{f.n}</b></li>)}</ul>}
        </Bloco>
        <Bloco titulo="Técnicos" ir={() => setTab("mecanicos")}>
          <div className="space-y-1 text-sm">
            <p className="flex justify-between"><span>Serviços</span><span className={tone(div(mec.s, mec.ms))}>{brl(mec.s)} · {pct(div(mec.s, mec.ms))}</span></p>
            <p className="flex justify-between"><span>Peças</span><span className={tone(div(mec.p, mec.mp))}>{brl(mec.p)} · {pct(div(mec.p, mec.mp))}</span></p>
            <p className="flex justify-between"><span>Passagens</span><b>{uni(mec.pass)}</b></p>
          </div>
        </Bloco>
        <Bloco titulo="Agregados" ir={() => setTab("agregados")}>
          <ul className="space-y-1 text-sm">{ITENS.map((it) => {
            const a = agg[it.k] ?? { q: 0, v: 0, mq: 0 };
            const ritmo = dec ? div(div(a.q, dec) * tot, a.mq) : 0;
            return <li key={it.k} className="flex justify-between gap-2"><span>{it.nome}</span><span>{uni(a.q)} un{a.mq ? ` / ${uni(a.mq)}` : ""} · {brl(a.v)}{a.mq ? <b className={`ml-1 ${tone(ritmo)}`}>{pct(ritmo)}</b> : null}</span></li>;
          })}</ul>
        </Bloco>
      </div>
    </div>
  );
}
