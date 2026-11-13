import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Box, Posicao, brl, div, norm, pct, tone, uni } from "@/components/painel-ui";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { LogOut, Menu, X, LayoutDashboard, Car, Wrench, ShieldCheck, FileSearch, Wallet, Gem, ClipboardList, CalendarClock, Star } from "lucide-react";
import bmwLogo from "@/assets/bmw-logo.asset.json";
import { Agregados } from "@/components/Agregados";
import { Mecanicos } from "@/components/Mecanicos";
import { ControleOS } from "@/components/ControleOS";
import { Agendamentos } from "@/components/Agendamentos";
import { NpsPainel } from "@/components/NpsPainel";
import { RetrabalhoOficina } from "@/components/RetrabalhoOficina";
import { RankingAgregados, RankingTecnicos } from "@/components/RankingExtra";
import { Notificacoes } from "@/components/Notificacoes";
import { MixPassagens } from "@/components/MixPassagens";
import { classe, type NpsItem } from "@/lib/nps";
import { analisar, fmt, hoje, type OsImport, type OsItem } from "@/lib/os-controle";
import type { Composicao } from "@/lib/mecanicos";
import { dicaTecnico, ratioFaixa, ritmo } from "@/lib/oficina";
import type { Retorno } from "@/lib/diario-retorno";
import { ExtratoComissao } from "@/components/ExtratoComissao";
import { PERFIS, calcularComissao, npsPorMarca, type Metricas } from "@/lib/comissoes";

type T = { nome: string; servicos: number; pecas: number; passagens: number; meta_servicos: number; meta_pecas: number; composicao?: Composicao };
type Params = { du_totais: number; du_decorridos: number; dc_totais: number; dc_decorridos: number; base: string } | null;
type Painel = { vendas: { servicos: number; pecas: number }; metas: { servicos: number; pecas: number }; snapshots: { at: string; itens: OsItem[] }[]; acomp: { os_n: string; prev: string | null; judicial: boolean }[] };
const OCULTOS = ["VINICIUS", "DELMIR", "LUIS SANDRO"];

