import { Car, Cog, Handshake, TrendingUp, Trophy } from "lucide-react";
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
        <span className="text-sm font-bold tabular-nums text-foreground">{x.meta > 0 ? pc(x.perf) : "—"}</span>
        <span className="text-[9px] text-muted-foreground">da meta</span>
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

function frase(s: MecX, p: MecX, pos: number) {
  if (s.meta <= 0 && p.meta <= 0) return { t: "Meta ainda não definida para este mês.", ok: false };
  if (s.perf >= 1 && p.perf >= 1) return { t: pos === 1 ? "Líder de produção no mês! Metas batidas." : "Metas de serviços e peças superadas!", ok: true };
  if (s.projP >= 1 && p.projP >= 1) return { t: "No ritmo para bater as metas no fechamento.", ok: true };
  if (s.meta > 0 && s.perf < 1) return { t: `Faltam ${brl(s.meta - s.real)} de serviços para a meta.`, ok: false };
  return { t: `Faltam ${brl(p.meta - p.real)} de peças para a meta.`, ok: false };
}

function Rodape({ texto, ok }: { texto: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-2 border-t border-border px-3 py-2 text-xs">
      <Trophy className={`size-4 shrink-0 ${ok ? "text-success" : "text-primary"}`} />
      <span className="min-w-0 flex-1">{texto}</span>
      <span className="flex shrink-0 gap-0.5" aria-hidden><i className="h-3 w-1.5 -skew-x-12 bg-primary/60" /><i className="h-3 w-1.5 -skew-x-12 bg-primary" /><i className="h-3 w-1.5 -skew-x-12 bg-destructive" /></span>
    </div>
  );
}

const medalha = (i: number) => (i === 1 ? "🥇" : i === 2 ? "🥈" : i === 3 ? "🥉" : "");

export function TecnicosCockpit({ bloco, ocultar, rotulo, dec, tot }: { bloco: MecBloco; ocultar: (nome: string) => boolean; rotulo: string; dec: number; tot: number }) {
  const lista = bloco.calcs.filter(c => !ocultar(c.r.nome));
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
        <div className="grid gap-3 p-3 md:grid-cols-3">
          <Modulo grande icon={<Car className="size-5" />} titulo="Serviços" real={brl(bloco.S.real)} meta={`Meta: ${brl(bloco.S.meta)}`} proj={brl(bloco.S.proj)} x={bloco.S} />
          <Modulo grande icon={<Cog className="size-5" />} titulo="Peças" real={brl(bloco.P.real)} meta={`Meta: ${brl(bloco.P.meta)}`} proj={brl(bloco.P.proj)} x={bloco.P} />
          <Modulo grande icon={<Handshake className="size-5" />} titulo="Passagens" real={uni(bloco.pass)} meta="Realizadas · sem meta cadastrada" proj={`${uni(projPass(bloco.pass, bloco.S))} passagens`} />
        </div>
        <Rodape texto={tf.t} ok={tf.ok} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3 xl:max-h-[calc(100vh-520px)] xl:overflow-y-auto xl:pr-1">
        {lista.map((c, i) => {
          const f = frase(c.s, c.p, i + 1);
          return (
            <article key={c.r.nome} className="lux-card overflow-hidden">
              <div className="flex items-center justify-between gap-2 px-3 pt-2.5">
                <h4 className="truncate text-sm font-bold">{medalha(i + 1)} {i + 1}. {c.r.nome}</h4>
                <span className="shrink-0 text-[11px] text-muted-foreground">{uni(c.r.passagens)} pass.</span>
              </div>
              <div className="grid grid-cols-1 gap-2 p-2.5 sm:grid-cols-3">
                <Modulo icon={<Car className="size-4" />} titulo="Serviços" real={brl(c.s.real)} meta={`Meta: ${brl(c.s.meta)}`} proj={brl(c.s.proj)} x={c.s} />
                <Modulo icon={<Cog className="size-4" />} titulo="Peças" real={brl(c.p.real)} meta={`Meta: ${brl(c.p.meta)}`} proj={brl(c.p.proj)} x={c.p} />
                <Modulo icon={<Handshake className="size-4" />} titulo="Passagens" real={uni(c.r.passagens)} meta="Realizadas" proj={`${uni(projPass(c.r.passagens, c.t))}`} />
              </div>
              <Rodape texto={f.t} ok={f.ok} />
            </article>
          );
        })}
      </div>
    </section>
  );
}
