import { TecnicosMetas } from "@/components/TecnicosMetas";
import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Barra, Box, Cmp, Kpi, Num, Posicao, Secao, Tabela, bg, brl, dataHora, div, norm, parseNum, pct, tone } from "@/components/painel-ui";
import { Agregados } from "@/components/Agregados";
import { SalesImport } from "@/components/SalesImport";
import { EnvioWhatsapp } from "@/components/EnvioWhatsapp";
import { ResumoPainel } from "@/components/ResumoPainel";
import { OsAbertas } from "@/components/OsAbertas";
import { ControleOS } from "@/components/ControleOS";
import { Notificacoes } from "@/components/Notificacoes";
import { Mecanicos } from "@/components/Mecanicos";
import { Equipe } from "@/components/Equipe";
import { MinhaPerformance } from "@/components/MinhaPerformance";
import { ChefeOficina } from "@/components/ChefeOficina";
import { MeuDesempenhoTecnico } from "@/components/MeuDesempenhoTecnico";
import { RankingMobile } from "@/components/RankingMobile";
import { RankingAgregados, RankingTecnicos } from "@/components/RankingExtra";
import { MetasAno } from "@/components/MetasAno";
import { Cockpit } from "@/components/Cockpit";
import { NpsPainel } from "@/components/NpsPainel";
import { PecasEstoque } from "@/components/PecasEstoque";
import { CadeadoMes } from "@/components/CadeadoMes";
import { AnaliseFechamento, Reconhecimento } from "@/components/RelatorioAnalise";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Car, ChevronDown, ClipboardList, Download, Gauge, Gem, LayoutDashboard, Lightbulb, LogOut, Menu, Package, Printer, Settings, Star, Target, TrendingUp, Upload, Users, Wrench, X } from "lucide-react";
import bmwLogo from "@/assets/bmw-logo.asset.json";
import carroSilhueta from "@/assets/carro-silhueta.jpg";
import { localDay, sourceLabels, sourceStatus, tabUpdateStatus, UPDATE_EVENT, type UpdateRecord, type UpdateSource } from "@/lib/update-status";
import { calcPerformance } from "@/lib/performance";
import { useAccessPresence } from "@/hooks/use-access-presence";

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

