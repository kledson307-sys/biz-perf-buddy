import { useEffect, useMemo, useState } from "react";
import { MessageCircle, Megaphone, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { brl, pct, uni } from "@/components/painel-ui";
import { normalizar, diasEntre, hoje, type OsItem } from "@/lib/os-controle";

type L = { c: { nome: string }; real: number; meta: number; perf: number; projPct: number; nec: number };
type V = { departamento: string; status: string; valor: number; dia: string };

const wa = (t: string) => `https://wa.me/?text=${encodeURIComponent(t)}`;

/** Central de Gestão: gargalos de faturamento em R$, pauta da reunião matinal e WhatsApp da liderança (Estética, Acessórios, Chefe de Oficina, Controlador). */
export function HubLideranca({ linhas, mes, tot, dec }: { linhas: L[]; mes: string; tot: number; dec: number }) {
  const [os, setOs] = useState<{ itens: OsItem[]; at: string } | null>(null);
  const [vendas, setVendas] = useState<V[]>([]);
  useEffect(() => {
    void supabase.from("os_imports").select("itens,at").order("at", { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => setOs(data ? { itens: normalizar(data.itens as unknown as OsItem[]), at: data.at } : null));
    void supabase.from("vendas_complementares").select("departamento,status,valor,dia").eq("mes", mes)
      .then(({ data }) => setVendas((data ?? []).map((v) => ({ ...v, valor: +v.valor }))));
  }, [mes]);

  const extra = os ? Math.max(0, diasEntre(os.at.slice(0, 10), hoje())) : 0;
  const ativos = (os?.itens ?? []).filter((i) => i.st !== "encerrado" && i.st !== "judicial").map((i) => ({ ...i, dias: i.dias + extra }));
  const soma = (f: (i: OsItem) => boolean) => { const l = ativos.filter(f); return { q: l.length, v: l.reduce((a, i) => a + i.valor, 0) }; };
  const gargalos = [
    { t: "Aguardando autorização", ...soma((i) => i.st === "autorizacao"), d: "Consultores: cobrar o OK do cliente" },
    { t: "Aguardando peças", ...soma((i) => i.st === "pecas"), d: "Peças: cobrar fornecedor/montadora" },
    { t: "Em diagnóstico", ...soma((i) => i.st === "diag"), d: "Chefe de oficina: fechar parecer" },
    { t: "Prontos para faturar", ...soma((i) => i.st === "pronto"), d: "Faturar hoje" },
  ];
  const dep = (re: RegExp) => {
    const l = vendas.filter((v) => re.test(v.departamento.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase()));
    const fat = l.filter((v) => v.status === "FATURADO").reduce((a, v) => a + v.valor, 0);
    const pend = l.filter((v) => v.status === "A_FATURAR" || v.status === "OS_ABERTA");
    const parados = pend.filter((v) => diasEntre(v.dia, hoje()) > 15).length;
    return { fat, aFat: pend.reduce((a, v) => a + v.valor, 0), nAFat: pend.length, parados };
  };
  const est = dep(/ESTET/), ac = dep(/ACESS/);
  const mais30 = soma((i) => i.dias > 30), mais21 = soma((i) => i.dias > 21 && i.dias <= 30);
  const rest = Math.max(tot - dec, 0);

  const pauta = useMemo(() => {
    const comMeta = linhas.filter((l) => l.meta > 0);
    const top = [...comMeta].sort((a, b) => b.perf - a.perf)[0];
    const foco = [...comMeta].filter((l) => l.projPct < 1).sort((a, b) => a.projPct - b.projPct).slice(0, 3);
    const T = comMeta.reduce((a, l) => ({ r: a.r + l.real, m: a.m + l.meta }), { r: 0, m: 0 });
    return [
      `*Reunião matinal · Haus Motors · ${new Date().toLocaleDateString("pt-BR")}*`,
      `Loja: ${brl(T.r)} de ${brl(T.m)} (${pct(T.m ? T.r / T.m : 0)}) · dia útil ${dec} de ${tot}`,
      rest ? `Meta do dia (loja): ${brl(Math.max(T.m - T.r, 0) / rest)}` : "",
      top ? `👏 Destaque: ${top.c.nome} com ${pct(top.perf)} da meta` : "",
      foco.length ? `🎯 Foco: ${foco.map((l) => `${l.c.nome} (${brl(l.nec)}/dia)`).join(", ")}` : "",
      `🔧 Pátio: ${mais30.q} O.S. >30d (${brl(mais30.v)}) · ${gargalos[3]!.q} prontas p/ faturar (${brl(gargalos[3]!.v)})`,
      `⏳ Autorização: ${gargalos[0]!.q} O.S. (${brl(gargalos[0]!.v)}) · Peças: ${gargalos[1]!.q} O.S.`,
    ].filter(Boolean).join("\n");
  }, [linhas, dec, tot, rest, mais30.q, mais30.v, gargalos]);

  const lideres = [
    { n: "Marcela · Estética", a: est.parados ? `${est.parados} venda(s) paradas >15 dias` : "Sem vendas paradas", t: `Olá Marcela! Estética no mês: faturado ${brl(est.fat)}, a faturar ${brl(est.aFat)} (${uni(est.nAFat)} lançamentos)${est.parados ? `, ${est.parados} parados há mais de 15 dias — priorize a conclusão e o faturamento` : ""}. Foco: oferecer PPF/vitrificação em toda revisão e converter a carteira a faturar.` },
    { n: "Geovana · Acessórios", a: ac.parados ? `${ac.parados} venda(s) paradas >15 dias` : "Sem vendas paradas", t: `Olá Geovana! Acessórios no mês: faturado ${brl(ac.fat)}, a faturar ${brl(ac.aFat)} (${uni(ac.nAFat)} lançamentos)${ac.parados ? `, ${ac.parados} parados há mais de 15 dias — cobre instalação/faturamento` : ""}. Foco: itens Chase Auto Care e acessórios na entrega técnica.` },
    { n: "Delmir · Chefe de Oficina", a: `${gargalos[2]!.q} em diagnóstico`, t: `Olá Delmir! Oficina hoje: ${gargalos[2]!.q} O.S. em diagnóstico (${brl(gargalos[2]!.v)}) e ${gargalos[1]!.q} aguardando peças. Priorize fechar os pareceres de diagnóstico para liberar orçamento e acompanhe os retornos de 60 dias.` },
    { n: "Marcos · Controlador de Quadro", a: `${mais30.q} O.S. >30d · ${mais21.q} entre 21-30d`, t: `Olá Marcos! Pátio: ${mais30.q} O.S. com mais de 30 dias (${brl(mais30.v)}) e ${mais21.q} entre 21 e 30 dias. ${gargalos[3]!.q} prontas para faturar (${brl(gargalos[3]!.v)}). Vamos girar os boxes e destravar o faturamento hoje.` },
  ];

  return (
    <div className="grid gap-2 xl:grid-cols-3">
      <section className="lux-card px-3 py-2">
        <h3 className="flex items-center gap-1 text-sm font-semibold"><Lock className="size-4 text-warning" />Gargalos de faturamento</h3>
        {!os ? <p className="text-xs text-muted-foreground">Importe o Controle O.S. semanal.</p> :
          <ul className="mt-1 space-y-1 text-xs">{gargalos.map((g) => <li key={g.t} className="flex justify-between gap-2 border-b border-border/50 pb-1"><span><b>{g.t}</b> · {uni(g.q)} O.S.<span className="block text-[10px] text-muted-foreground">{g.d}</span></span><span className="text-right font-semibold">{brl(g.v)}</span></li>)}</ul>}
      </section>
      <section className="lux-card px-3 py-2">
        <h3 className="flex items-center gap-1 text-sm font-semibold"><Megaphone className="size-4 text-primary" />Pauta da reunião matinal</h3>
        <pre className="mt-1 max-h-36 overflow-y-auto whitespace-pre-wrap font-sans text-[11px] text-muted-foreground">{pauta}</pre>
        <div className="mt-1 flex gap-2 text-xs"><a href={wa(pauta)} target="_blank" rel="noreferrer" className="rounded-md bg-primary px-2 py-1 font-medium text-primary-foreground">Enviar no WhatsApp</a>
          <button type="button" className="rounded-md border border-border px-2 py-1" onClick={() => void navigator.clipboard.writeText(pauta)}>Copiar</button></div>
      </section>
      <section className="lux-card px-3 py-2">
        <h3 className="flex items-center gap-1 text-sm font-semibold"><MessageCircle className="size-4 text-success" />WhatsApp da liderança</h3>
        <ul className="mt-1 space-y-1 text-xs">{lideres.map((l) => <li key={l.n} className="flex items-center justify-between gap-2 border-b border-border/50 pb-1">
          <span><b>{l.n}</b><span className="block text-[10px] text-muted-foreground">{l.a}</span></span>
          <a href={wa(l.t)} target="_blank" rel="noreferrer" className="shrink-0 rounded-md border border-success px-2 py-0.5 text-success">Enviar</a></li>)}</ul>
      </section>
    </div>
  );
}
