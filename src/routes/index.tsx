import { GuiaAcesso } from "@/components/GuiaAcesso";
import { ViradaMes } from "@/components/ViradaMes";
import { Devolucoes } from "@/components/Devolucoes";
import { TecnicosMetas } from "@/components/TecnicosMetas";
import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Barra, Box, Cmp, Kpi, Num, Posicao, Secao, Tabela, bg, brl, dataHora, div, norm, parseNum, pct, tone, uni } from "@/components/painel-ui";
import { Agregados } from "@/components/Agregados";
import { SalesImport } from "@/components/SalesImport";
import { EnvioWhatsapp } from "@/components/EnvioWhatsapp";
import { OsAbertas } from "@/components/OsAbertas";
import { ControleOS } from "@/components/ControleOS";
import { Notificacoes } from "@/components/Notificacoes";
import { Mecanicos } from "@/components/Mecanicos";
import { Equipe } from "@/components/Equipe";
import { MinhaPerformance } from "@/components/MinhaPerformance";
import { CockpitOficina } from "@/components/CockpitOficina";
import { AcessoTunap } from "@/components/AcessoTunap";
import { MeuDesempenhoTecnico } from "@/components/MeuDesempenhoTecnico";
import { RankingAgregados, RankingTecnicos } from "@/components/RankingExtra";
import { MetasExecutivo } from "@/components/MetasExecutivo";
import { MetasAno } from "@/components/MetasAno";
import { Cockpit } from "@/components/Cockpit";
import { NpsPainel } from "@/components/NpsPainel";
import { PecasEstoque } from "@/components/PecasEstoque";
import { CentralGestao, ConsultoresTela } from "@/components/TelasGestor";
import { CadeadoMes } from "@/components/CadeadoMes";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CalendarClock, Car, ChevronDown, ClipboardList, Download, Gauge, Gem, LayoutDashboard, LogOut, Menu, Package, Sparkles, Settings, Star, Target, TrendingUp, Upload, Users, Wrench, X } from "lucide-react";
import bmwLogo from "@/assets/bmw-logo.asset.json";
import carroSilhueta from "@/assets/carro-silhueta.jpg";
import { localDay, sourceLabels, sourceStatus, tabUpdateStatus, UPDATE_EVENT, type UpdateRecord, type UpdateSource } from "@/lib/update-status";
import { calcPerformance } from "@/lib/performance";
import { useAccessPresence } from "@/hooks/use-access-presence";
import { useResumoMes } from "@/hooks/use-resumo-mes";
import { AbaTopo, type TopoKpi } from "@/components/AbaTopo";
import { AcessoriosEstetica } from "@/components/AcessoriosEstetica";
import { ImportadorUnificado } from "@/components/ImportadorUnificado";
import { diasUteis } from "@/lib/dias-uteis";
import { toast } from "sonner";
import { RetrabalhoOficina } from "@/components/RetrabalhoOficina";
import { Agendamentos } from "@/components/Agendamentos";
import { AgendaMetas } from "@/components/AgendaMetas";
import { ITENS } from "@/lib/agregados";
import { inicializarTecnicosMes } from "@/lib/tecnicos-mes";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PAINEL ESTRATÉGICO KLEDSON | Metas e Projeções" },
      { name: "description", content: "Metas, projeção de serviços e peças por consultor e departamento, performance diária e relatório mensal." },
      { property: "og:title", content: "PAINEL ESTRATÉGICO KLEDSON | Metas e Projeções" },
      { property: "og:description", content: "Projeção, performance diária e acumulada, comparação com o líder e recomendações." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

type Dept = { id: string; nome: string };
type Cons = { id: string; nome: string; department_id: string | null; telefone: string };
type Goal = { consultant_id: string; servicos: number; pecas: number };
type Sale = { consultant_id: string; dia: string; servicos: number; pecas: number; margem_pecas: number };
type Params = { du_totais: number; du_decorridos: number; dc_totais: number; dc_decorridos: number; base: string };

const defParams: Params = { du_totais: 22, du_decorridos: 1, dc_totais: 30, dc_decorridos: 1, base: "uteis" };

function Index() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    return () => data.subscription.unsubscribe();
  }, []);
  const [papel, setPapel] = useState<string | null | undefined>(undefined);
  const email = session?.user.email ?? "";
  useAccessPresence(Boolean(session) && papel !== undefined && papel !== "vendedor" && papel !== "tunap");
  useEffect(() => {
    if (!session) { setPapel(undefined); return; }
    supabase.from("team_members").select("papel").ilike("email", email).maybeSingle().then(({ data }) => setPapel(data?.papel ?? null));
  }, [session, email]);
  if (!ready || (session && papel === undefined)) return <div className="p-10 text-center text-muted-foreground">Carregando…</div>;
  if (!session) return <Login />;
  const tela = papel === "tecnico" ? <MeuDesempenhoTecnico /> : papel === "chefe_oficina" ? <CockpitOficina chefe /> : papel === "controlador" ? <CockpitOficina chefe={false} /> : papel === "tunap" ? <AcessoTunap /> : papel === "vendedor" ? <MinhaPerformance /> : <Painel email={email} />;
  return <>{tela}<GuiaAcesso email={email} papel={papel} /></>;
}

function Login() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [modo, setModo] = useState<"entrar" | "criar">("entrar");
  const [msg, setMsg] = useState("");
  const enviar = async () => {
    setMsg("");
    const { error } = modo === "entrar"
      ? await supabase.auth.signInWithPassword({ email, password: senha })
      : await supabase.auth.signUp({ email, password: senha, options: { emailRedirectTo: window.location.origin } });
    if (error) setMsg(error.message);
    else if (modo === "criar") setMsg("Conta criada. Confirme pelo link enviado ao seu e-mail.");
  };
  const google = async () => {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) setMsg(String(r.error.message ?? r.error));
  };
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <img src={bmwLogo.url} alt="BMW" className="size-14" />
          <ThemeToggle />
        </div>
        <h1 className="text-xl font-bold">PAINEL ESTRATÉGICO <span className="font-medium text-primary">KLEDSON</span></h1>
        <p className="text-sm text-muted-foreground">{modo === "entrar" ? "Entre para acessar seus dados de qualquer lugar." : "Crie sua conta."}</p>
        <input className="w-full rounded-lg border border-input bg-background px-3 py-2" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="w-full rounded-lg border border-input bg-background px-3 py-2" type="password" placeholder="Senha" value={senha} onChange={(e) => setSenha(e.target.value)} />
        <Button onClick={enviar} className="w-full">{modo === "entrar" ? "Entrar" : "Criar conta"}</Button>
        <Button onClick={google} variant="outline" className="w-full">Continuar com Google</Button>
        <Button variant="link" onClick={() => setModo(modo === "entrar" ? "criar" : "entrar")} className="w-full text-sm text-muted-foreground">
          {modo === "entrar" ? "Não tem conta? Criar" : "Já tenho conta"}
        </Button>
        {msg && <p className="text-sm text-destructive">{msg}</p>}
      </div>
    </div>
  );
}