/** Cockpit da oficina de Carro. Marcos (controlador de quadro) e Delmir (chefe: + auditoria e dossiê). */
export function CockpitOficina({ chefe }: { chefe: boolean }) {
  const [ret, setRet] = useState<Retorno[]>([]);
  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7));
  const [aba, setAba] = useState("resumo");
  const [tec, setTec] = useState<{ tecnicos: T[]; params: Params } | null>(null);
  const [pn, setPn] = useState<Painel | null>(null);
  const [nps, setNps] = useState<NpsItem[]>([]);
  const [erro, setErro] = useState("");
  const [menu, setMenu] = useState(false);
  const [cons, setCons] = useState<{ id: string; nome: string; department_id: string | null }[]>([]);
  const [deps, setDeps] = useState<{ id: string; nome: string }[]>([]);
  const [email, setEmail] = useState("");
  const [agenda, setAgenda] = useState<{ data: string; categoria: string }[]>([]);
  const loadCons = () => { void supabase.from("consultants").select("id,nome,department_id").order("nome").then(({ data }) => setCons(data ?? [])); };
  useEffect(() => { loadCons(); void supabase.from("departments").select("id,nome").then(({ data }) => setDeps(data ?? [])); void supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
    const d = new Date(); const hj = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    void supabase.from("agendamentos").select("data,categoria").eq("segmento", "carro").gte("data", hj).order("data").limit(500).then(({ data }) => setAgenda((data as { data: string; categoria: string }[] | null) ?? [])); }, []);
  const deptName = (id: string | null) => deps.find((d) => d.id === id)?.nome ?? "—";
  useEffect(() => {
    setErro("");
    void supabase.rpc("tecnicos_carro", { p_mes: mes }).then(({ data, error }) => (error ? setErro("Não foi possível carregar os dados.") : setTec(data as unknown as { tecnicos: T[]; params: Params })));
    void supabase.rpc("oficina_retornos" as never, { p_mes: mes } as never).then(({ data }) => setRet(((data as unknown) as Retorno[] | null) ?? []));
    void supabase.rpc("painel_oficina" as never, { p_mes: mes } as never).then(({ data }) => setPn(data as unknown as Painel));
    void supabase.rpc("meu_nps").then(({ data }) => setNps(((data as { itens?: NpsItem[] } | null)?.itens) ?? []));
  }, [mes]);

  const agHoje = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; })();
  const agProx = agenda.find((a) => a.data > agHoje)?.data ?? "";
  const agDia = (dia: string) => { const l = agenda.filter((a) => a.data === dia); const c = (k: string) => l.filter((a) => a.categoria === k).length; return { n: l.length, txt: `${c("revisao")} rev · ${c("diagnostico")} diag · ${c("recall")} recall` }; };
  const agH = agDia(agHoje), agP = agDia(agProx);
  const agSub = `Hoje ${agH.n} (${agH.txt})${agProx ? ` · ${agProx.slice(8, 10)}/${agProx.slice(5, 7)}: ${agP.n} (${agP.txt})` : " · próximo dia ainda não importado"}`;
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
  const vend = (+(pn?.vendas.servicos ?? 0)) + (+(pn?.vendas.pecas ?? 0)), metaOf = (+(pn?.metas.servicos ?? 0)) + (+(pn?.metas.pecas ?? 0));
  const npsCarro = npsPorMarca(nps, mes).carro;
  const metDel = (v: number): Metricas => ({ metaOficinaOk: metaOf > 0 ? v >= metaOf : null, npsBmw: npsCarro });

  const retTec = new Map<string, number>();
  for (const r of ret) for (const t of (r.tecnicoAnterior || "SEM TÉCNICO").split(", ")) retTec.set(norm(t), (retTec.get(norm(t)) ?? 0) + 1);
  const rankRet = [...ret.reduce((m, r) => { for (const t of (r.tecnicoAnterior || "SEM TÉCNICO").split(", ")) m.set(t, (m.get(t) ?? 0) + 1); return m; }, new Map<string, number>()).entries()].sort((a, b) => b[1] - a[1]);
  const ratioOf = ratioFaixa(+V.pecas, +V.servicos);
  const baixoRatio = lista.filter((t) => +t.servicos > 0 && ratioFaixa(+t.pecas, +t.servicos).r < 2);
  const abaixoRitmo = lista.map((t) => ({ t, r: ritmo(+t.servicos + +t.pecas, +t.meta_servicos + +t.meta_pecas, dec, tot) })).filter((x) => +x.t.meta_servicos + +x.t.meta_pecas > 0 && x.r.projP < 0.85).sort((a, b) => a.r.projP - b.r.projP);
  const consOrc = [...por("autorizacao").reduce((m, a) => m.set(a.item.cons || "—", (m.get(a.item.cons || "—") ?? 0) + 1), new Map<string, number>()).entries()].sort((a, b) => b[1] - a[1]);
  const grupos: { t: string; itens: [string, string, typeof Gem][] }[] = [
    { t: "Operação da oficina", itens: [["resumo", "Torre de controle", LayoutDashboard], ["patio", "Pátio & O.S.", Car], ["tecnicos", "Técnicos & Boxes", Wrench], ["qualidade", "Retornos & Retrabalho", ShieldCheck], ...(chefe ? [["dossie", "Dossiê técnico", FileSearch], ["comissao", "Minha remuneração", Wallet]] as [string, string, typeof Gem][] : [])] },
    { t: "Visão de gestão", itens: [["g-agregados", "Agregados", Gem], ["g-tecnicos", "Oficina & Técnicos", Wrench], ["g-os", "Ordens de Serviço", ClipboardList], ["g-agenda", "Agendamentos", CalendarClock], ["g-nps", "NPS & Satisfação", Star]] },
  ];
  const rotulo = grupos.flatMap((g) => g.itens).find(([k]) => k === aba)?.[1] ?? "";
  const navList = <nav aria-label="Abas da oficina" className="flex flex-col gap-0.5">{grupos.map((g) => <div key={g.t} className="mb-2">
    <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{g.t}</p>
    {g.itens.map(([k, l, Icon]) => { const on = aba === k; return <button key={k} type="button" aria-current={on ? "page" : undefined} onClick={() => { setAba(k); setMenu(false); }}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-1.5 text-left text-sm transition-colors ${on ? "bg-gradient-to-r from-primary/30 to-primary/5 font-semibold text-foreground shadow-[inset_3px_0_0_var(--color-primary)]" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
      <Icon strokeWidth={1.5} className={`size-4 shrink-0 ${on ? "text-primary" : ""}`} /><span className="flex-1">{l}</span></button>; })}</div>)}</nav>;
  const marca = <div className="flex items-center gap-3"><img src={bmwLogo.url} alt="BMW" className="size-10 shrink-0" />
    <div className="min-w-0 leading-tight"><p className="text-sm font-bold tracking-wide">BMW PÓS-VENDA</p>
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">Haus Motors · Salvador</p>
      <p className="text-[10px] text-muted-foreground">{chefe ? "Chefe de Oficina · Delmir" : "Controlador · Marcos"}</p></div></div>;
  const rodape = <div className="border-t border-border p-2"><div className="m-stripe mx-auto w-16 rounded-full" />
    <p className="mt-2 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Juntos pela melhor experiência.</p>
    <p className="mt-1 break-all text-center text-[10px] text-muted-foreground">{email}</p></div>;
  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-card lg:flex">
        <div className="border-b border-border p-4">{marca}</div>
        <div className="flex-1 overflow-y-auto p-3">{navList}</div>
        {rodape}
      </aside>
      {menu && <div className="fixed inset-0 z-40 lg:hidden">
        <button aria-label="Fechar menu" className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={() => setMenu(false)} />
        <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-border bg-card shadow-xl">
          <div className="flex items-center justify-between border-b border-border p-4">{marca}<Button variant="ghost" size="icon" aria-label="Fechar menu" onClick={() => setMenu(false)}><X /></Button></div>
          <div className="flex-1 overflow-y-auto p-3">{navList}</div>
          {rodape}
        </div>
      </div>}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
          <div className="flex items-center gap-2 px-3 py-1.5 sm:px-5">
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menu" onClick={() => setMenu(true)}><Menu /></Button>
            <div className="min-w-0 flex-1"><h1 className="truncate text-base font-bold sm:text-lg">{rotulo}</h1>
              <p className="text-[11px] text-muted-foreground">{uteis ? "Úteis" : "Corridos"} {dec}/{tot}</p></div>
            <input aria-label="Mês" type="month" className="h-9 rounded-md border bg-background px-2 text-sm" value={mes} onChange={(e) => setMes(e.target.value)} />
            <Notificacoes oficina abrir={() => setAba("patio")} />
            <ThemeToggle />
            <Button variant="ghost" size="icon" title="Sair" aria-label="Sair" onClick={() => void supabase.auth.signOut()}><LogOut /></Button>
          </div>
        </header>
      <div className="mx-auto max-w-[1600px] space-y-3 p-3 sm:p-5">
        {erro && <p className="text-sm text-destructive">{erro}</p>}

        {aba === "resumo" && <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi t="Serviços SG Oficina" v={brl(V.servicos)} p={div(V.servicos, M.servicos)} sub={`Projeção ${pct(ritmo(V.servicos, M.servicos, dec, tot).projP)} · precisa ${brl(ritmo(V.servicos, M.servicos, dec, tot).nec)}/dia`} ir={() => setAba("g-tecnicos")} />
            <Kpi t="Peças SG Oficina" v={brl(V.pecas)} p={div(V.pecas, M.pecas)} sub={`Projeção ${pct(ritmo(V.pecas, M.pecas, dec, tot).projP)} · precisa ${brl(ritmo(V.pecas, M.pecas, dec, tot).nec)}/dia`} ir={() => setAba("g-tecnicos")} />
            <Kpi t="Total SG Oficina" v={brl(vend)} p={div(vend, metaOf)} sub={`Meta ${brl(metaOf)} · projeção ${brl(ritmo(vend, metaOf, dec, tot).proj)}`} ir={() => setAba("g-tecnicos")} />
            <Kpi t="Peças por R$ 1 de M.O." v={ratioOf.txt} cls={ratioOf.cls} sub="Ideal ≥ R$ 2,50 · inspeção completa em cada passagem" ir={() => setAba("tecnicos")} />
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{chefe ? "Prioridades do Chefe de Oficina" : "Prioridades do Controlador de Quadro"}</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {chefe ? <>
              <Alerta n={diag3.length} t="Diagnósticos parados > 3 dias" d="Intervir tecnicamente ou abrir caso na fábrica." ir={() => setAba("patio")} />
              <Alerta n={ret.length} t="Retornos em até 60 dias" d={rankRet[0] ? `Mais retornos: ${rankRet[0][0]} (${rankRet[0][1]})` : "Nenhum retrabalho identificado."} ir={() => setAba("qualidade")} />
              <Alerta n={baixoRatio.length} t="Técnicos com peças abaixo de R$ 2,00/M.O." d={baixoRatio.slice(0, 3).map((t) => t.nome).join(", ") || "Toda a equipe na faixa."} ir={() => setAba("tecnicos")} aviso />
              <Alerta n={preventivo.length} t="Clientes insatisfeitos no pátio" d="Fazer teste de rodagem e acompanhar a entrega." ir={() => setAba("patio")} />
              <Alerta n={pecasHoje.length} t="Peças com chegada prevista até hoje" d="Confirmar recebimento e liberar box." ir={() => setAba("patio")} aviso />
              <button type="button" onClick={() => setAba("comissao")} className="lux-card p-3 text-left transition-colors hover:border-primary">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Travas da minha remuneração</p>
                <ul className="mt-1 space-y-0.5 text-sm">
                  <li>{metaOf && vend >= metaOf ? "✅" : "⏳"} Meta oficina · <b className={tone(div(vend, metaOf))}>{pct(div(vend, metaOf))}</b></li>
                  <li>{npsCarro != null && npsCarro >= 0.85 ? "✅" : "⏳"} NPS Carro ≥ 85% · <b>{npsCarro == null ? "—" : pct(npsCarro)}</b></li>
                  <li>⏳ Vídeos de inspeção · pendente</li></ul>
              </button>
            </> : <>
              <Alerta n={pecasHoje.length} t="Peças chegando até hoje" d="Cobrar o estoque e mandar o carro para o box." ir={() => setAba("patio")} aviso />
              <Alerta n={por("autorizacao").length} t="Aguardando aprovação de orçamento" d={consOrc.slice(0, 3).map(([c, q]) => `${c} (${q})`).join(" · ") || "Nenhum orçamento pendente."} ir={() => setAba("patio")} aviso />
              <Alerta n={parados.length} t="O.S. sem mudança > 5 dias" d="Atualizar o status ou destravar a O.S." ir={() => setAba("g-os")} />
              <Alerta n={por("diag").length} t="Em diagnóstico" d={`${diag3.length} há mais de 3 dias`} ir={() => setAba("patio")} aviso />
              <Alerta n={preventivo.length} t="Clientes insatisfeitos no pátio" d="Avisar o chefe e o consultor antes da entrega." ir={() => setAba("patio")} />
              <Kpi t="Carga de agendamentos" v={`${agH.n} hoje · ${agP.n} D+1`} sub={agSub} ir={() => setAba("g-agenda")} />
            </>}
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            <button type="button" onClick={() => setAba("tecnicos")} className="lux-card p-3 text-left transition-colors hover:border-primary">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Técnicos abaixo do ritmo (&lt; 85%)</p>
              <ul className="mt-1 space-y-1 text-sm">{abaixoRitmo.slice(0, 5).map(({ t, r }) => <li key={t.nome} className="flex justify-between gap-2"><span>{t.nome} · <b className={tone(r.projP)}>{pct(r.projP)}</b></span><span className="text-xs text-muted-foreground">precisa {brl(r.nec)}/dia</span></li>)}
                {!abaixoRitmo.length && <li className="text-success">✅ Equipe toda no ritmo da meta.</li>}</ul>
              {lista[0] && <p className="mt-2 text-xs text-muted-foreground">Líder do mês: <b className="text-foreground">{lista[0].nome}</b> ({pct(lista[0].perf)})</p>}
            </button>
            <Kpi t="NPS Carro do mês" v={npsCarro == null ? "—" : pct(npsCarro)} p={npsCarro == null ? undefined : npsCarro / 0.85} sub="Meta 85% de promotores" ir={() => setAba("g-nps")} />
            <MixPassagens titulo="Mix de passagens · Carro" linhas={lista} todos={todos} />
          </div>
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

        {aba === "qualidade" && <div>
          <Box title={`Retornos por chassi · até 60 dias (${uni(ret.length)})`} fit="xl:max-h-[calc(100vh-260px)]">
            <div className="p-3 text-xs">
              <p className="mb-1 text-muted-foreground">Mesmo veículo voltou com reparo/garantia. Responsável = técnico da O.S. anterior.</p>
              <ul className="mb-2 space-y-0.5">{rankRet.map(([t, q], i) => <li key={t} className="flex justify-between"><span>{i + 1}. {t}</span><b className="text-destructive">{uni(q)}</b></li>)}</ul>
              <ul className="space-y-1">{ret.map((r) => <li key={r.os + r.osAnterior} className="rounded border border-border p-1.5">
                <b>O.S. {r.os}</b> ({r.tipo}) ← <b>O.S. {r.osAnterior}</b> ({r.tipoAnterior}) · <b className={r.dias <= 30 ? "text-destructive" : "text-warning"}>{r.dias} dias</b>
                <p className="text-muted-foreground">{r.modelo} · {r.placa || r.chassi} · técnico anterior: <b className="text-foreground">{r.tecnicoAnterior || "—"}</b></p></li>)}
                {!ret.length && <li className="text-muted-foreground">Nenhum retorno identificado (ou planilha de Passagens ainda não reimportada).</li>}</ul>
            </div>
          </Box>
        </div>}

        {aba === "comissao" && chefe && <div className="mx-auto w-full max-w-4xl space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            {[["Meta oficina carro", metaOf ? vend / metaOf : null], ["NPS carro (meta 85%)", npsCarro == null ? null : npsCarro / 0.85], ["Vídeos visualizados", null]].map(([r, v]) => (
              <div key={r as string} className="lux-card p-3 text-center"><p className="text-xs text-muted-foreground">{r as string} · R$ 500</p>
                <p className={`text-2xl font-bold ${v == null ? "text-warning" : tone(v as number)}`}>{v == null ? "Pendente" : (v as number) >= 1 ? "✅ Garantido" : pct(v as number)}</p></div>))}
          </div>
          <ExtratoComissao atual={calcularComissao(PERFIS["DELMIR"]!, metDel(vend), 0)} proj={calcularComissao(PERFIS["DELMIR"]!, metDel((vend / dec) * tot), 0)} />
        </div>}
        {aba === "dossie" && chefe && <Box title="Dossiê técnico do mês">
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="text-xs text-muted-foreground"><th className="px-3 py-2 text-left">Técnico</th><th>BSI</th><th>Revisão C7</th><th>C7 pagos</th><th>Garantia</th><th>Funilaria</th><th>Ticket</th><th>Ratio P/M.O.</th><th>Retornos</th><th>Atingimento</th></tr></thead>
            <tbody>{lista.map((t) => { const c = t.composicao ?? {}; const n = (a?: string[]) => a?.length ?? 0; const r = ratioFaixa(+t.pecas, +t.servicos);
              return <tr key={t.nome} className="border-t border-border text-center"><td className="px-3 py-2 text-left font-medium">{t.nome}</td><td>{n(c.bs)}</td><td>{n(c.rev)}</td><td>{n(c.pagos)}</td><td>{n(c.c4)}</td><td>{n(c.funilaria)}</td>
                <td>{brl(div(+t.servicos + +t.pecas, +t.passagens))}</td><td className={r.cls}>{r.txt}</td><td className={(retTec.get(norm(t.nome)) ?? 0) ? "text-destructive font-semibold" : ""}>{uni(retTec.get(norm(t.nome)) ?? 0)}</td><td className={tone(t.perf)}>{pct(t.perf)}</td></tr>; })}</tbody>
          </table></div>
        </Box>}
        {aba === "g-agregados" && <><Agregados mes={mes} cons={cons} allCons={cons} tot={tot} dec={dec} deptName={deptName} reloadCons={loadCons} />
          <details className="lux-card"><summary className="cursor-pointer px-4 py-2 text-sm font-semibold">Ranking geral de agregados <span className="text-xs text-primary">abrir/fechar</span></summary><div className="max-h-[60vh] overflow-y-auto"><RankingAgregados mes={mes} cons={cons} deptName={deptName} tot={tot} dec={dec} /></div></details></>}
        {aba === "g-tecnicos" && <><Mecanicos mes={mes} tot={tot} dec={dec} lado={(f) => <RetrabalhoOficina mes={mes} segmento={f} />} />
          <details className="lux-card"><summary className="cursor-pointer px-4 py-2 text-sm font-semibold">Ranking dos técnicos · Serviços, Peças e Total <span className="text-xs text-primary">abrir/fechar</span></summary><RankingTecnicos mes={mes} tot={tot} dec={dec} /></details></>}
        {aba === "g-os" && <ControleOS />}
        {aba === "g-agenda" && <Agendamentos mes={mes} />}
        {aba === "g-nps" && <NpsPainel mes={mes} />}
      </div>
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
function Kpi({ t, v, p, sub, cls, ir }: { t: string; v: string; p?: number | undefined; sub?: string; cls?: string; ir: () => void }) {
  return <button type="button" onClick={ir} className="lux-card group p-3 text-left transition-colors hover:border-primary">
    <p className="flex justify-between text-xs uppercase tracking-wide text-muted-foreground">{t}<span className="text-primary opacity-0 group-hover:opacity-100">→</span></p>
    <p className={`text-2xl font-bold ${cls ?? ""}`}>{v}</p>
    {p !== undefined && <><div className="mt-1 h-1.5 rounded-full bg-muted"><div className={`h-full rounded-full ${p >= 1 ? "bg-success" : p >= 0.85 ? "bg-warning" : "bg-destructive"}`} style={{ width: `${Math.min(100, p * 100)}%` }} /></div>
      <p className={`mt-0.5 text-xs font-semibold ${tone(p)}`}>{pct(p)} da meta</p></>}
    {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
  </button>;
}
function Alerta({ n, t, d, ir, aviso }: { n: number; t: string; d: string; ir: () => void; aviso?: boolean }) {
  const c = !n ? "border-l-success" : aviso ? "border-l-warning" : "border-l-destructive";
  return <button type="button" onClick={ir} className={`lux-card group border-l-4 p-3 text-left transition-colors hover:border-primary ${c}`}>
    <div className="flex items-center justify-between"><p className="text-xs uppercase tracking-wide text-muted-foreground">{t}</p><span className="text-primary opacity-0 group-hover:opacity-100">→</span></div>
    <p className={`text-3xl font-bold ${!n ? "text-success" : aviso ? "text-warning" : "text-destructive"}`}>{uni(n)}</p>
    <p className="text-xs text-muted-foreground">{d}</p>
  </button>;
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
