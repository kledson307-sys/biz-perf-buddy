import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Box, Posicao, brl, div, norm, pct, tone, uni } from "@/components/painel-ui";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { MixPassagens } from "@/components/MixPassagens";
import { NpsResumoRestrito } from "@/components/NpsPainel";
import { META_PROMOTOR, classe, type NpsItem } from "@/lib/nps";
import { analisar, fmt, hoje, type OsImport, type OsItem } from "@/lib/os-controle";
import type { Composicao } from "@/lib/mecanicos";
import { dicaTecnico, ratioFaixa, ritmo } from "@/lib/oficina";

type T = { nome: string; servicos: number; pecas: number; passagens: number; meta_servicos: number; meta_pecas: number; composicao?: Composicao };
type Params = { du_totais: number; du_decorridos: number; dc_totais: number; dc_decorridos: number; base: string } | null;
type Painel = { vendas: { servicos: number; pecas: number }; metas: { servicos: number; pecas: number }; snapshots: { at: string; itens: OsItem[] }[]; acomp: { os_n: string; prev: string | null; judicial: boolean }[] };
const OCULTOS = ["VINICIUS", "DELMIR", "LUIS SANDRO"];

/** Cockpit da oficina de Carro. Marcos (controlador de quadro) e Delmir (chefe: + auditoria e dossiê). */
export function CockpitOficina({ chefe }: { chefe: boolean }) {
  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7));
  const [aba, setAba] = useState("resumo");
  const [tec, setTec] = useState<{ tecnicos: T[]; params: Params } | null>(null);
  const [pn, setPn] = useState<Painel | null>(null);
  const [nps, setNps] = useState<NpsItem[]>([]);
  const [erro, setErro] = useState("");
  useEffect(() => {
    setErro("");
    void supabase.rpc("tecnicos_carro", { p_mes: mes }).then(({ data, error }) => (error ? setErro("Não foi possível carregar os dados.") : setTec(data as unknown as { tecnicos: T[]; params: Params })));
    void supabase.rpc("painel_oficina" as never, { p_mes: mes } as never).then(({ data }) => setPn(data as unknown as Painel));
    void supabase.rpc("meu_nps").then(({ data }) => setNps(((data as { itens?: NpsItem[] } | null)?.itens) ?? []));
  }, [mes]);

  const p = tec?.params;
  const uteis = (p?.base ?? "uteis") === "uteis";
  const dec = Math.max(1, uteis ? p?.du_decorridos ?? 1 : p?.dc_decorridos ?? 1);
  const tot = Math.max(dec, uteis ? p?.du_totais ?? 22 : p?.dc_totais ?? 30);
  const todos = tec?.tecnicos ?? [];
  const lista = todos.filter((t) => !OCULTOS.includes(t.nome.toUpperCase()))
    .map((t) => ({ ...t, perf: div(+t.servicos + +t.pecas, +t.meta_servicos + +t.meta_pecas) })).sort((a, b) => b.perf - a.perf);

  // Pátio: snapshot mais recente comparado ao anterior
  const ref = hoje();
  const patio = useMemo(() => {
    const [atual, ant] = pn?.snapshots ?? [];
    if (!atual) return [];
    const anterior = ant ? ({ id: "", nome: "", arquivo: "", at: ant.at, itens: ant.itens } as OsImport) : undefined;
    const ac = new Map((pn?.acomp ?? []).map((a) => [a.os_n, a]));
    return atual.itens.filter((i) => i.st !== "encerrado").map((i) => {
      const a = ac.get(i.n);
      const it = a?.judicial ? { ...i, st: "judicial" as const } : i;
      return analisar(it, anterior, ref, a?.prev);
    });
  }, [pn, ref]);
  const insatisfeitos = useMemo(() => {
    const m = new Map<string, NpsItem>();
    nps.filter((x) => x.nota !== null && classe(x.nota) !== "promotor").forEach((x) => m.set(norm(x.cliente.trim()), x));
    return m;
  }, [nps]);
  const preventivo = patio.filter((a) => insatisfeitos.has(norm(a.item.cli.trim())));
  const por = (st: string) => patio.filter((a) => a.item.st === st);
  const parados = patio.filter((a) => a.semMudanca && a.diasStatus > 5 && a.item.st !== "judicial");
  const diag3 = por("diag").filter((a) => a.diasStatus > 3);
  const pecasHoje = por("pecas").filter((a) => a.prev && a.prev <= ref);

  const V = pn?.vendas ?? { servicos: 0, pecas: 0 }, M = pn?.metas ?? { servicos: 0, pecas: 0 };
  const abas: [string, string][] = [["resumo", "Resumo"], ["patio", "Pátio & O.S."], ["tecnicos", "Técnicos & Boxes"], ["qualidade", "Qualidade & Retorno"], ...(chefe ? [["dossie", "Dossiê técnico"] as [string, string]] : [])];

  return (
    <div className="min-h-screen bg-background p-3 md:p-6">
      <div className="mx-auto max-w-[1600px] space-y-3">
        <header className="lux-card flex flex-wrap items-center justify-between gap-2 p-3">
          <div><p className="text-[10px] uppercase tracking-[0.3em] text-primary">HAUS MOTORS · SALVADOR</p>
            <h1 className="text-lg font-bold">Oficina Carro · {chefe ? "Chefe de Oficina · Delmir Xavier" : "Controlador de Quadro · Marcos"}</h1></div>
          <div className="flex items-center gap-2">
            <input type="month" className="h-9 rounded-md border bg-background px-2 text-sm" value={mes} onChange={(e) => setMes(e.target.value)} />
            <ThemeToggle />
            <Button size="sm" variant="outline" onClick={() => supabase.auth.signOut()}><LogOut className="size-4" /> Sair</Button>
          </div>
        </header>
        <nav className="flex flex-wrap gap-1">{abas.map(([k, n]) => <Button key={k} size="sm" variant={aba === k ? "default" : "outline"} onClick={() => setAba(k)}>{n}</Button>)}</nav>
        {erro && <p className="text-sm text-destructive">{erro}</p>}

        {aba === "resumo" && <div className="grid gap-3 lg:grid-cols-4">
          <Meta l="Serviços SG Oficina" v={V.servicos} m={M.servicos} dec={dec} tot={tot} />
          <Meta l="Peças SG Oficina" v={V.pecas} m={M.pecas} dec={dec} tot={tot} />
          <Meta l="Total SG Oficina" v={V.servicos + V.pecas} m={M.servicos + M.pecas} dec={dec} tot={tot} />
          <Box title="Radar do dia">
            <ul className="space-y-1 p-3 text-sm">
              <Radar n={preventivo.length} t="clientes com histórico NPS neutro/detrator no pátio" />
              <Radar n={pecasHoje.length} t="peças com chegada prevista até hoje" />
              <Radar n={parados.length} t="O.S. sem mudança há mais de 5 dias" />
              {chefe && <Radar n={diag3.length} t="diagnósticos parados há mais de 3 dias" />}
              <Radar n={por("autorizacao").length} t="aguardando aprovação de orçamento" />
            </ul>
          </Box>
          <div className="lg:col-span-2"><TabelaTec lista={lista} dec={dec} tot={tot} /></div>
          <div className="lg:col-span-2"><MixPassagens titulo="Mix de passagens · Carro" linhas={lista} todos={todos} /></div>
        </div>}

        {aba === "patio" && <div className="grid gap-3 lg:grid-cols-3">
          <ListaOS t="Alerta preventivo NPS" l={preventivo} extra={(a) => { const n = insatisfeitos.get(norm(a.item.cli.trim())); return n ? `nota ${n.nota} · ${n.obs || n.motivo || "sem verbalização"}` : ""; }} />
          <ListaOS t="Aguardando peças" l={por("pecas")} extra={(a) => (a.prev ? `previsão ${fmt(a.prev)}${a.prev <= ref ? " · CHEGOU?" : ""}` : "sem previsão")} />
          <ListaOS t="Aguardando aprovação de orçamento" l={por("autorizacao")} />
          <ListaOS t="Judiciais" l={por("judicial")} />
          <ListaOS t="Sem mudança > 5 dias" l={parados} />
          <ListaOS t={chefe ? "Diagnóstico > 3 dias" : "Em diagnóstico"} l={chefe ? diag3 : por("diag")} />
        </div>}

        {aba === "tecnicos" && <div className="grid gap-3 lg:grid-cols-2">
          <TabelaTec lista={lista} dec={dec} tot={tot} />
          <Box title="Carga & dicas por técnico">
            <ul className="space-y-2 p-3 text-sm">{lista.map((t) => <li key={t.nome} className="rounded border border-border p-2">
              <div className="flex justify-between"><b>{t.nome}</b><span>{uni(+t.passagens)} passagens · ratio {ratioFaixa(+t.pecas, +t.servicos).txt}</span></div>
              <p className="text-xs text-muted-foreground">{dicaTecnico(t, dec, tot)}</p></li>)}
              {!lista.length && <li className="text-muted-foreground">Sem dados neste mês.</li>}</ul>
          </Box>
        </div>}

        {aba === "qualidade" && <div className="grid gap-3 lg:grid-cols-2">
          <NpsResumoRestrito titulo="NPS da oficina · Carro" meta={META_PROMOTOR.carro} />
          <Box title="Retorno por O.S. (clientes insatisfeitos de volta à oficina)">
            <ul className="space-y-1 p-3 text-xs">{preventivo.map((a) => <li key={a.item.n} className="rounded border border-border p-2">O.S. <b>{a.item.n}</b> · {a.item.mod} · {a.item.cons} · {a.diasStatus} dias</li>)}
              {!preventivo.length && <li className="text-muted-foreground">Nenhum retorno de cliente insatisfeito no pátio.</li>}</ul>
          </Box>
        </div>}

        {aba === "dossie" && chefe && <Box title="Dossiê técnico do mês">
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="text-xs text-muted-foreground"><th className="px-3 py-2 text-left">Técnico</th><th>BSI</th><th>Revisão C7</th><th>C7 pagos</th><th>Garantia</th><th>Funilaria</th><th>Ticket</th><th>Ratio P/M.O.</th><th>Atingimento</th></tr></thead>
            <tbody>{lista.map((t) => { const c = t.composicao ?? {}; const n = (a?: string[]) => a?.length ?? 0; const r = ratioFaixa(+t.pecas, +t.servicos);
              return <tr key={t.nome} className="border-t border-border text-center"><td className="px-3 py-2 text-left font-medium">{t.nome}</td><td>{n(c.bs)}</td><td>{n(c.rev)}</td><td>{n(c.pagos)}</td><td>{n(c.c4)}</td><td>{n(c.funilaria)}</td>
                <td>{brl(div(+t.servicos + +t.pecas, +t.passagens))}</td><td className={r.cls}>{r.txt}</td><td className={tone(t.perf)}>{pct(t.perf)}</td></tr>; })}</tbody>
          </table></div>
        </Box>}
      </div>
    </div>
  );
}