function Painel({ email }: { email: string }) {
  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7));
  const [depts, setDepts] = useState<Dept[]>([]);
  const [cons, setCons] = useState<Cons[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [params, setParams] = useState<Params>(defParams);
  const [tab, setTabRaw] = useState("cockpit");
  const [menu, setMenu] = useState(false);
  const [projSub, setProjSub] = useState<"proj-serv" | "proj-pec" | "proj-total">("proj-serv");
  const setTab = (k: string) => { if (k.startsWith("proj-")) { setProjSub(k as typeof projSub); setTabRaw("proj"); } else setTabRaw(k); };
  const relatorio = false;
  const show = (k: string) => tab === k || (tab === "proj" && k === projSub) || relatorio;
  const [filtroDept, setFiltroDept] = useState("todos");
  const [updates, setUpdates] = useState<UpdateRecord[]>([]);
  const [clock, setClock] = useState(() => new Date());
  const lastUp = updates[0] ?? null;
  const tabKey = (k: string) => (k === "proj" ? projSub : k === "pecas" ? "painel" : k);
  const status = tabUpdateStatus(tabKey(tab), mes, updates, clock);
  const [abrirWhats, setAbrirWhats] = useState(false);
  const resumo = useResumoMes(mes);

  const loadUpdates = useCallback(async () => {
    const { data, error } = await supabase.from("update_log").select("at,nome,origem,mes")
      .or(`mes.eq.${mes},mes.is.null`).order("at", { ascending: false }).limit(1000);
    if (!error) setUpdates(data ?? []);
    setClock(new Date());
  }, [mes]);
  useEffect(() => {
    setUpdates([]);
    void loadUpdates();
    const refresh = () => { void loadUpdates(); };
    window.addEventListener(UPDATE_EVENT, refresh);
    window.addEventListener("focus", refresh);
    const timer = window.setInterval(refresh, 60000);
    return () => {
      window.removeEventListener(UPDATE_EVENT, refresh);
      window.removeEventListener("focus", refresh);
      window.clearInterval(timer);
    };
  }, [loadUpdates]);
  const openUpdate = (source: UpdateSource) => {
    setTab(source === "controle-os" ? source : "importacoes");
  };

  const gravarParams = useCallback((p: Params) => supabase.from("month_params").upsert({
    mes, base: p.base, dc_totais: p.dc_totais, dc_decorridos: p.dc_decorridos,
    du_totais: Math.round(p.du_totais), du_decorridos: Math.round(p.du_decorridos),
    du_totais_dec: p.du_totais, du_decorridos_dec: p.du_decorridos,
  }, { onConflict: "user_id,mes" }), [mes]);
  const load = useCallback(async () => {
    await inicializarTecnicosMes(mes);
    const [y, m] = mes.split("-").map(Number);
    const fim = new Date(y!, m!, 0).getDate();
    const [d, c, g, s, p, dv] = await Promise.all([
      supabase.from("departments").select("id,nome").order("nome"),
      supabase.from("consultants").select("id,nome,department_id,telefone").order("nome"),
      supabase.from("goals").select("consultant_id,servicos,pecas").eq("mes", mes),
      supabase.from("daily_sales").select("consultant_id,dia,servicos,pecas,margem_pecas").gte("dia", `${mes}-01`).lte("dia", `${mes}-${fim}`).order("dia"),
      supabase.from("month_params").select("*").eq("mes", mes).maybeSingle(),
      supabase.from("parts_returns").select("consultant_id,valor").eq("mes", mes),
    ]);
    setDepts(d.data ?? []); setCons(c.data ?? []);
    setGoals((g.data ?? []).map((x) => ({ ...x, servicos: +x.servicos, pecas: +x.pecas })));
    // Devoluções manuais entram como lançamento negativo de peças no último dia → faturamento líquido em todas as visões.
    const devs = (dv.data ?? []).map((x) => ({ consultant_id: x.consultant_id, dia: `${mes}-${String(fim).padStart(2, "0")}`, servicos: 0, pecas: -Number(x.valor), margem_pecas: 0 }));
    setSales([...(s.data ?? []).map((x) => ({ ...x, servicos: +x.servicos, pecas: +x.pecas, margem_pecas: +(x.margem_pecas ?? 0) })), ...devs]);
    const row = p.data as (Params & { du_totais_dec: number | null; du_decorridos_dec: number | null }) | null;
    // Dias úteis com meio dia (sábado 0,5) ficam nas colunas *_dec; as inteiras são cópia arredondada.
    let np: Params = row
      ? { base: row.base, dc_totais: row.dc_totais, dc_decorridos: row.dc_decorridos, du_totais: Number(row.du_totais_dec ?? row.du_totais), du_decorridos: Number(row.du_decorridos_dec ?? row.du_decorridos) }
      : { ...defParams, dc_totais: fim, du_totais: diasUteis(mes, fim) };
    const hoje = new Date();
    const mesHoje = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
    if (mes === mesHoje) {
      const dia = hoje.getDate();
      if (!row) {
        np = { ...np, dc_decorridos: dia, du_decorridos: diasUteis(mes, dia) };
        await gravarParams(np);
      } else if (dia > np.dc_decorridos) {
        // Avança só os dias novos desde o último registro, preservando ajustes manuais (ex.: feriado local).
        np = { ...np, du_decorridos: np.du_decorridos + diasUteis(mes, dia) - diasUteis(mes, np.dc_decorridos), dc_decorridos: dia };
        await gravarParams(np);
      }
    }
    setParams(np);
  }, [mes, gravarParams]);
  useEffect(() => { load(); }, [load]);

  const tot = params.base === "uteis" ? params.du_totais : params.dc_totais;
  const dec = params.base === "uteis" ? params.du_decorridos : params.dc_decorridos;

  const calc = (servicos: number, pecas: number, mS: number, mP: number, margem = 0) =>
    calcPerformance(servicos, pecas, mS, mP, dec, tot, margem);
  type Calc = ReturnType<typeof calc>;
  const margemTxt = (x: { margem: number; pecas: number }) => (x.margem && x.pecas ? pct(x.margem / x.pecas) : "—");

  const deptName = (id: string | null) => depts.find((d) => d.id === id)?.nome ?? "Sem departamento";
  const visiveis = cons.filter((c) => filtroDept === "todos" || c.department_id === filtroDept);

  const linhas = visiveis.map((c) => {
    const ss = sales.filter((s) => s.consultant_id === c.id);
    const g = goals.find((x) => x.consultant_id === c.id) ?? { servicos: 0, pecas: 0 };
    return { c, ...calc(ss.reduce((a, s) => a + s.servicos, 0), ss.reduce((a, s) => a + s.pecas, 0), g.servicos, g.pecas, ss.reduce((a, s) => a + s.margem_pecas, 0)) };
  }).sort((a, b) => b.perf - a.perf);
  const lider = linhas[0];
  const soma = (arr: (Calc)[]) => calc(arr.reduce((a, l) => a + l.servicos, 0), arr.reduce((a, l) => a + l.pecas, 0), arr.reduce((a, l) => a + l.mS, 0), arr.reduce((a, l) => a + l.mP, 0), arr.reduce((a, l) => a + l.margem, 0));
  // Consultores que vendem apenas peças — ficam fora da aba Serviços
  const SO_PECAS = ["MARCELA.S", "GEOVANA.M", "NAILTON/THIERRY"];
  const soPecas = (nome: string) => SO_PECAS.includes(nome.trim().toUpperCase());
  // Departamentos que só vendem peças — não mostram a linha de serviços no Painel
  const SEM_SERVICOS = ["ACESSORIOS", "ESTETICA", "BALCAO"];
  const semServicos = (nome: string) =>
    SEM_SERVICOS.includes(nome.trim().toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, ""));
  // Margem ideal de peças por departamento — parâmetro de cores do gestor
  const MARGEM_IDEAL: Record<string, number> = { "SG OFICINA": 0.33, ESTETICA: 0.38, ACESSORIOS: 0.31, BALCAO: 0.31, "SC FUNILARIA": 0.24 };
  const margemIdeal = (nome: string) =>
    MARGEM_IDEAL[nome.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")] ?? 0;
  // Cor da margem: verde ≥ ideal, amarelo ≥ 85% da ideal, vermelho abaixo
  const margemTone = (nome: string, m: number, pecas: number) => {
    const ideal = margemIdeal(nome);
    if (!ideal || !m || !pecas) return "";
    return tone(m / pecas / ideal);
  };
  const linhasServ = linhas.filter((l) => !soPecas(l.c.nome));
  const totalServ = soma(linhasServ);
  const liderServ = linhasServ.length ? linhasServ.reduce((a, l) => (l.perfS > a.perfS ? l : a), linhasServ[0]!) : null;
  const liderPec = linhas.length ? linhas.reduce((a, l) => (l.perfP > a.perfP ? l : a), linhas[0]!) : null;
  const total = soma(linhas);
  // Ideal ponderado de margem de peças (peso = peças vendidas de cada departamento)
  const idealTotal = div(linhas.reduce((s, l) => s + margemIdeal(deptName(l.c.department_id)) * l.pecas, 0), linhas.reduce((s, l) => s + l.pecas, 0));
  const porDept = [...new Set(linhas.map((l) => l.c.department_id))].map((id) => {
    const nome = deptName(id);
    const ls = linhas.filter((l) => l.c.department_id === id);
    return { nome, ...soma(semServicos(nome) ? ls.map((l) => ({ ...l, servicos: 0, mS: 0 })) : ls) };
  });

  const recomendar = (l: (typeof linhas)[number]) => {
    const r: string[] = [];
    if (l.meta === 0) return ["Cadastre a meta do mês para este consultor."];
    if (l.projPct >= 1) r.push("No ritmo para bater a meta. Manter o ritmo e buscar superação.");
    else r.push(`Precisa vender ${brl(l.nec)}/dia (hoje faz ${brl(l.mediaDia)}/dia) para bater a meta.`);
    if (l.mS && l.projPctS < 1) r.push(`Serviços: faltam ${brl(Math.max(l.mS - l.servicos, 0))}; precisa ${brl(l.necS)}/dia. Revisar orçamentos pendentes e agendamentos.`);
    if (l.mP && l.projPctP < 1) r.push(`Peças: faltam ${brl(Math.max(l.mP - l.pecas, 0))}; precisa ${brl(l.necP)}/dia. Oferecer itens complementares em cada atendimento.`);
    if (l.mS && l.mP && Math.abs(l.perfS - l.perfP) > 0.15) r.push(`Desequilíbrio: ${l.perfS < l.perfP ? "Serviços" : "Peças"} está bem abaixo do outro grupo. Foco nesse ponto.`);
    if (lider && lider.c.id !== l.c.id && lider.mediaDia > l.mediaDia) r.push(`O líder (${lider.c.nome}) fatura ${brl(lider.mediaDia - l.mediaDia)}/dia a mais. Observar a abordagem dele.`);
    return r;
  };

  const [rascunho, setRascunho] = useState<Params | null>(null);
  const salvarParams = (p: Params) => setRascunho(p);
  const form = rascunho ?? params;
  const confirmarParams = async () => {
    if (!rascunho) return;
    const { error } = await gravarParams(rascunho);
    if (error) { toast.error("Não foi possível salvar os dias: " + error.message); return; }
    setParams(rascunho); setRascunho(null);
    toast.success("Dias do mês salvos.");
  };

  const exportar = () => {
    const h = ["Departamento", "Consultor", "Real. Serviços", "Meta Serviços", "Perf. Serv.", "Proj. Serviços", "Real. Peças", "Meta Peças", "Perf. Peças", "Proj. Peças", "Realizado", "Meta", "Perf.", "Projeção", "Proj. %", "Gap p/ líder (pts)", "Recomendações"];
    const f = (n: number) => n.toFixed(2).replace(".", ",");
    const rows = linhas.map((l) => [deptName(l.c.department_id), l.c.nome, f(l.servicos), f(l.mS), pct(l.perfS), f(l.projS), f(l.pecas), f(l.mP), pct(l.perfP), f(l.projP), f(l.real), f(l.meta), pct(l.perf), f(l.proj), pct(l.projPct), ((lider!.perf - l.perf) * 100).toFixed(1).replace(".", ","), recomendar(l).join(" | ")]);
    porDept.forEach((d) => rows.push([d.nome, "TOTAL DEPARTAMENTO", f(d.servicos), f(d.mS), pct(d.perfS), f(d.projS), f(d.pecas), f(d.mP), pct(d.perfP), f(d.projP), f(d.real), f(d.meta), pct(d.perf), f(d.proj), pct(d.projPct), "", ""]));
    const csv = "\uFEFF" + [h, ...rows].map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(";")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `relatorio-${mes}.csv`; a.click();
  };

  // 11 abas oficiais; algumas agrupam sub-abas (mantém deep links setTab antigos).
  const tabs: [string, string, typeof Gauge, string[]][] = [
    ["cockpit", "Dashboard", Gauge, []],
    ["painel", "Central de Gestão", LayoutDashboard, ["proj", "os"]],
    ["ranking", "Consultores", Users, []],
    ["agregados", "Agregados", Gem, []],
    ["mecanicos", "Oficina & Técnicos", Wrench, []],
    ["pecas", "Peças & Estoque", Package, []],
    ["acessorios", "Acessórios & Estética", Sparkles, []],
    ["controle-os", "Ordens de Serviço", Car, []],
    ["agendamentos", "Agendamentos", CalendarClock, []],
    ["nps", "NPS & Satisfação", Star, []],
    ["metas", "Metas & Planejamento", Target, []],
    ["importacoes", "Importações & Config.", Upload, ["config"]],
  ];
  const subLabels: Record<string, [string, typeof Gauge]> = { painel: ["Visão geral", LayoutDashboard], proj: ["Projeções", TrendingUp], os: ["Projeção + O.S.", ClipboardList], importacoes: ["Importações", Upload], config: ["Configurações", Settings] };
  const grupo = tabs.find(([k, , , subs]) => k === tab || subs.includes(tab));
  const tabLabel = tab === "proj" || tab === "os" || tab === "config" ? subLabels[tab]![0] : (grupo?.[1] ?? "");

  const [anoMes, mesNum] = mes.split("-").map(Number);
  const mesExt = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(anoMes!, mesNum! - 1, 1));
  const mesExtenso = mesExt.charAt(0).toUpperCase() + mesExt.slice(1);
  const navList = (
    <nav aria-label="Abas do painel" className="flex flex-col gap-0.5">
      {tabs.map(([k, l, Icon, subs], i) => {
        const keys = [k, ...subs];
        const stale = k === "importacoes" ? status.pending.some((x) => x !== "controle-os") : keys.some((x) => tabUpdateStatus(tabKey(x), mes, updates, clock).stale);
        const ativo = keys.includes(tab);
        return <Fragment key={k}>{i === 9 && <span aria-hidden className="my-1 h-px bg-border" />}
          <button type="button" onClick={() => { setTab(k); setMenu(false); }}
            data-update-status={stale ? "pending" : "current"} title={stale ? `${l}: atualização pendente` : l}
            aria-current={ativo ? "page" : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-1.5 text-left text-sm transition-colors ${ativo ? "bg-gradient-to-r from-primary/30 to-primary/5 font-semibold text-foreground shadow-[inset_3px_0_0_var(--color-primary)]" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
            <Icon strokeWidth={1.5} className={`size-4 shrink-0 ${ativo ? "text-primary" : ""}`} />
            <span className="flex-1">{l}</span>
            {stale && <span className="update-alert size-2 rounded-full bg-destructive" aria-label="atualização pendente" />}
          </button></Fragment>;
      })}
    </nav>
  );
  const marca = (
    <div className="flex items-center gap-3">
      <img src={bmwLogo.url} alt="BMW" className="size-10 shrink-0" />
      <div className="min-w-0 leading-tight">
        <p className="text-sm font-bold tracking-wide">BMW PÓS-VENDA</p>
        <p className="text-[10px] text-muted-foreground">Mais que serviço, é experiência</p>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">Haus Motors · Kledson</p>
      </div>
    </div>
  );
  const rodapeMenu = (
    <div className="border-t border-border p-2">
      <img src={carroSilhueta} alt="" aria-hidden loading="lazy" width={1152} height={576} className="mx-auto max-h-11 w-auto opacity-80 mix-blend-screen" />
      <div className="m-stripe mx-auto mt-2 w-16 rounded-full" />
      <p className="mt-2 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Juntos pela melhor experiência.</p>
      <p className="mt-1 break-all text-center text-[10px] text-muted-foreground">{email}</p>
    </div>
  );
  const subs = grupo?.[3] ?? [];
  const subBar = subs.length > 0 && !relatorio && (
    <div role="tablist" className="flex flex-wrap gap-2 print:hidden">
      {[grupo![0], ...subs].map((k) => { const [n, I] = subLabels[k]!; const on = tab === k; return (
        <button key={k} role="tab" aria-selected={on} type="button" onClick={() => setTab(k)} className={`flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium ${on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground"}`}><I className="size-4" />{n}</button>
      ); })}
    </div>
  );
  const pctMeta = (r: number, m: number): TopoKpi["cls"] => tone(div(r, m));
  const rest = Math.max(tot - dec, 0);
  const topo = (() => {
    if (relatorio) return null;
    const t = total; const meta = t.mS + t.mP; const real = t.servicos + t.pecas;
    const ranking = [...linhas].filter((l) => l.meta > 0).sort((a, b) => b.perf - a.perf);
    switch (tab) {
      case "painel": case "ranking": case "pecas": return null;
      case "proj": case "os": return <AbaTopo titulo="Central de Gestão" sub={`Visão consolidada da loja por departamento · ${mesExtenso}`} icon={LayoutDashboard} kpis={[
        { label: "Faturamento total", value: brl(real), sub: `${pct(div(real, meta))} de ${brl(meta)}`, p: div(real, meta), barra: "bg-primary", cls: pctMeta(real, meta) },
        { label: "Mão de obra", value: brl(t.servicos), sub: `${pct(t.perfS)} de ${brl(t.mS)}`, p: t.perfS, barra: "bg-neon" },
        { label: "Peças", value: brl(t.pecas), sub: `${pct(t.perfP)} de ${brl(t.mP)}`, p: t.perfP, barra: "bg-coral" },
        { label: "Falta para a meta", value: brl(Math.max(meta - real, 0)), sub: rest ? `${brl(Math.max(meta - real, 0) / rest)}/dia em ${rest} dia(s)` : "Mês encerrado", cls: "text-warning" },
      ]}>
        {real > 0 && <div className="lux-card flex items-center gap-3 px-3 py-1.5 text-xs"><span className="shrink-0 uppercase tracking-wide text-muted-foreground">Composição da receita</span>
          <span className="shrink-0"><span className="mr-1 inline-block size-2 rounded-full bg-neon" />Serviços {pct(div(t.servicos, real))}</span>
          <div className="flex h-2 flex-1 overflow-hidden rounded-full"><div className="bg-neon" style={{ width: `${div(t.servicos, real) * 100}%` }} /><div className="bg-coral flex-1" /></div>
          <span className="shrink-0">Peças {pct(div(t.pecas, real))}<span className="ml-1 inline-block size-2 rounded-full bg-coral" /></span></div>}
      </AbaTopo>;
      case "ranking": return <AbaTopo titulo="Consultores" sub="Ranking, desempenho individual e comparação com o líder" icon={Users} kpis={[
        { label: "Faturado pelo time", value: brl(real), sub: `Serviços ${brl(t.servicos)} · Peças ${brl(t.pecas)}` },
        { label: "Meta coletiva", value: brl(meta) },
        { label: "Atingimento", value: pct(div(real, meta)), p: div(real, meta), cls: pctMeta(real, meta), sub: `Projeção ${pct(t.projPct)}` },
      ]}>
        {ranking.length >= 3 && <div className="flex flex-wrap gap-2 text-xs">{ranking.slice(0, 3).map((l, i) => (
          <span key={l.c.id} className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1">
            <span className={`flex size-5 items-center justify-center rounded-full text-[10px] font-bold ${i === 0 ? "bg-warning text-background" : i === 1 ? "bg-muted-foreground text-background" : "bg-coral text-background"}`}>{i + 1}º</span>
            <b>{l.c.nome}</b><span className={`font-semibold ${tone(l.perf)}`}>{pct(l.perf)}</span>
          </span>))}</div>}
      </AbaTopo>;
      case "metas": return <AbaTopo titulo="Metas & Planejamento" sub="Planejamento e acompanhamento das metas do mês" icon={Target} kpis={[
        { label: "Meta de serviços", value: brl(t.mS), sub: `Realizado ${pct(t.perfS)} · projeção ${pct(t.projPctS)}`, p: t.projPctS, barra: "bg-neon" },
        { label: "Meta de peças", value: brl(t.mP), sub: `Realizado ${pct(t.perfP)} · projeção ${pct(t.projPctP)}`, p: t.projPctP, barra: "bg-coral" },
        { label: "Meta total", value: brl(meta), sub: `Projeção ${brl(t.proj)} (${pct(t.projPct)})`, p: t.projPct, cls: pctMeta(t.proj, meta) },
        { label: "Ritmo diário necessário", value: brl(t.nec), sub: `${rest} dia(s) restantes · ${linhas.filter((l) => l.meta === 0).length} sem meta` },
      ]} />;
      case "agregados": return <AbaTopo titulo="Agregados" sub="Módulo independente · não soma nos totais da loja" icon={Gem} kpis={[]} />;
      case "mecanicos": return <AbaTopo titulo="Oficina & Técnicos" sub="Produtividade da oficina, passagens por tipo e metas dos técnicos" icon={Wrench} kpis={[]} />;
      case "controle-os": return <AbaTopo titulo="Ordens de Serviço" sub={`Status das O.S. em aberto e tempo na oficina · ${uni(resumo.abertas)} abertas · ${uni(resumo.parados)} acima de 30 dias`} icon={Car} kpis={[]} />;
      case "agendamentos": return <AbaTopo titulo="Agendamentos" sub="Radar D+1, follow-up do testador, passantes × agendados, fechamento do dia e faltas" icon={CalendarClock} kpis={[]} />;
      case "acessorios": return <AbaTopo titulo="Acessórios & Estética" sub="Geovana e Marcela · faturado + a faturar, matriz RVD e comissões para o RH" icon={Sparkles} kpis={[]} />;
      case "pecas": return <AbaTopo titulo="Peças & Estoque" sub="Faturamento de peças por canal, margem e ranking" icon={Package} kpis={[]} />;
      case "nps": return <AbaTopo titulo="NPS & Satisfação" sub="Qualidade e pesquisa da montadora · aguardando planilha de pesquisas" icon={Star} kpis={[]} />;
      case "importacoes": case "config": return <AbaTopo titulo="Importações & Configurações" sub="Atualização diária das fontes e ajustes do painel" icon={Upload} kpis={(Object.keys(sourceLabels) as UpdateSource[]).map((source) => ({ source, ...sourceStatus(source, mes, updates, clock) })).map(({ source, record, fresh }) => ({
        label: sourceLabels[source], value: fresh ? "✅ Hoje" : "❌ Pendente", cls: fresh ? "text-success" : "text-destructive", sub: record ? `${dataHora(record.at)} · ${record.nome}` : "Nenhuma atualização no mês",
      }))} />;
      default: return null;
    }
  })();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-card print:hidden lg:flex">
        <div className="border-b border-border p-4">{marca}</div>
        <div className="flex-1 overflow-y-auto p-3">{navList}</div>
        {rodapeMenu}
      </aside>
      {menu && <div className="fixed inset-0 z-40 lg:hidden print:hidden">
        <button aria-label="Fechar menu" className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={() => setMenu(false)} />
        <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-border bg-card shadow-xl">
          <div className="flex items-center justify-between border-b border-border p-4">{marca}<Button variant="ghost" size="icon" aria-label="Fechar menu" onClick={() => setMenu(false)}><X /></Button></div>
          <div className="flex-1 overflow-y-auto p-3">{navList}</div>
          {rodapeMenu}
        </div>
      </div>}

      <div className="lg:pl-64">
      <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur print:hidden">
        <div className="flex items-center gap-2 px-3 py-1.5 sm:px-5">
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menu" onClick={() => setMenu(true)}><Menu /></Button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold sm:text-lg">{tabLabel}</h1>
            <div className="flex items-center gap-2" title="Tempo decorrido do mês = ritmo esperado da meta">
              <span className="text-[11px] text-muted-foreground">{params.base === "uteis" ? "Úteis" : "Corridos"} {dec}/{tot}</span>
              <div className="h-1 w-16 overflow-hidden rounded-full bg-muted sm:w-32"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(div(dec, tot) * 100, 100)}%` }} /></div>
              <span className="text-[11px] text-muted-foreground">{pct(div(dec, tot))}</span>
            </div>
          </div>
          <div className="hidden items-center gap-2 lg:flex">
          <input aria-label="Mês do relatório (topo)" type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="min-w-0 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm sm:w-auto" />
          <select aria-label="Departamento (topo)" value={filtroDept} onChange={(e) => setFiltroDept(e.target.value)} className="min-w-0 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm sm:w-auto">
            <option value="todos">Todos departamentos</option>
            {depts.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
          </select>
          {mes !== localDay(clock).slice(0, 7) && <span className="self-center text-xs text-muted-foreground">Mês arquivado</span>}
        </div>
          <div className="flex shrink-0 items-center gap-0.5 sm:gap-2">
            {status.pending.length > 0 && <Button type="button" size="sm" variant="destructive" className="update-alert h-8 gap-1 px-2 text-xs" title={`Pendente: ${status.pending.map((x) => sourceLabels[x]).join(", ")}`} onClick={() => openUpdate(status.pending[0]!)}><AlertTriangle className="size-4" />{status.pending.length}</Button>}
            <ThemeToggle />
            <Notificacoes abrir={() => setTab("controle-os")} />
            <Button variant="ghost" size="icon" title="Sair" aria-label="Sair" onClick={() => void supabase.auth.signOut()}><LogOut /></Button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 px-3 pb-1.5 sm:flex sm:px-5 lg:hidden">
          <input aria-label="Mês do relatório" type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="min-w-0 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm sm:w-auto" />
          <select aria-label="Departamento" value={filtroDept} onChange={(e) => setFiltroDept(e.target.value)} className="min-w-0 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm sm:w-auto">
            <option value="todos">Todos departamentos</option>
            {depts.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
          </select>
          {mes !== localDay(clock).slice(0, 7) && <span className="self-center text-xs text-muted-foreground">Mês arquivado</span>}
        </div>
      </header>

      {status.latest.length > 0 && <details data-testid="update-banner" className={`group border-b print:hidden ${status.stale ? "border-destructive/40 bg-destructive/10" : "border-border bg-primary/5 text-muted-foreground"}`}>
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-1 text-[11px] sm:px-5">
          {status.pending.length > 0
            ? <span className="font-semibold text-destructive">⚠️ {status.pending.length} fonte(s) pendente(s): {status.pending.map((x) => sourceLabels[x]).join(", ")}</span>
            : <span>✅ Dados atualizados</span>}
          <ChevronDown className="ml-auto size-4 transition-transform group-open:rotate-180" />
        </summary>
        <div className="flex flex-wrap items-center gap-3 px-4 pb-2 text-xs sm:px-5">
          <div className="min-w-0 flex-1 space-y-1">
            {status.latest.map(({ source, record, stale, fresh }) => <p key={source} className="break-words">
              {sourceLabels[source]}: {record ? <>{fresh ? "✅" : stale ? "❌" : ""} última atualização {dataHora(record.at)} por <span className="font-medium">{record.nome}</span> · {record.origem}</> : "❌ nenhuma atualização registrada."}
            </p>)}
          </div>
          {status.pending.map((source) => <Button key={source} type="button" variant="outline" size="sm" onClick={() => openUpdate(source)} className="h-auto whitespace-normal font-semibold text-destructive">
            ⚠️ Atualizar {sourceLabels[source]}{source === "controle-os" ? " da semana" : " de hoje"}
          </Button>)}
        </div>
      </details>}

      <main className={`mx-auto min-w-0 max-w-[1920px] space-y-3 px-3 py-3 sm:px-5 ${tab === "painel" ? "painel-phone" : ""}`}>
        {topo}
        {subBar}
        {show("os") && <Secao relatorio={relatorio} titulo="Projeção + Ordens de Serviço abertas"><OsAbertas linhas={linhas} mes={mes} soPecas={soPecas} tot={tot} dec={dec} deptName={deptName} semServicos={semServicos} /></Secao>}
        {tab === "painel" && !relatorio && <CentralGestao linhas={linhas} porDept={porDept} total={total} sales={sales} mes={mes} tot={tot} dec={dec} setTab={setTab} exportar={exportar} whats={<button type="button" onClick={() => setAbrirWhats(!abrirWhats)} className="rounded-md border border-border px-2.5 py-1 hover:bg-muted">{abrirWhats ? "Ocultar WhatsApp" : "WhatsApp da equipe"}</button>} />}
        {tab === "painel" && abrirWhats && !relatorio && <EnvioWhatsapp linhas={linhas} lider={lider} liderServ={liderServ} liderPec={liderPec} mes={mes} dec={dec} tot={tot} reload={load} />}

        {tab === "proj" && !relatorio && (
          <div className="flex flex-wrap gap-2 print:hidden" role="tablist" aria-label="Tipo de projeção">
            {([["proj-serv", "Serviços"], ["proj-pec", "Peças"], ["proj-total", "Serviços & Peças"]] as const).map(([k, n]) => (
              <button key={k} role="tab" aria-selected={projSub === k} onClick={() => setProjSub(k)} className={`rounded-full border px-4 py-1.5 text-sm font-medium ${projSub === k ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"}`}>{n}</button>
            ))}
          </div>
        )}
        {show("proj-serv") && (
          <Secao relatorio={relatorio} titulo="Projeção de Serviços">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi label="Realizado Serviços" value={brl(totalServ.servicos)} sub={`Meta ${brl(totalServ.mS)} · ${pct(totalServ.perfS)}`} cls={tone(totalServ.perfS)} />
              <Kpi label="Projeção Serviços" value={brl(totalServ.projS)} sub={`${pct(totalServ.projPctS)} da meta de ${brl(totalServ.mS)}`} cls={tone(totalServ.projPctS)} />
              <Kpi label="Falta para a meta" value={brl(Math.max(totalServ.mS - totalServ.servicos, 0))} sub={`Precisa ${brl(totalServ.necS)}/dia (${Math.max(tot - dec, 0)} dias restantes)`} />
              <Kpi label="Líder de Serviços" value={liderServ ? liderServ.c.nome : "—"} sub={liderServ ? `${pct(liderServ.perfS)} de performance` : ""} />
            </div>
            <Box title="Projeção individual de serviços">
              <Tabela head={["#", "Consultor", "Depto", "Realizado", "Meta", "Performance", "Projeção", "Proj. %", "Média/dia", "Necessário/dia", "vs. Líder"]}>
                {linhasServ.length === 0 && <tr><td colSpan={11} className="px-3 py-10 text-center text-muted-foreground">Sem dados. Cadastre consultores em "Configurar" e cole os dados do dia.</td></tr>}
                {linhasServ.map((l, i) => (
                  <tr key={l.c.id} className="border-t border-border">
                    <td className="px-3 py-2"><Posicao i={i} /></td>
                    <td className="px-3 py-2 font-medium">{l.c.nome}</td>
                    <td className="px-3 py-2 text-muted-foreground">{deptName(l.c.department_id)}</td>
                    <td className="px-3 py-2">{brl(l.servicos)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{brl(l.mS)}</td>
                    <td className={`px-3 py-2 font-semibold ${tone(l.perfS)}`}>{pct(l.perfS)}</td>
                    <td className={`px-3 py-2 ${tone(l.projPctS)}`}>{brl(l.projS)}</td>
                    <td className="px-3 py-2"><Barra p={l.projPctS} /></td>
                    <td className="px-3 py-2">{brl(div(l.servicos, dec))}</td>
                    <td className="px-3 py-2">{l.necS ? brl(l.necS) : "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2">{liderServ && liderServ.c.id === l.c.id ? <span className="font-semibold text-primary">Líder</span> : liderServ ? <span className="text-destructive">−{((liderServ.perfS - l.perfS) * 100).toFixed(1)} pts</span> : "—"}</td>
                  </tr>
                ))}
              </Tabela>
            </Box>
          </Secao>
        )}

        {show("proj-pec") && (
          <Secao relatorio={relatorio} titulo="Projeção de Peças">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <Kpi label="Realizado Peças" value={brl(total.pecas)} sub={`Meta ${brl(total.mP)} · ${pct(total.perfP)}`} cls={tone(total.perfP)} />
              <Kpi label="Projeção Peças" value={brl(total.projP)} sub={`${pct(total.projPctP)} da meta de ${brl(total.mP)}`} cls={tone(total.projPctP)} />
              <Kpi label="Falta para a meta" value={brl(Math.max(total.mP - total.pecas, 0))} sub={`Precisa ${brl(total.necP)}/dia (${Math.max(tot - dec, 0)} dias restantes)`} />
              <Kpi label="Margem de Peças" value={margemTxt(total)} sub="Margem líquida sobre o valor líquido de peças" cls={idealTotal ? tone(div(total.marg, idealTotal)) : ""} />
              <Kpi label="Líder de Peças" value={liderPec ? liderPec.c.nome : "—"} sub={liderPec ? `${pct(liderPec.perfP)} de performance` : ""} />
            </div>
            <Box title="Projeção individual de peças">
              <Tabela head={["#", "Consultor", "Depto", "Realizado", "Margem", "Meta", "Performance", "Projeção", "Proj. %", "Média/dia", "Necessário/dia", "vs. Líder"]}>
                {linhas.length === 0 && <tr><td colSpan={12} className="px-3 py-10 text-center text-muted-foreground">Sem dados. Cadastre consultores em "Configurar" e cole os dados do dia.</td></tr>}
                {linhas.map((l, i) => (
                  <tr key={l.c.id} className="border-t border-border">
                    <td className="px-3 py-2"><Posicao i={i} /></td>
                    <td className="px-3 py-2 font-medium">{l.c.nome}</td>
                    <td className="px-3 py-2 text-muted-foreground">{deptName(l.c.department_id)}</td>
                    <td className="px-3 py-2">{brl(l.pecas)}</td>
                    <td className={`px-3 py-2 ${margemTone(deptName(l.c.department_id), l.margem, l.pecas)}`}>{margemTxt(l)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{brl(l.mP)}</td>
                    <td className={`px-3 py-2 font-semibold ${tone(l.perfP)}`}>{pct(l.perfP)}</td>
                    <td className={`px-3 py-2 ${tone(l.projPctP)}`}>{brl(l.projP)}</td>
                    <td className="px-3 py-2"><Barra p={l.projPctP} /></td>
                    <td className="px-3 py-2">{brl(div(l.pecas, dec))}</td>
                    <td className="px-3 py-2">{l.necP ? brl(l.necP) : "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2">{liderPec && liderPec.c.id === l.c.id ? <span className="font-semibold text-primary">Líder</span> : liderPec ? <span className="text-destructive">−{((liderPec.perfP - l.perfP) * 100).toFixed(1)} pts</span> : "—"}</td>
                  </tr>
                ))}
              </Tabela>
            </Box>
          </Secao>
        )}

        {show("proj-total") && (
          <Secao relatorio={relatorio} titulo="Projeção Individual (Serviços + Peças)">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi label="Realizado Total" value={brl(total.real)} sub={`Meta ${brl(total.meta)} · ${pct(total.perf)}`} cls={tone(total.perf)} />
              <Kpi label="Projeção Total" value={brl(total.proj)} sub={`Serviços ${brl(total.projS)} + Peças ${brl(total.projP)}`} cls={tone(total.projPct)} />
              <Kpi label="Falta para a meta" value={brl(Math.max(total.meta - total.real, 0))} sub={`Precisa ${brl(total.nec)}/dia (${Math.max(tot - dec, 0)} dias restantes)`} />
              <Kpi label="Líder" value={lider ? lider.c.nome : "—"} sub={lider ? `${pct(lider.perf)} de performance` : ""} />
            </div>
          <Box title={`Projeção individual (serviços + peças) · ${mesExtenso}`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr className="border-b"><th className="p-2">#</th><th className="p-2">Vendedor</th><th className="p-2 text-right">Serviços / meta</th><th className="p-2 text-right">Peças / meta</th><th className="p-2 text-right">Total / meta</th><th className="p-2 text-right">Perf.</th><th className="p-2 text-right">Projeção</th><th className="p-2 text-right">Precisa/dia</th></tr>
                </thead>
                <tbody>
                  {linhas.map((l, i) => (
                    <tr key={l.c.id} className="border-b last:border-0">
                      <td className="p-2 font-bold">{i + 1}º</td>
                      <td className="p-2"><b>{l.c.nome}</b><div className="text-xs text-muted-foreground">{deptName(l.c.department_id)}</div></td>
                      <td className="p-2 text-right">{soPecas(l.c.nome) ? "—" : <>{brl(l.servicos)}<div className="text-xs text-muted-foreground">{brl(l.mS)}</div></>}</td>
                      <td className="p-2 text-right">{brl(l.pecas)}<div className="text-xs text-muted-foreground">{brl(l.mP)}</div></td>
                      <td className="p-2 text-right">{brl(l.real)}<div className="text-xs text-muted-foreground">{brl(l.meta)}</div></td>
                      <td className={`p-2 text-right font-bold ${l.meta ? tone(l.perf) : ""}`}>{l.meta ? pct(l.perf) : "sem meta"}</td>
                      <td className={`p-2 text-right font-bold ${l.meta ? tone(l.projPct) : ""}`}>{l.meta ? pct(l.projPct) : "—"}</td>
                      <td className="p-2 text-right">{brl(l.nec)}</td>
                    </tr>
                  ))}
                  <tr className="font-bold"><td className="p-2" /><td className="p-2">TOTAL</td><td className="p-2 text-right">{brl(total.servicos)}<div className="text-xs text-muted-foreground">{brl(total.mS)}</div></td><td className="p-2 text-right">{brl(total.pecas)}<div className="text-xs text-muted-foreground">{brl(total.mP)}</div></td><td className="p-2 text-right">{brl(total.real)}<div className="text-xs text-muted-foreground">{brl(total.meta)}</div></td><td className={`p-2 text-right ${tone(total.perf)}`}>{pct(total.perf)}</td><td className={`p-2 text-right ${tone(total.projPct)}`}>{pct(total.projPct)}</td><td className="p-2 text-right">{brl(total.nec)}</td></tr>
                </tbody>
              </table>
            </div>
          </Box>
          </Secao>
        )}

        {tab === "ranking" && <ConsultoresTela linhas={linhas} porDept={porDept} total={total} sales={sales} mes={mes} tot={tot} dec={dec} setTab={setTab} soPecas={soPecas} />}
        {show("agregados") && <Secao relatorio={relatorio} titulo="Agregados"><Agregados mes={mes} cons={visiveis} allCons={cons} tot={tot} dec={dec} deptName={deptName} reloadCons={load} relatorio={relatorio} />{!relatorio && <details className="lux-card"><summary className="cursor-pointer px-4 py-2 text-sm font-semibold">Ranking geral de agregados · {mesExtenso} <span className="text-xs text-primary">abrir/fechar</span></summary><div className="max-h-[60vh] overflow-y-auto"><RankingAgregados mes={mes} cons={visiveis} deptName={deptName} tot={tot} dec={dec} /></div></details>}</Secao>}
        {show("mecanicos") && <Secao relatorio={relatorio} titulo="Técnicos"><Mecanicos mes={mes} tot={tot} dec={dec} lado={relatorio ? undefined : (f) => <RetrabalhoOficina mes={mes} segmento={f} />} />{!relatorio && <><div className="grid items-start gap-3"><details className="group lux-card"><summary className="flex cursor-pointer list-none items-center justify-between px-4 py-2 text-sm font-semibold">Ranking dos técnicos · Serviços, Peças e Total · {mesExtenso}<span className="text-xs text-primary">Abrir/fechar</span></summary><RankingTecnicos mes={mes} tot={tot} dec={dec} /></details></div></>}</Secao>}
        {tab === "controle-os" && <ControleOS />}
        {tab === "agendamentos" && !relatorio && <Agendamentos mes={mes} />}
        {tab === "acessorios" && !relatorio && <AcessoriosEstetica mes={mes} tot={tot} dec={dec} />}
        {tab === "importacoes" && !relatorio && <div className="space-y-3 print:hidden">
          <div>
            <h2 className="text-sm font-semibold">Central de importações · {mes}</h2>
            <p className="text-xs text-muted-foreground">Todas as planilhas do dia em um só lugar. Cada bloco tem seu botão, prévia e confirmação. O Controle O.S. semanal continua na própria aba.</p>
          </div>
          <ImportadorUnificado mes={mes} onDone={load} />
          <p className="text-xs text-muted-foreground">Importação individual por fonte (abra o bloco desejado):</p>
          <div className="grid items-start gap-3 xl:grid-cols-2">
          <section className="lux-card space-y-1 px-3 py-2"><details className="group"><summary className="cursor-pointer list-none text-sm font-semibold">1. Faturamento geral de vendas <span className="text-xs font-normal text-muted-foreground">— alimenta Painel, Ranking, Serviços, Peças</span> <span className="text-xs font-normal text-primary group-open:hidden">abrir</span></summary><div className="mt-2 space-y-2">
            <SalesImport cons={cons} depts={depts} onDone={load} onPeriod={setMes} /></div></details><StatusFonte source="faturamento" mes={mes} updates={updates} clock={clock} /></section>
          <section className="lux-card space-y-1 px-3 py-2"><details className="group"><summary className="cursor-pointer list-none text-sm font-semibold">2. O.S. abertas <span className="text-xs font-normal text-muted-foreground">— alimenta Projeção + OS</span> <span className="text-xs font-normal text-primary group-open:hidden">abrir</span></summary><div className="mt-2 space-y-2">
            <OsAbertas modo="importar" linhas={linhas} mes={mes} soPecas={soPecas} tot={tot} dec={dec} deptName={deptName} semServicos={semServicos} /></div></details><StatusFonte source="os" mes={mes} updates={updates} clock={clock} /></section>
          <section className="lux-card space-y-1 px-3 py-2"><details className="group"><summary className="cursor-pointer list-none text-sm font-semibold">3. Técnicos — faturamento e passagens <span className="text-xs font-normal text-muted-foreground">— alimenta Técnicos</span> <span className="text-xs font-normal text-primary group-open:hidden">abrir</span></summary><div className="mt-2 space-y-2">
            <Mecanicos modo="importar" mes={mes} tot={tot} dec={dec} /></div></details><StatusFonte source="mecanicos" mes={mes} updates={updates} clock={clock} /></section>
          <section className="lux-card space-y-1 px-3 py-2"><details className="group"><summary className="cursor-pointer list-none text-sm font-semibold">4. Agregados — vendas de itens e passagens <span className="text-xs font-normal text-muted-foreground">— alimenta Agregados</span> <span className="text-xs font-normal text-primary group-open:hidden">abrir</span></summary><div className="mt-2 space-y-2">
            <Agregados modo="importar" mes={mes} cons={visiveis} allCons={cons} tot={tot} dec={dec} deptName={deptName} reloadCons={load} relatorio={false} /></div></details><StatusFonte source="agregados" mes={mes} updates={updates} clock={clock} /></section>
          <section className="lux-card space-y-1 px-3 py-2"><details className="group"><summary className="cursor-pointer list-none text-sm font-semibold">5. Devoluções de peças (ajuste manual) <span className="text-xs font-normal text-muted-foreground">— bruto → líquido</span> <span className="text-xs font-normal text-primary group-open:hidden">abrir</span></summary><div className="mt-2 space-y-2">
            <Devolucoes mes={mes} cons={cons} onChange={load} /></div></details></section>
          </div>
        </div>}
        {tab === "cockpit" && !relatorio && <Cockpit linhas={linhas} porDept={porDept} mes={mes} tot={tot} dec={dec} soPecas={soPecas} setTab={setTab} sales={sales} nome={email.split("@")[0] ?? ""} deptName={deptName} filtro={filtroDept === "todos" ? "Todos departamentos" : deptName(filtroDept)} base={params.base} mesAtual={mes === localDay(clock).slice(0, 7)} />}
        {tab === "nps" && !relatorio && <NpsPainel mes={mes} />}
        {tab === "pecas" && !relatorio && <PecasEstoque linhas={linhas} porDept={porDept} margemIdeal={margemIdeal} deptName={deptName} passagens={resumo.pass} mes={mes} tot={tot} dec={dec} />}
        {tab === "metas" && !relatorio && <Tabs defaultValue="geral" className="min-w-0 gap-3">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 xl:grid-cols-4">
            <TabsTrigger value="geral" className="whitespace-normal">Acompanhamento & Geral</TabsTrigger>
            <TabsTrigger value="consultores">Consultores</TabsTrigger>
            <TabsTrigger value="tecnicos">Técnicos</TabsTrigger>
            <TabsTrigger value="agregados" className="whitespace-normal">Agregados & Agenda</TabsTrigger>
          </TabsList>
          <TabsContent value="geral" className="space-y-3 xl:max-h-[calc(100vh-350px)] xl:overflow-y-auto">
            <ViradaMes mes={mes} onChanged={load} />
            <MetasExecutivo linhas={linhas} deptName={deptName} />
            <Config parte="geral" params={form} salvarParams={salvarParams} confirmar={() => void confirmarParams()} pendente={!!rascunho} depts={depts} cons={cons} goals={goals} mes={mes} reload={load} deptName={deptName} irPara={setMes} />
          </TabsContent>
          <TabsContent value="consultores" className="xl:max-h-[calc(100vh-350px)] xl:overflow-y-auto">
            <Config parte="metas" params={form} salvarParams={salvarParams} confirmar={() => void confirmarParams()} pendente={!!rascunho} depts={depts} cons={visiveis} goals={goals} mes={mes} reload={load} deptName={deptName} irPara={setMes} />
          </TabsContent>
          <TabsContent value="tecnicos" className="xl:max-h-[calc(100vh-350px)] xl:overflow-y-auto"><TecnicosMetas mes={mes} /></TabsContent>
          <TabsContent value="agregados" className="grid items-start gap-3 xl:max-h-[calc(100vh-350px)] xl:grid-cols-2 xl:overflow-y-auto">
            <div className="space-y-3"><CadeadoMes mes={mes} /><AgendaMetas mes={mes} /></div>
            <section className="space-y-2 px-3 py-2"><h3 className="text-sm font-semibold">Metas de agregados</h3><Agregados modo="metas" mes={mes} cons={visiveis} allCons={cons} tot={tot} dec={dec} deptName={deptName} reloadCons={load} relatorio={false} /></section>
          </TabsContent>
        </Tabs>}
        {tab === "config" && <div className="space-y-6"><Equipe /><Config parte="config" params={form} salvarParams={salvarParams} confirmar={() => void confirmarParams()} pendente={!!rascunho} depts={depts} cons={cons} goals={goals} mes={mes} reload={load} deptName={deptName} irPara={setMes} /></div>}
      </main>
      </div>
    </div>
  );
}

/** ✅ quando a fonte foi atualizada hoje; ❌ quando está desatualizada. */
function StatusFonte({ source, mes, updates, clock }: { source: UpdateSource; mes: string; updates: UpdateRecord[]; clock: Date }) {
  const { record, fresh } = sourceStatus(source, mes, updates, clock);
  return <p data-testid={`status-${source}`} className="text-xs font-medium text-muted-foreground">{record
    ? <>{fresh ? "✅" : "❌"} Última atualização {dataHora(record.at)} por <span className="font-medium">{record.nome}</span> · {record.origem}</>
    : <>❌ Nenhuma atualização registrada neste mês.</>}</p>;
}

function Config({ parte, params, salvarParams, confirmar, pendente, depts, cons, goals, mes, reload, deptName, irPara }: {
  parte: "config" | "metas" | "geral"; params: Params; salvarParams: (p: Params) => void; confirmar: () => void; pendente: boolean; depts: Dept[]; cons: Cons[]; goals: Goal[]; mes: string; reload: () => void; deptName: (id: string | null) => string; irPara: (mes: string) => void;
}) {
  const [novoDept, setNovoDept] = useState("");
  const [novoCons, setNovoCons] = useState("");
  const [consDept, setConsDept] = useState("");
  const [metas, setMetas] = useState<Record<string, { servicos: number; pecas: number }>>({});
  useEffect(() => { setMetas(Object.fromEntries(goals.map((g) => [g.consultant_id, { servicos: g.servicos, pecas: g.pecas }]))); }, [goals]);
  const salvarMeta = async (id: string) => {
    const m = metas[id] ?? { servicos: 0, pecas: 0 };
    await supabase.from("goals").upsert({ consultant_id: id, mes, ...m }, { onConflict: "consultant_id,mes" });
    reload();
  };
  const grupos = useMemo(() => [...new Set(cons.map((c) => c.department_id))], [cons]);
  return (
    <div className="space-y-3">
      {parte !== "config" && (() => {
        const ms = goals.reduce((a, g) => a + g.servicos, 0), mp = goals.reduce((a, g) => a + g.pecas, 0);
        const sem = cons.filter((c) => !goals.some((g) => g.consultant_id === c.id && g.servicos + g.pecas > 0));
        return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="Meta Serviços loja" value={brl(ms)} />
          <Kpi label="Meta Peças loja" value={brl(mp)} />
          <Kpi label="Meta Total loja" value={brl(ms + mp)} />
          <Kpi label="Cobertura de metas" value={`${cons.length - sem.length}/${cons.length}`} sub={sem.length ? `Sem meta: ${sem.map((c) => c.nome).join(", ")}` : "✅ Todos com meta"} cls={sem.length ? "text-warning" : "text-success"} />
        </div>;
      })()}
      {parte === "metas" && <MetasAno cons={cons} irPara={irPara} onSaved={reload} />}
      <div className="grid gap-6 lg:grid-cols-3">
      {parte !== "metas" && <section className="space-y-4 rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">Dias do mês {mes}</h2>
        <Num label="Dias úteis totais" v={params.du_totais} on={(v) => salvarParams({ ...params, du_totais: v })} step={0.5} />
        <Num label="Dias úteis decorridos" v={params.du_decorridos} on={(v) => salvarParams({ ...params, du_decorridos: v })} step={0.5} />
        <Num label="Dias corridos totais" v={params.dc_totais} on={(v) => salvarParams({ ...params, dc_totais: v })} />
        <Num label="Dias corridos decorridos" v={params.dc_decorridos} on={(v) => salvarParams({ ...params, dc_decorridos: v })} />
        <p className="text-xs text-muted-foreground">Sábado conta 0,5 dia útil e feriados nacionais já são descontados. Os decorridos avançam sozinhos a cada novo dia, mantendo seus ajustes (ex.: feriado local).</p>
        <label className="block text-sm"><span className="text-muted-foreground">Projeção baseada em</span>
          <select value={params.base} onChange={(e) => salvarParams({ ...params, base: e.target.value })} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2">
            <option value="uteis">Dias úteis</option><option value="corridos">Dias corridos</option>
          </select>
        </label>
        <button type="button" onClick={confirmar} disabled={!pendente} className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">{pendente ? "Salvar dias do mês" : "Dias do mês salvos"}</button>
        <p className="text-xs text-muted-foreground">Departamentos, consultores e metas ficam em Metas & Planejamento.</p>
      </section>}
      {parte === "metas" && <section className="space-y-4 rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">Departamentos</h2>
        <div className="flex gap-2">
          <input value={novoDept} onChange={(e) => setNovoDept(e.target.value)} placeholder="Nome do departamento" className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm" />
          <button onClick={async () => { if (novoDept.trim()) { await supabase.from("departments").insert({ nome: novoDept.trim() }); setNovoDept(""); reload(); } }} className="rounded-lg bg-secondary px-3 text-sm font-medium text-secondary-foreground">Adicionar</button>
        </div>
        {depts.map((d) => (
          <div key={d.id} className="flex justify-between text-sm"><span>{d.nome}</span>
            <button onClick={async () => { await supabase.from("departments").delete().eq("id", d.id); reload(); }} className="text-destructive">Remover</button>
          </div>
        ))}
      </section>}
      {parte === "metas" && <section className="space-y-3 rounded-xl border border-border bg-card p-6 lg:col-span-2">
        <h2 className="text-lg font-semibold">Consultores e metas de {mes}</h2>
        <div className="flex flex-wrap gap-2">
          <input value={novoCons} onChange={(e) => setNovoCons(e.target.value)} placeholder="Nome do consultor" className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm" />
          <select value={consDept} onChange={(e) => setConsDept(e.target.value)} className="rounded-lg border border-input bg-background px-3 py-2 text-sm">
            <option value="">Sem departamento</option>
            {depts.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
          </select>
          <button onClick={async () => { if (novoCons.trim()) { await supabase.from("consultants").insert({ nome: novoCons.trim(), department_id: consDept || null }); setNovoCons(""); reload(); } }} className="rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground">Adicionar</button>
        </div>
        {grupos.map((gid) => (
          <div key={gid ?? "none"}>
            <p className="mt-4 text-xs font-semibold uppercase text-muted-foreground">{deptName(gid)}</p>
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground"><tr><th className="py-2">Consultor</th><th>Departamento</th><th>Meta Serviços</th><th>Meta Peças</th><th></th></tr></thead>
              <tbody>
                {cons.filter((c) => c.department_id === gid).map((c) => {
                  const m = metas[c.id] ?? { servicos: 0, pecas: 0 };
                  return (
                    <tr key={c.id} className="border-t border-border">
                      <td className="py-2 pr-2 font-medium">{c.nome}</td>
                      <td className="pr-2">
                        <select value={c.department_id ?? ""} onChange={async (e) => { await supabase.from("consultants").update({ department_id: e.target.value || null }).eq("id", c.id); reload(); }} className="rounded border border-input bg-background px-2 py-1">
                          <option value="">—</option>
                          {depts.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
                        </select>
                      </td>
                      <td className="pr-2"><input type="number" value={m.servicos || ""} onChange={(e) => setMetas({ ...metas, [c.id]: { ...m, servicos: +e.target.value } })} onBlur={() => salvarMeta(c.id)} className="w-full rounded border border-input bg-background px-2 py-1" /></td>
                      <td className="pr-2"><input type="number" value={m.pecas || ""} onChange={(e) => setMetas({ ...metas, [c.id]: { ...m, pecas: +e.target.value } })} onBlur={() => salvarMeta(c.id)} className="w-full rounded border border-input bg-background px-2 py-1" /></td>
                      <td><button onClick={async () => { if (confirm(`Remover ${c.nome} e todos os seus lançamentos?`)) { await supabase.from("consultants").delete().eq("id", c.id); reload(); } }} className="text-destructive">Remover</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
        <p className="text-xs text-muted-foreground">As metas são salvas ao sair do campo e valem para o mês selecionado no topo.</p>
      </section>}
      </div>

    </div>
  );
}