// Conta dias úteis (seg-sex) de "mes" do dia 01 até o dia "ate".
const diasUteis = (mes: string, ate: number) => {
  const [y, m] = mes.split("-").map(Number);
  let n = 0;
  for (let d = 1; d <= ate; d++) {
    const w = new Date(y!, m! - 1, d).getDay();
    if (w !== 0 && w !== 6) n++;
  }
  return n;
};

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
  useAccessPresence(Boolean(session) && papel !== undefined && papel !== "vendedor");
  useEffect(() => {
    if (!session) { setPapel(undefined); return; }
    supabase.from("team_members").select("papel").ilike("email", email).maybeSingle().then(({ data }) => setPapel(data?.papel ?? null));
  }, [session, email]);
  if (!ready || (session && papel === undefined)) return <div className="p-10 text-center text-muted-foreground">Carregando…</div>;
  if (!session) return <Login />;
  if (papel === "tecnico") return <MeuDesempenhoTecnico />;
  if (papel === "chefe_oficina") return <ChefeOficina />;
  return papel === "vendedor" ? <MinhaPerformance /> : <Painel email={email} />;
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
  const [rankSub, setRankSub] = useState<"geral" | "agregados" | "tecnicos">("geral");
  const [relatorio, setRelatorio] = useState(false);
  const show = (k: string) => tab === k || (tab === "proj" && k === projSub) || relatorio;
  useEffect(() => { const f = () => setRelatorio(false); window.addEventListener("afterprint", f); return () => window.removeEventListener("afterprint", f); }, []);
  const gerarRelatorio = () => { setRelatorio(true); setTimeout(() => window.print(), 1200); };
  const [filtroDept, setFiltroDept] = useState("todos");
  const [updates, setUpdates] = useState<UpdateRecord[]>([]);
  const [clock, setClock] = useState(() => new Date());
  const lastUp = updates[0] ?? null;
  const tabKey = (k: string) => (k === "proj" ? projSub : k === "pecas" ? "painel" : k);
  const status = tabUpdateStatus(tabKey(tab), mes, updates, clock);
  const [abrirWhats, setAbrirWhats] = useState(false);

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

  const load = useCallback(async () => {
    const [y, m] = mes.split("-").map(Number);
    const fim = new Date(y!, m!, 0).getDate();
    const [d, c, g, s, p] = await Promise.all([
      supabase.from("departments").select("id,nome").order("nome"),
      supabase.from("consultants").select("id,nome,department_id,telefone").order("nome"),
      supabase.from("goals").select("consultant_id,servicos,pecas").eq("mes", mes),
      supabase.from("daily_sales").select("consultant_id,dia,servicos,pecas,margem_pecas").gte("dia", `${mes}-01`).lte("dia", `${mes}-${fim}`).order("dia"),
      supabase.from("month_params").select("*").eq("mes", mes).maybeSingle(),
    ]);
    setDepts(d.data ?? []); setCons(c.data ?? []);
    setGoals((g.data ?? []).map((x) => ({ ...x, servicos: +x.servicos, pecas: +x.pecas })));
    setSales((s.data ?? []).map((x) => ({ ...x, servicos: +x.servicos, pecas: +x.pecas, margem_pecas: +(x.margem_pecas ?? 0) })));
    let np: Params = p.data ? (p.data as Params) : { ...defParams, dc_totais: fim };
    const hoje = new Date();
    const mesHoje = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
    if (mes === mesHoje) {
      const dia = hoje.getDate();
      const muda: Partial<Params> = {};
      if (dia > np.dc_decorridos) muda.dc_decorridos = dia;
      const du = diasUteis(mes, dia);
      if (du > np.du_decorridos) muda.du_decorridos = du;
      if (!p.data) { muda.dc_totais = fim; muda.du_totais = diasUteis(mes, fim); }
      if (Object.keys(muda).length) {
        np = { ...np, ...muda };
        await supabase.from("month_params").upsert({ ...np, mes }, { onConflict: "user_id,mes" });
      }
    }
    setParams(np);
  }, [mes]);
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

  const salvarParams = async (p: Params) => {
    setParams(p);
    await supabase.from("month_params").upsert({ ...p, mes }, { onConflict: "user_id,mes" });
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

  // 10 abas oficiais; algumas agrupam sub-abas (mantém deep links setTab antigos).
  const tabs: [string, string, typeof Gauge, string[]][] = [
    ["cockpit", "Dashboard", Gauge, []],
    ["painel", "Central de Gestão", LayoutDashboard, ["proj", "os"]],
    ["ranking", "Consultores", Users, []],
    ["metas", "Metas & Planejamento", Target, []],
    ["agregados", "Agregados", Gem, []],
    ["mecanicos", "Oficina & Técnicos", Wrench, []],
    ["controle-os", "Ordens de Serviço", Car, []],
    ["pecas", "Peças & Estoque", Package, []],
    ["nps", "NPS & Satisfação", Star, []],
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
        return <Fragment key={k}>{i === 9 && <span aria-hidden className="my-2 h-px bg-border" />}
          <button type="button" onClick={() => { setTab(k); setMenu(false); }}
            data-update-status={stale ? "pending" : "current"} title={stale ? `${l}: atualização pendente` : l}
            aria-current={ativo ? "page" : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${ativo ? "bg-gradient-to-r from-primary/30 to-primary/5 font-semibold text-foreground shadow-[inset_3px_0_0_var(--color-primary)]" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
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
    <div className="border-t border-border p-3">
      <img src={carroSilhueta} alt="" aria-hidden loading="lazy" width={1152} height={576} className="mx-auto w-full opacity-80" />
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
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-3 py-2.5 sm:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menu" onClick={() => setMenu(true)}><Menu /></Button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold sm:text-lg">{tabLabel}</h1>
            <div className="flex items-center gap-2" title="Tempo decorrido do mês = ritmo esperado da meta">
              <span className="text-[11px] text-muted-foreground">{params.base === "uteis" ? "Úteis" : "Corridos"} {dec}/{tot}</span>
              <div className="h-1 w-16 overflow-hidden rounded-full bg-muted sm:w-32"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(div(dec, tot) * 100, 100)}%` }} /></div>
              <span className="text-[11px] text-muted-foreground">{pct(div(dec, tot))}</span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-0.5 sm:gap-2">
            {status.pending.length > 0 && <Button type="button" size="sm" variant="destructive" className="update-alert h-8 gap-1 px-2 text-xs" title={`Pendente: ${status.pending.map((x) => sourceLabels[x]).join(", ")}`} onClick={() => openUpdate(status.pending[0]!)}><AlertTriangle className="size-4" />{status.pending.length}</Button>}
            <ThemeToggle />
            <Notificacoes abrir={() => setTab("controle-os")} />
            <Button variant="ghost" size="icon" title="Sair" aria-label="Sair" onClick={() => void supabase.auth.signOut()}><LogOut /></Button>
          </div>
        </div>
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-2 px-3 pb-2.5 sm:flex sm:px-6">
          <input aria-label="Mês do relatório" type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="min-w-0 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm sm:w-auto" />
          <select aria-label="Departamento" value={filtroDept} onChange={(e) => setFiltroDept(e.target.value)} className="min-w-0 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm sm:w-auto">
            <option value="todos">Todos departamentos</option>
            {depts.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
          </select>
          {mes !== localDay(clock).slice(0, 7) && <span className="self-center text-xs text-muted-foreground">Mês arquivado</span>}
        </div>
      </header>

      {status.latest.length > 0 && <details data-testid="update-banner" className={`group border-b print:hidden ${status.stale ? "border-destructive/40 bg-destructive/10" : "border-border bg-primary/5 text-muted-foreground"}`}>
        <summary className="mx-auto flex max-w-7xl cursor-pointer list-none items-center gap-2 px-4 py-1.5 text-xs sm:px-6">
          {status.pending.length > 0
            ? <span className="font-semibold text-destructive">⚠️ {status.pending.length} fonte(s) pendente(s): {status.pending.map((x) => sourceLabels[x]).join(", ")}</span>
            : <span>✅ Dados atualizados</span>}
          <ChevronDown className="ml-auto size-4 transition-transform group-open:rotate-180" />
        </summary>
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 pb-2 text-xs sm:px-6">
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

      <main className={`mx-auto min-w-0 max-w-7xl space-y-4 px-3 py-4 sm:space-y-6 sm:px-6 sm:py-6 ${tab === "painel" ? "painel-phone" : ""}`}>
        {subBar}
        {!relatorio && (() => {
          const rest = Math.max(tot - dec, 0);
          type L = (typeof linhas)[number];
          const abaixo = (arr: L[], f: (l: L) => number, m: (l: L) => number) => arr.filter((l) => m(l) > 0 && f(l) < 0.85).sort((a, b) => f(a) - f(b));
          const piorS = abaixo(linhasServ, (l) => l.projPctS, (l) => l.mS)[0];
          const piorP = abaixo(linhas, (l) => l.projPctP, (l) => l.mP)[0];
          const pior = abaixo(linhas, (l) => l.projPct, (l) => l.meta)[0];
          const semMeta = linhas.filter((l) => l.meta === 0).length;
          const deptFraco = [...porDept].filter((d) => d.meta > 0).sort((a, b) => a.projPct - b.projPct)[0];
          const o: Record<string, [string, string]> = {
            painel: [`Projeção do mês em ${pct(total.projPct)} da meta (Serviços ${pct(total.projPctS)} · Peças ${pct(total.projPctP)}), faltando ${rest} dia(s).`,
              total.projPct >= 1 ? `Ritmo bom: reconheça ${lider?.c.nome ?? "o líder"} e peça superação.` : `Cobre ${brl(total.nec)}/dia da equipe${deptFraco ? `; foco em ${deptFraco.nome} (${pct(deptFraco.projPct)})` : ""}.`],
            "proj-serv": [`Serviços projetam ${pct(totalServ.projPctS)}; líder ${liderServ?.c.nome ?? "-"} em ${pct(liderServ?.perfS ?? 0)}.`,
              piorS ? `Converse hoje com ${piorS.c.nome} (${pct(piorS.projPctS)}): revisar orçamentos pendentes; precisa ${brl(piorS.necS)}/dia.` : "Todos acima de 85%: mantenha a cobrança diária de agendamentos."],
            "proj-pec": [`Peças projetam ${pct(total.projPctP)}; líder ${liderPec?.c.nome ?? "-"} em ${pct(liderPec?.perfP ?? 0)}.`,
              piorP ? `Acompanhe ${piorP.c.nome} (${pct(piorP.projPctP)}): oferecer item complementar em toda OS; precisa ${brl(piorP.necP)}/dia.` : "Todos acima de 85%: incentive itens de maior valor."],
            "proj-total": [`Projeção total ${brl(total.proj)} de ${brl(total.meta)} (${pct(total.projPct)}).`,
              pior ? `Prioridade: ${pior.c.nome} em ${pct(pior.projPct)} — combine meta diária de ${brl(pior.nec)}.` : "Equipe no ritmo: mantenha a reunião rápida diária."],
            os: ["Faturado + OS abertas mostram o que ainda dá para fechar no mês.", "Cobre de cada consultor o faturamento das OS prontas antes do fechamento."],
            "controle-os": ["OS paradas viram prejuízo e risco de reclamação.", "Atualize a planilha toda semana e cobre ação nas OS sinalizadas sem mudança."],
            mecanicos: ["O faturamento dos técnicos mostra a produtividade da oficina.", "Envie o resumo de Carro e Moto aos grupos e converse com quem está abaixo de 85%."],
            agregados: ["Agregados medem o aproveitamento de cada passagem.", "Combine com cada consultor 1 agregado por atendimento e acompanhe o aproveitamento."],
            config: [semMeta ? `${semMeta} consultor(es) sem meta neste mês.` : "Metas e dias configurados.", semMeta ? "Cadastre as metas faltantes para a projeção ficar correta." : "Confira feriados nos dias úteis."],
          };
          const [analise, acao] = o[tabKey(tab)] ?? o["painel"]!;
          return (
            <details className="group rounded-lg border-l-4 border-primary bg-primary/5 px-4 py-2 text-sm print:hidden">
              <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
                <Lightbulb className="size-4" />Orientação ao gestor<ChevronDown className="ml-auto size-4 transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-2"><span className="font-medium">Análise:</span> {analise}</p>
              <p><span className="font-medium">Ação:</span> {acao}</p>
            </details>
          );
        })()}
        {relatorio && (
          <div className="hidden print:block">
            <div className="flex min-h-[250mm] flex-col items-center justify-center text-center">
              <img src={bmwLogo.url} alt="BMW" className="size-28" />
              <p className="mt-10 text-sm font-semibold uppercase tracking-[0.3em] text-primary">Relatório de Fechamento</p>
              <h1 className="mt-3 text-4xl font-bold">PAINEL ESTRATÉGICO</h1>
              <p className="mt-1 text-xl font-medium text-primary">KLEDSON</p>
              <p className="mt-8 text-2xl font-semibold">{mesExtenso}</p>
              <div className="mx-auto mt-12 grid w-full max-w-2xl grid-cols-2 gap-4 text-left">
                <Kpi label="Realizado Serviços" value={brl(total.servicos)} sub={`Meta ${brl(total.mS)} · ${pct(total.perfS)}`} cls={tone(total.perfS)} />
                <Kpi label="Realizado Peças" value={brl(total.pecas)} sub={`Meta ${brl(total.mP)} · ${pct(total.perfP)}`} cls={tone(total.perfP)} />
                <Kpi label="Projeção Serviços" value={brl(total.projS)} sub={`${pct(total.projPctS)} da meta ${brl(total.mS)}`} cls={tone(total.projPctS)} p={total.projPctS} />
                <Kpi label="Projeção Peças" value={brl(total.projP)} sub={`${pct(total.projPctP)} da meta ${brl(total.mP)}`} cls={tone(total.projPctP)} />
              </div>
              <p className="mt-8 text-2xl font-bold">Projeção Total: {brl(total.proj)} <span className={tone(total.projPct)}>({pct(total.projPct)} da meta)</span></p>
              <p className="mt-12 max-w-2xl text-xs text-muted-foreground">
                Gerado em {dataHora(new Date().toISOString())}
                {lastUp && ` · Última atualização dos dados: ${dataHora(lastUp.at)} por ${lastUp.nome}`}
                {` · Projeção por ${params.base === "uteis" ? "dias úteis" : "dias corridos"}: ${dec} de ${tot}`}
              </p>
            </div>
          </div>
        )}
        {relatorio && <Secao relatorio={relatorio} titulo="Análise do fechamento"><AnaliseFechamento linhas={linhas} total={total} porDept={porDept} sales={sales} dec={dec} tot={tot} mes={mes} /></Secao>}
        {relatorio && <Secao relatorio={relatorio} titulo="Reconhecimento"><Reconhecimento linhas={linhas} sales={sales} dec={dec} tot={tot} mes={mes} /></Secao>}
        {show("os") && <Secao relatorio={relatorio} titulo="Projeção + Ordens de Serviço abertas"><OsAbertas linhas={linhas} mes={mes} soPecas={soPecas} tot={tot} dec={dec} deptName={deptName} semServicos={semServicos} /></Secao>}
        {show("painel") && (
          <Secao relatorio={relatorio} titulo="Resumo executivo">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Relatório de {mes}</h2>
              <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap print:hidden">
                <Button onClick={exportar}><Download />Exportar Excel (CSV)</Button>
                <Button variant="outline" onClick={() => window.print()}><Printer />Imprimir / PDF</Button>
                <Button className="col-span-2" onClick={gerarRelatorio}><Printer />Relatório de fechamento (PDF)</Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-5 painel-kpis">
              <Kpi label="Realizado Serviços Total" value={brl(total.servicos)} sub={`Meta ${brl(total.mS)} · ${pct(total.perfS)}`} cls={tone(total.perfS)} p={total.perfS} />
              <Kpi label="Realizado Peças Total" value={brl(total.pecas)} sub={`Meta ${brl(total.mP)} · ${pct(total.perfP)} · margem ${margemTxt(total)}`} cls={tone(total.perfP)} p={total.perfP} />
              <Kpi label="Projeção Serviços" value={brl(total.projS)} sub={`${pct(total.projPctS)} da meta ${brl(total.mS)}`} cls={tone(total.projPctS)} p={total.projPctS} />
              <Kpi label="Projeção Peças" value={brl(total.projP)} sub={`${pct(total.projPctP)} da meta ${brl(total.mP)}`} cls={tone(total.projPctP)} p={total.projPctP} />
              <Kpi label="Projeção Total" value={brl(total.proj)} sub={`${pct(total.projPct)} · precisa serviços ${brl(total.necS)}/dia · precisa peças ${brl(total.necP)}/dia`} cls={tone(total.projPct)} p={total.projPct} destaque />
            </div>

            <Box title="Resultados por departamento">
              <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
                {porDept.map((d) => (
                  <div key={d.nome} className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                    <div className="space-y-2 p-4">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="font-semibold">{d.nome}</p>
                        <p className={`text-sm font-semibold ${tone(d.projPct)}`}>Proj. {pct(d.projPct)} · {d.projPct >= 1 ? "No ritmo" : d.projPct >= 0.85 ? "Atenção" : "Crítico"}</p>
                      </div>
                      <Barra p={d.projPct} />
                    </div>
                    <div className={`grid border-t border-border text-sm ${semServicos(d.nome) ? "" : "grid-cols-2 divide-x divide-border"}`}>
                      {!semServicos(d.nome) && (
                        <div className="min-w-0 space-y-1 p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Serviços</p>
                          <p className="break-words font-semibold">{brl(d.servicos)} <span className={`text-xs ${tone(d.perfS)}`}>{pct(d.perfS)}</span></p>
                          <p className={`break-words text-xs ${tone(d.projPctS)}`}>Proj. {brl(d.projS)} ({pct(d.projPctS)})</p>
                          <p className="break-words text-xs text-muted-foreground">Meta {brl(d.mS)}</p>
                        </div>
                      )}
                      <div className="min-w-0 space-y-1 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Peças</p>
                        <p className="break-words font-semibold">{brl(d.pecas)} <span className={`text-xs ${tone(d.perfP)}`}>{pct(d.perfP)}</span></p>
                        <p className={`break-words text-xs ${tone(d.projPctP)}`}>Proj. {brl(d.projP)} ({pct(d.projPctP)})</p>
                        <p className="break-words text-xs text-muted-foreground">Meta {brl(d.mP)}</p>
                        <p className="text-xs">Margem <span className={`font-semibold ${margemTone(d.nome, d.margem, d.pecas)}`}>{margemTxt(d)}</span> <span className="text-muted-foreground">ideal {pct(margemIdeal(d.nome))}</span></p>
                      </div>
                    </div>
                    <div className="space-y-1 border-t border-border bg-muted/40 px-4 py-3 text-sm">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-muted-foreground">Projeção total</span>
                        <span className="font-semibold">{brl(d.proj)} <span className="text-xs font-normal text-muted-foreground">/ meta {brl(d.meta)}</span></span>
                      </div>
                      <p className="text-xs text-muted-foreground">Realizado {brl(d.real)} ({pct(d.perf)}) · 👉 Precisa por dia: {semServicos(d.nome) ? `peças ${brl(d.necP)}` : `serviços ${brl(d.necS)} · peças ${brl(d.necP)}`}</p>
                    </div>
                  </div>
                ))}
                {!porDept.length && <p className="p-4 text-sm text-muted-foreground">Cadastre consultores e departamentos em "Configurar" para ver os resultados aqui.</p>}
              </div>
            </Box>

            <div className="print:hidden">
              {abrirWhats ? (
                <div className="space-y-3">
                  <Button variant="outline" size="sm" onClick={() => setAbrirWhats(false)}>Ocultar envio por WhatsApp</Button>
                  <EnvioWhatsapp linhas={linhas} lider={lider} liderServ={liderServ} liderPec={liderPec} mes={mes} dec={dec} tot={tot} reload={load} />
                </div>
              ) : (
                <Button variant="outline" onClick={() => setAbrirWhats(true)}>Mostrar envio por WhatsApp</Button>
              )}
            </div>

            <ResumoPainel linhas={linhas.map((l) => ({ nome: l.c.nome, servicos: l.servicos, pecas: l.pecas, mS: l.mS, mP: l.mP, perfS: l.perfS, perfP: l.perfP, perf: l.perf, projPct: l.projPct, mediaDia: l.mediaDia, necS: l.necS, necP: l.necP, nec: l.nec }))} liderNome={lider?.c.nome ?? null} dec={dec} tot={tot} mes={mes} />


            {/* sai da tela; continua no relatório de fechamento (PDF) */}
            <div className="hidden print:block">
              <Box title="Comparação com o líder e recomendações">
                <div className="grid gap-4 p-4 md:grid-cols-2">
                  {linhas.map((l) => (
                    <div key={l.c.id} className="rounded-lg border border-border p-4">
                      <div className="flex items-baseline justify-between">
                        <p className="font-semibold">{l.c.nome}</p>
                        <p className={`text-sm font-semibold ${tone(l.projPct)}`}>Proj. {pct(l.projPct)}</p>
                      </div>
                      {lider && lider.c.id !== l.c.id && (
                        <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                          <Cmp label="Perf. Serviços" a={l.perfS} b={lider.perfS} />
                          <Cmp label="Perf. Peças" a={l.perfP} b={lider.perfP} />
                          <Cmp label="Perf. Total" a={l.perf} b={lider.perf} />
                        </div>
                      )}
                      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                        {recomendar(l).map((r) => <li key={r}>{r}</li>)}
                      </ul>
                    </div>
                  ))}
                </div>
              </Box>
            </div>
          </Secao>
        )}

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

        {tab === "ranking" && (
          <div className="flex flex-wrap gap-2 print:hidden" role="tablist" aria-label="Tipo de ranking">
            {([["geral", "Geral"], ["agregados", "Agregados"], ["tecnicos", "Técnicos"]] as const).map(([k, n]) => (
              <button key={k} role="tab" aria-selected={rankSub === k} onClick={() => setRankSub(k)} className={`rounded-full border px-4 py-1.5 text-sm font-medium ${rankSub === k ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"}`}>{n}</button>
            ))}
          </div>
        )}
        {tab === "ranking" && rankSub === "agregados" && <Box title={`Ranking de agregados · ${mesExtenso}`}><RankingAgregados mes={mes} cons={visiveis} deptName={deptName} tot={tot} dec={dec} /></Box>}
        {tab === "ranking" && rankSub === "tecnicos" && <Box title={`Ranking dos técnicos · ${mesExtenso}`}><RankingTecnicos mes={mes} tot={tot} dec={dec} /></Box>}
        {tab === "ranking" && rankSub === "geral" && (
            <Box title={`Ranking geral das vendedoras · ${mesExtenso}`}>
            <RankingMobile linhas={linhas} total={total} deptName={deptName} soPecas={soPecas} />
            <div className="hidden md:block">
              <Tabela head={["#", "Consultor", "Depto", "Grupo", "Realizado", "Meta", "Performance", "Projeção", "Proj. %", "Necessário/dia", "vs. Líder"]}>
                {linhas.length === 0 && <tr><td colSpan={11} className="px-3 py-10 text-center text-muted-foreground">Sem dados. Cadastre consultores em "Configurar" e cole os dados do dia.</td></tr>}
                {linhas.map((l, i) => {
                  const semServ = soPecas(l.c.nome);
                  const vsLider = (a: number, b: number | undefined) => (b === undefined ? "—" : a >= b ? <span className="font-semibold text-primary">Líder</span> : <span className="text-destructive">−{((b - a) * 100).toFixed(1)} pts</span>);
                  return (
                    <Fragment key={l.c.id}>
                      <tr className="border-t border-border">
                        <td className="px-3 py-2 align-top" rowSpan={3}><Posicao i={i} /></td>
                        <td className="px-3 py-2 align-top font-medium" rowSpan={3}>{l.c.nome}</td>
                        <td className="px-3 py-2 align-top text-muted-foreground" rowSpan={3}>{deptName(l.c.department_id)}</td>
                        <td className="px-3 py-2 font-semibold text-primary">Serviços{semServ && <span className="ml-1 text-xs font-normal text-muted-foreground">(não vende)</span>}</td>
                        <td className="px-3 py-2">{semServ ? "—" : brl(l.servicos)}</td>
                        <td className="px-3 py-2 text-muted-foreground">{semServ ? "—" : brl(l.mS)}</td>
                        <td className={`px-3 py-2 font-semibold ${semServ ? "text-muted-foreground" : tone(l.perfS)}`}>{semServ ? "—" : pct(l.perfS)}</td>
                        <td className={`px-3 py-2 ${semServ ? "text-muted-foreground" : tone(l.projPctS)}`}>{semServ ? "—" : brl(l.projS)}</td>
                        <td className="px-3 py-2">{semServ ? "—" : <Barra p={l.projPctS} />}</td>
                        <td className="px-3 py-2">{semServ ? "—" : l.necS ? brl(l.necS) : "—"}</td>
                        <td className="whitespace-nowrap px-3 py-2">{semServ ? "—" : vsLider(l.perfS, liderServ?.perfS)}</td>
                      </tr>
                      <tr className="border-t border-border bg-muted/30">
                        <td className="px-3 py-2 font-semibold text-primary">Peças</td>
                        <td className="px-3 py-2">{brl(l.pecas)}</td>
                        <td className="px-3 py-2 text-muted-foreground">{brl(l.mP)}</td>
                        <td className={`px-3 py-2 font-semibold ${tone(l.perfP)}`}>{pct(l.perfP)}</td>
                        <td className={`px-3 py-2 ${tone(l.projPctP)}`}>{brl(l.projP)}</td>
                        <td className="px-3 py-2"><Barra p={l.projPctP} /></td>
                        <td className="px-3 py-2">{l.necP ? brl(l.necP) : "—"}</td>
                        <td className="whitespace-nowrap px-3 py-2">{vsLider(l.perfP, liderPec?.perfP)}</td>
                      </tr>
                      <tr className="border-t border-border border-b-2 border-b-primary/30">
                        <td className="px-3 py-2 font-semibold">Total</td>
                        <td className="px-3 py-2 font-semibold">{brl(l.real)}</td>
                        <td className="px-3 py-2 text-muted-foreground">{brl(l.meta)}</td>
                        <td className={`px-3 py-2 font-semibold ${tone(l.perf)}`}>{pct(l.perf)}</td>
                        <td className={`px-3 py-2 font-semibold ${tone(l.projPct)}`}>{brl(l.proj)}</td>
                        <td className="px-3 py-2"><Barra p={l.projPct} /></td>
                        <td className="px-3 py-2">{l.nec ? brl(l.nec) : "—"}</td>
                        <td className="whitespace-nowrap px-3 py-2">{vsLider(l.perf, lider?.perf)}</td>
                      </tr>
                    </Fragment>
                  );
                })}
              </Tabela>
            </div>
            </Box>
        )}
        {show("agregados") && <Secao relatorio={relatorio} titulo="Agregados"><Agregados mes={mes} cons={visiveis} allCons={cons} tot={tot} dec={dec} deptName={deptName} reloadCons={load} relatorio={relatorio} /></Secao>}
        {show("mecanicos") && <Secao relatorio={relatorio} titulo="Técnicos"><Mecanicos mes={mes} tot={tot} dec={dec} /></Secao>}
        {tab === "controle-os" && <ControleOS />}
        {tab === "importacoes" && !relatorio && <div className="space-y-6 print:hidden">
          <div>
            <h2 className="text-lg font-semibold">Central de importações · {mes}</h2>
            <p className="text-sm text-muted-foreground">Todas as planilhas do dia em um só lugar. Cada bloco tem seu botão, prévia e confirmação. O Controle O.S. semanal continua na própria aba.</p>
          </div>
          <section className="space-y-3"><h3 className="font-semibold">1. Faturamento geral de vendas <span className="text-xs font-normal text-muted-foreground">— alimenta Painel, Ranking, Serviços, Peças</span></h3>
            <StatusFonte source="faturamento" mes={mes} updates={updates} clock={clock} />
            <SalesImport cons={cons} depts={depts} onDone={load} onPeriod={setMes} /></section>
          <section className="space-y-3"><h3 className="font-semibold">2. O.S. abertas <span className="text-xs font-normal text-muted-foreground">— alimenta Projeção + OS</span></h3>
            <StatusFonte source="os" mes={mes} updates={updates} clock={clock} />
            <OsAbertas modo="importar" linhas={linhas} mes={mes} soPecas={soPecas} tot={tot} dec={dec} deptName={deptName} semServicos={semServicos} /></section>
          <section className="space-y-3"><h3 className="font-semibold">3. Técnicos — faturamento e passagens <span className="text-xs font-normal text-muted-foreground">— alimenta Técnicos</span></h3>
            <StatusFonte source="mecanicos" mes={mes} updates={updates} clock={clock} />
            <Mecanicos modo="importar" mes={mes} tot={tot} dec={dec} /></section>
          <section className="space-y-3"><h3 className="font-semibold">4. Agregados — vendas de itens e passagens <span className="text-xs font-normal text-muted-foreground">— alimenta Agregados</span></h3>
            <StatusFonte source="agregados" mes={mes} updates={updates} clock={clock} />
            <Agregados modo="importar" mes={mes} cons={visiveis} allCons={cons} tot={tot} dec={dec} deptName={deptName} reloadCons={load} relatorio={false} /></section>
        </div>}
        {tab === "cockpit" && !relatorio && <Cockpit linhas={linhas} porDept={porDept} mes={mes} tot={tot} dec={dec} soPecas={soPecas} setTab={setTab} sales={sales} nome={email.split("@")[0] ?? ""} deptName={deptName} />}
        {tab === "nps" && !relatorio && <NpsPainel />}
        {tab === "pecas" && !relatorio && <PecasEstoque linhas={linhas} porDept={porDept} margemIdeal={margemIdeal} deptName={deptName} />}
        {tab === "metas" && !relatorio && <><CadeadoMes mes={mes} /><Config parte="metas" params={params} salvarParams={salvarParams} depts={depts} cons={cons} goals={goals} mes={mes} reload={load} deptName={deptName} irPara={setMes} /></>}
        {tab === "config" && <div className="space-y-6"><Equipe /><Config parte="config" params={params} salvarParams={salvarParams} depts={depts} cons={cons} goals={goals} mes={mes} reload={load} deptName={deptName} irPara={setMes} /></div>}
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

