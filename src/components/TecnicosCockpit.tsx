import { useEffect, useState } from "react";
import { AlertTriangle, Car, Cog, Handshake, RotateCcw, TrendingUp, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lerOficinaMes } from "@/lib/oficina-mes";
import { norm } from "@/components/painel-ui";
import { brl, uni } from "@/components/painel-ui";
import type { MecBloco, MecX } from "@/lib/mecanicos";

const cor = (p: number, meta: number) => (meta <= 0 ? "text-muted-foreground" : p >= 1 ? "text-success" : p >= 0.85 ? "text-warning" : "text-destructive");
const pc = (p: number) => `${Math.round(p * 100)}%`;

function Anel({ x, size = 64 }: { x: MecX; size?: number }) {
  const r = 26, c = 2 * Math.PI * r, f = Math.min(x.perf, 1);
  return (
    <div className={`relative shrink-0 ${cor(x.perf, x.meta)}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 64 64" className="size-full -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" strokeWidth="6" className="stroke-muted" />
        <circle cx="32" cy="32" r={r} fill="none" strokeWidth="6" stroke="currentColor" strokeLinecap="round" strokeDasharray={`${c * f} ${c}`} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className={`${size >= 56 ? "text-sm" : "text-[10px]"} font-bold tabular-nums text-foreground`}>{x.meta > 0 ? pc(x.perf) : "—"}</span>
        {size >= 56 && <span className="text-[9px] text-muted-foreground">da meta</span>}
      </div>
    </div>
  );
}

function Modulo({ icon, titulo, real, meta, proj, x, grande }: { icon: React.ReactNode; titulo: string; real: string; meta: string; proj: string; x?: MecX; grande?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
      <div className="flex items-center gap-2 text-sm font-semibold"><span className="text-primary">{icon}</span>{titulo}</div>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className={`${grande ? "text-2xl" : "text-lg"} font-bold tabular-nums`}>{real}</p>
          <p className="text-[11px] text-muted-foreground">{meta}</p>
        </div>
        {x && <Anel x={x} size={grande ? 72 : 58} />}
      </div>
      <div className="flex items-center gap-1.5 border-t border-border pt-2 text-xs">
        <TrendingUp className="size-3.5 text-primary" /><span className="text-muted-foreground">Projeção</span>
        <span className="ml-auto font-semibold tabular-nums text-primary">{proj}</span>
      </div>
    </div>
  );
}

function Linha({ icon, titulo, real, meta, proj, x }: { icon: React.ReactNode; titulo: string; real: string; meta: string; proj: string; x?: MecX }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-2 py-1.5">
      <span className="shrink-0 text-primary">{icon}</span>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="flex items-baseline justify-between gap-1 text-[11px] text-muted-foreground"><span>{titulo}</span><span className="truncate">{meta}</span></p>
        <p className="text-sm font-bold tabular-nums">{real}</p>
        <p className="truncate text-[10px] text-muted-foreground">Proj. <b className="text-primary">{proj}</b></p>
      </div>
      {x && <Anel x={x} size={42} />}
    </div>
  );
}

function frase(s: MecX, p: MecX, pos: number) {
  if (s.meta <= 0 && p.meta <= 0) return { t: "Meta ainda não definida para este mês.", ok: false };
  if (s.perf >= 1 && p.perf >= 1) return { t: pos === 1 ? "Líder de produção no mês! Metas batidas." : "Metas de serviços e peças superadas!", ok: true };
  if (s.projP >= 1 && p.projP >= 1) return { t: "No ritmo para bater as metas no fechamento.", ok: true };
  if (s.meta > 0 && s.perf < 1) return { t: `Faltam ${brl(s.meta - s.real)} de serviços para a meta.`, ok: false };
  return { t: `Faltam ${brl(p.meta - p.real)} de peças para a meta.`, ok: false };
}

function Rodape({ texto, ok, compacto }: { texto: string; ok: boolean; compacto?: boolean }) {
  return (
    <div className={`flex items-center gap-2 border-t border-border px-3 ${compacto ? "py-1 text-[11px]" : "py-2 text-xs"}`} title={texto}>
      <Trophy className={`size-4 shrink-0 ${ok ? "text-success" : "text-primary"}`} />
      <span className={`min-w-0 flex-1 ${compacto ? "truncate" : ""}`}>{texto}</span>
      <span className="flex shrink-0 gap-0.5" aria-hidden><i className="h-3 w-1.5 -skew-x-12 bg-primary/60" /><i className="h-3 w-1.5 -skew-x-12 bg-primary" /><i className="h-3 w-1.5 -skew-x-12 bg-destructive" /></span>
    </div>
  );
}

const medalha = (i: number) => (i === 1 ? "🥇" : i === 2 ? "🥈" : i === 3 ? "🥉" : "");

export function TecnicosCockpit({ bloco, ocultar, rotulo, dec, tot, mes }: { bloco: MecBloco; ocultar: (nome: string) => boolean; rotulo: string; dec: number; tot: number; mes?: string }) {
  const lista = bloco.calcs.filter(c => !ocultar(c.r.nome));
  const [rets, setRets] = useState<Record<string, number>>({});
  const [semAp, setSemAp] = useState<{ servicos: number; pecas: number } | null>(null);
  useEffect(() => {
    if (!mes) return;
    void lerOficinaMes(mes).then((x) => { const m: Record<string, number> = {}; for (const r of x.retornos) for (const t of (r.tecnicoAnterior || "").split(", ").filter(Boolean)) m[norm(t).trim()] = (m[norm(t).trim()] ?? 0) + 1; setRets(m); });
    void supabase.from("oficina_mes").select("diario").eq("mes", `semapont-${mes}`).maybeSingle().then(({ data }) => setSemAp((data?.diario as { servicos: number; pecas: number } | null) ?? null));
  }, [mes]);
  const retDe = (nome: string) => rets[norm(nome).trim()] ?? 0;
  if (!bloco.n) return null;
  const projPass = (real: number, _x?: MecX) => (dec > 0 ? Math.round((real / dec) * tot) : real);
  const tf = frase(bloco.S, bloco.P, 0);
  return (
    <section className="space-y-3">
      <div className="lux-card overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-4 pt-3">
          <h3 className="text-sm font-bold">★ Total geral da oficina · {rotulo} <span className="font-normal text-muted-foreground">({uni(lista.length)} técnicos)</span></h3>
          <span className="text-xs text-muted-foreground">Haus Salvador</span>
        </div>
        <div className="grid gap-2 p-2.5 md:grid-cols-3">
          <Modulo icon={<Car className="size-4" />} titulo="Serviços" real={brl(bloco.S.real)} meta={`Meta: ${brl(bloco.S.meta)}`} proj={brl(bloco.S.proj)} x={bloco.S} />
          <Modulo icon={<Cog className="size-4" />} titulo="Peças" real={brl(bloco.P.real)} meta={`Meta: ${brl(bloco.P.meta)}`} proj={brl(bloco.P.proj)} x={bloco.P} />
          <Modulo icon={<Handshake className="size-4" />} titulo="Passagens" real={uni(bloco.pass)} meta="Realizadas · sem meta cadastrada" proj={`${uni(projPass(bloco.pass, bloco.S))} passagens`} />
        </div>
        <Rodape texto={tf.t} ok={tf.ok} />
        {semAp && semAp.servicos + semAp.pecas > 0 && <p className="flex items-center gap-1.5 border-t border-warning/40 bg-warning/10 px-4 py-1.5 text-xs text-warning"><AlertTriangle className="size-3.5" />Faturamento sem técnico apontado na DMS: <b>{brl(semAp.servicos + semAp.pecas)}</b> (serviços {brl(semAp.servicos)} · peças {brl(semAp.pecas)}) — apontar o produtivo nas O.S.</p>}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {lista.map((c, i) => {
          const f = frase(c.s, c.p, i + 1);
          return (
            <article key={c.r.nome} className="lux-card overflow-hidden">
              <div className="flex items-center justify-between gap-2 px-3 pt-2.5">
                <h4 className="truncate text-sm font-bold">{medalha(i + 1)} {i + 1}. {c.r.nome}</h4>
                <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">{(() => { const n = retDe(c.r.nome); return mes ? <span title="Retornos em até 60 dias atribuídos a este técnico" className={`inline-flex items-center gap-0.5 rounded px-1 font-semibold ${n ? "bg-destructive/15 text-destructive" : "bg-success/15 text-success"}`}><RotateCcw className="size-3" />{uni(n)}</span> : null; })()}{c.s.real > 0 && (() => { const r = c.p.real / c.s.real; return <span title="Peças por R$ 1 de M.O." className={`rounded px-1 font-semibold ${r >= 2.5 ? "text-success" : r >= 2 ? "text-warning" : "text-destructive"}`}>{r.toFixed(2).replace(".", ",")}</span>; })()}{uni(c.r.passagens)} pass.</span>
              </div>
              <div className="grid gap-1.5 p-2">
                <Linha icon={<Car className="size-3.5" />} titulo="Serviços" real={brl(c.s.real)} meta={`Meta ${brl(c.s.meta)}`} proj={brl(c.s.proj)} x={c.s} />
                <Linha icon={<Cog className="size-3.5" />} titulo="Peças" real={brl(c.p.real)} meta={`Meta ${brl(c.p.meta)}`} proj={brl(c.p.proj)} x={c.p} />
                <p className="flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground"><Handshake className="size-3.5 text-primary" />Passagens <b className="text-foreground">{uni(c.r.passagens)}</b><span className="ml-auto">Proj. <b className="text-primary">{uni(projPass(c.r.passagens, c.t))}</b></span></p>
              </div>
              <Rodape texto={f.t} ok={f.ok} compacto />
            </article>
          );
        })}
      </div>
    </section>
  );
}