function Meta({ l, v, m, dec, tot }: { l: string; v: number; m: number; dec: number; tot: number }) {
  const r = ritmo(v, m, dec, tot);
  return <section className="lux-card p-3">
    <p className="text-xs uppercase tracking-wide text-muted-foreground">{l}</p>
    <p className="text-2xl font-bold">{brl(v)}</p>
    <p className="text-xs">Meta {brl(m)} · <b className={tone(div(v, m))}>{pct(div(v, m))}</b></p>
    <p className="text-xs">Projeção {brl(r.proj)} · <b className={tone(r.projP)}>{pct(r.projP)}</b></p>
    <p className="text-xs text-muted-foreground">Necessidade diária {brl(r.nec)}</p>
  </section>;
}
function Radar({ n, t }: { n: number; t: string }) {
  return <li className="flex items-center gap-2"><b className={n ? "text-destructive" : "text-success"}>{uni(n)}</b><span>{t}</span></li>;
}
function ListaOS({ t, l, extra }: { t: string; l: ReturnType<typeof analisar>[]; extra?: (a: ReturnType<typeof analisar>) => string }) {
  return <Box title={`${t} (${l.length})`} fit="xl:max-h-[40vh]">
    <ul className="space-y-1 p-2 text-xs">{l.map((a) => <li key={a.item.n} className="rounded border border-border p-2">
      <b>O.S. {a.item.n}</b> · {a.item.mod} · {a.item.placa} · {a.item.cons} · <span className={a.diasStatus > 30 ? "text-destructive" : a.diasStatus > 20 ? "text-warning" : "text-success"}>{a.diasStatus} dias</span>
      {extra && <p className="text-muted-foreground">{extra(a)}</p>}</li>)}
      {!l.length && <li className="text-muted-foreground">Nenhuma O.S.</li>}</ul>
  </Box>;
}
function TabelaTec({ lista, dec, tot }: { lista: (T & { perf: number })[]; dec: number; tot: number }) {
  return <Box title="Metas, projeção e necessidade por técnico">
    <div className="overflow-x-auto"><table className="w-full text-xs">
      <thead><tr className="text-muted-foreground"><th className="px-2 py-2 text-left">Técnico</th><th>Linha</th><th>Meta</th><th>Realizado</th><th>Projeção</th><th>Precisa/dia</th><th>Ticket</th></tr></thead>
      <tbody>{lista.map((t, i) => (["Serviços", "Peças"] as const).map((k, j) => { const v = k === "Serviços" ? +t.servicos : +t.pecas; const m = k === "Serviços" ? +t.meta_servicos : +t.meta_pecas; const r = ritmo(v, m, dec, tot);
        return <tr key={t.nome + k} className={j ? "" : "border-t border-border"}>
          {j === 0 && <td rowSpan={2} className="px-2 py-1 font-medium"><Posicao i={i} /> {t.nome}</td>}
          <td>{k}</td><td>{brl(m)}</td><td>{brl(v)} <b className={tone(div(v, m))}>{pct(div(v, m))}</b></td><td className={tone(r.projP)}>{brl(r.proj)}</td><td>{brl(r.nec)}</td>
          {j === 0 && <td rowSpan={2}>{brl(div(+t.servicos + +t.pecas, +t.passagens))}</td>}</tr>; }))}</tbody>
    </table></div>
    {!lista.length && <p className="p-3 text-sm text-muted-foreground">Ainda não há dados neste mês.</p>}
  </Box>;
}