function Config({ parte, params, salvarParams, depts, cons, goals, mes, reload, deptName, irPara }: {
  parte: "config" | "metas"; params: Params; salvarParams: (p: Params) => void; depts: Dept[]; cons: Cons[]; goals: Goal[]; mes: string; reload: () => void; deptName: (id: string | null) => string; irPara: (mes: string) => void;
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
    <div className="space-y-6">
      {parte === "metas" && (() => {
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
      <section className={`space-y-4 rounded-xl border border-border bg-card p-6 ${parte === "metas" ? "hidden" : ""}`}>
        <h2 className="text-lg font-semibold">Dias do mês {mes}</h2>
        <Num label="Dias úteis totais" v={params.du_totais} on={(v) => salvarParams({ ...params, du_totais: v })} />
        <Num label="Dias úteis decorridos" v={params.du_decorridos} on={(v) => salvarParams({ ...params, du_decorridos: v })} />
        <Num label="Dias corridos totais" v={params.dc_totais} on={(v) => salvarParams({ ...params, dc_totais: v })} />
        <Num label="Dias corridos decorridos" v={params.dc_decorridos} on={(v) => salvarParams({ ...params, dc_decorridos: v })} />
        <p className="text-xs text-muted-foreground">No mês atual, os dias decorridos avançam sozinhos a cada dia (fins de semana não contam nos úteis). Você ainda pode ajustar manualmente — feriados, por exemplo.</p>
        <label className="block text-sm"><span className="text-muted-foreground">Projeção baseada em</span>
          <select value={params.base} onChange={(e) => salvarParams({ ...params, base: e.target.value })} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2">
            <option value="uteis">Dias úteis</option><option value="corridos">Dias corridos</option>
          </select>
        </label>
        <h2 className="pt-4 text-lg font-semibold">Departamentos</h2>
        <div className="flex gap-2">
          <input value={novoDept} onChange={(e) => setNovoDept(e.target.value)} placeholder="Nome do departamento" className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm" />
          <button onClick={async () => { if (novoDept.trim()) { await supabase.from("departments").insert({ nome: novoDept.trim() }); setNovoDept(""); reload(); } }} className="rounded-lg bg-secondary px-3 text-sm font-medium text-secondary-foreground">Adicionar</button>
        </div>
        {depts.map((d) => (
          <div key={d.id} className="flex justify-between text-sm"><span>{d.nome}</span>
            <button onClick={async () => { await supabase.from("departments").delete().eq("id", d.id); reload(); }} className="text-destructive">Remover</button>
          </div>
        ))}
      </section>
      <section className={`space-y-3 rounded-xl border border-border bg-card p-6 ${parte === "metas" ? "lg:col-span-3" : "lg:col-span-2"}`}>
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
      </section>
      </div>
      {parte === "metas" && <TecnicosMetas mes={mes} />}
    </div>
  );
}
