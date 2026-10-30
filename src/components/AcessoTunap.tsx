import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Box, brl, div, num, pct, tone, uni } from "@/components/painel-ui";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { consultorMoto, type MixCons } from "@/lib/mecanicos";
import { porPassagem, ritmo } from "@/lib/oficina";

type D = {
  consultores: { id: string; nome: string; dep: string | null }[];
  vendas: { c: string; codigo: string; qtd: number; valor: number }[];
  metas: { c: string; qtd: number; valor: number }[];
  mix: { nome: string; composicao: MixCons }[];
  params: { du_totais: number; du_decorridos: number; dc_totais: number; dc_decorridos: number; base: string } | null;
};

/** Acesso Geraldo (Tunap): somente vendas do agregado Tunap. */
export function AcessoTunap() {
  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7));
  const [d, setD] = useState<D | null>(null);
  useEffect(() => { void supabase.rpc("tunap_painel" as never, { p_mes: mes } as never).then(({ data }) => setD(data as unknown as D)); }, [mes]);
  const p = d?.params; const uteis = (p?.base ?? "uteis") === "uteis";
  const dec = Math.max(1, uteis ? p?.du_decorridos ?? 1 : p?.dc_decorridos ?? 1);
  const tot = Math.max(dec, uteis ? p?.du_totais ?? 22 : p?.dc_totais ?? 30);
  const n = (a?: string[]) => a?.length ?? 0;
  const linhas = (d?.consultores ?? []).map((c) => {
    const v = d!.vendas.filter((x) => x.c === c.id);
    const meta = d!.metas.find((m) => m.c === c.id);
    const mx = d!.mix.find((m) => m.nome.trim().toUpperCase() === c.nome.trim().toUpperCase())?.composicao;
    const moto = consultorMoto(c.nome);
    const pass = mx ? (moto ? n(mx.rev) : n(mx.bsi) + n(mx.rev)) : 0;
    const qtd = v.reduce((a, x) => a + +x.qtd, 0), valor = v.reduce((a, x) => a + +x.valor, 0);
    const cod = new Map<string, number>(); v.forEach((x) => cod.set(x.codigo || "—", (cod.get(x.codigo || "—") ?? 0) + +x.qtd));
    return { ...c, moto, qtd, valor, pass, metaQ: +(meta?.qtd ?? 0), cod };
  }).filter((l) => l.qtd > 0 || l.metaQ > 0).sort((a, b) => b.qtd - a.qtd);
  const T = linhas.reduce((a, l) => ({ qtd: a.qtd + l.qtd, valor: a.valor + l.valor, pass: a.pass + l.pass, meta: a.meta + l.metaQ }), { qtd: 0, valor: 0, pass: 0, meta: 0 });
  const rt = ritmo(T.qtd, T.meta, dec, tot);
  const codigos = [...new Set(linhas.flatMap((l) => [...l.cod.keys()]))].sort();

  return (
    <div className="min-h-screen bg-background p-3 md:p-6">
      <div className="mx-auto max-w-[1400px] space-y-3">
        <header className="lux-card flex flex-wrap items-center justify-between gap-2 p-3">
          <div><p className="text-[10px] uppercase tracking-[0.3em] text-primary">HAUS MOTORS · SALVADOR</p><h1 className="text-lg font-bold">Tunap · Geraldo</h1></div>
          <div className="flex items-center gap-2">
            <input type="month" className="h-9 rounded-md border bg-background px-2 text-sm" value={mes} onChange={(e) => setMes(e.target.value)} />
            <ThemeToggle /><Button size="sm" variant="outline" onClick={() => supabase.auth.signOut()}><LogOut className="size-4" /> Sair</Button>
          </div>
        </header>
        <div className="grid gap-3 sm:grid-cols-4">
          <K l="Unidades vendidas" v={uni(T.qtd)} s={T.meta ? `meta ${uni(T.meta)} · ${pct(div(T.qtd, T.meta))}` : "sem meta"} />
          <K l="Faturamento Tunap" v={brl(T.valor)} />
          <K l="Projeção de unidades" v={uni(rt.proj)} s={T.meta ? `precisa ${num(rt.nec)} un/dia` : undefined} cls={T.meta ? tone(rt.projP) : ""} />
          <K l="Unidades por passagem" v={num(porPassagem(T.qtd, T.pass))} s={`${uni(T.pass)} passagens de revisão`} />
        </div>
        <Box title="Performance por consultor">
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="text-xs text-muted-foreground"><th className="px-3 py-2 text-left">Consultor</th><th>Unidades</th><th>Meta</th><th>Projeção</th><th>Valor</th><th>Passagens revisão</th><th>Un./passagem</th></tr></thead>
            <tbody>{linhas.map((l) => { const r = ritmo(l.qtd, l.metaQ, dec, tot); return <tr key={l.id} className="border-t border-border text-center">
              <td className="px-3 py-2 text-left font-medium">{l.nome} <span className="text-xs text-muted-foreground">{l.moto ? "Moto · N7" : "Carro · BSI + C7"}</span></td>
              <td>{uni(l.qtd)}</td><td>{l.metaQ ? uni(l.metaQ) : "—"}</td><td className={l.metaQ ? tone(r.projP) : ""}>{uni(r.proj)}</td><td>{brl(l.valor)}</td><td>{uni(l.pass)}</td><td><b>{num(porPassagem(l.qtd, l.pass))}</b></td></tr>; })}
              <tr className="border-t-2 border-border text-center font-bold"><td className="px-3 py-2 text-left">TOTAL</td><td>{uni(T.qtd)}</td><td>{T.meta ? uni(T.meta) : "—"}</td><td>{uni(rt.proj)}</td><td>{brl(T.valor)}</td><td>{uni(T.pass)}</td><td>{num(porPassagem(T.qtd, T.pass))}</td></tr></tbody>
          </table></div>
          {!linhas.length && <p className="p-3 text-sm text-muted-foreground">Ainda não há vendas Tunap neste mês.</p>}
        </Box>
        <Box title="Vendas por referência (unidades)">
          <div className="overflow-x-auto"><table className="w-full text-xs">
            <thead><tr className="text-muted-foreground"><th className="px-3 py-2 text-left">Referência</th>{linhas.map((l) => <th key={l.id} className="px-2">{l.nome.split(" ")[0]}</th>)}<th className="px-2">Total</th></tr></thead>
            <tbody>{codigos.map((c) => <tr key={c} className="border-t border-border text-center"><td className="px-3 py-1 text-left">{c}</td>{linhas.map((l) => <td key={l.id}>{uni(l.cod.get(c) ?? 0)}</td>)}<td className="font-bold">{uni(linhas.reduce((a, l) => a + (l.cod.get(c) ?? 0), 0))}</td></tr>)}</tbody>
          </table></div>
        </Box>
      </div>
    </div>
  );
}
function K({ l, v, s, cls = "" }: { l: string; v: string; s?: string | undefined; cls?: string }) {
  return <section className="lux-card p-3"><p className="text-xs uppercase tracking-wide text-muted-foreground">{l}</p><p className={`text-2xl font-bold ${cls}`}>{v}</p>{s && <p className="text-xs text-muted-foreground">{s}</p>}</section>;
}
