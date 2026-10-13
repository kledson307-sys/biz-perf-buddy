import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Barra, Box, Cmp, Kpi, Num, Secao, Tabela, bg, brl, div, norm, parseNum, pct, tone } from "@/components/painel-ui";
import { Agregados } from "@/components/Agregados";
import { SalesImport } from "@/components/SalesImport";
import { EnvioWhatsapp } from "@/components/EnvioWhatsapp";
import { ResumoPainel } from "@/components/ResumoPainel";
import { OsAbertas } from "@/components/OsAbertas";
import { ControleOS } from "@/components/ControleOS";
import { Mecanicos } from "@/components/Mecanicos";
import { Equipe } from "@/components/Equipe";
import { MinhaPerformance } from "@/components/MinhaPerformance";
import { RankingMobile } from "@/components/RankingMobile";
import { MetasAno } from "@/components/MetasAno";
import { AnaliseFechamento, Reconhecimento } from "@/components/RelatorioAnalise";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Download, LogOut, Printer } from "lucide-react";
import bmwLogo from "@/assets/bmw-logo.asset.json";
import { localDay, sourceLabels, tabUpdateStatus, UPDATE_EVENT, type UpdateRecord, type UpdateSource } from "@/lib/update-status";

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
  useEffect(() => {
    if (!session) { setPapel(undefined); return; }
    supabase.from("team_members").select("papel").ilike("email", email).maybeSingle().then(({ data }) => setPapel(data?.papel ?? null));
  }, [session, email]);
  if (!ready || (session && papel === undefined)) return <div className="p-10 text-center text-muted-foreground">Carregando…</div>;
  if (!session) return <Login />;
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
  const [tab, setTab] = useState("painel");
  const [relatorio, setRelatorio] = useState(false);
  const show = (k: string) => tab === k || relatorio;
  useEffect(() => { const f = () => setRelatorio(false); window.addEventListener("afterprint", f); return () => window.removeEventListener("afterprint", f); }, []);
  const gerarRelatorio = () => { setRelatorio(true); setTimeout(() => window.print(), 1200); };
  const [filtroDept, setFiltroDept] = useState("todos");
  const [updates, setUpdates] = useState<UpdateRecord[]>([]);
  const [clock, setClock] = useState(() => new Date());
  const lastUp = updates[0] ?? null;
  const status = tabUpdateStatus(tab, mes, updates, clock);
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
    setTab(source === "faturamento" ? "painel" : source);
    if (source === "faturamento") setTimeout(() => document.getElementById("colar-dados")?.scrollIntoView({ block: "start" }), 0);
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

  const calc = (servicos: number, pecas: number, mS: number, mP: number, margem = 0) => {
    const real = servicos + pecas, meta = mS + mP;
    const projS = div(servicos, dec) * tot, projP = div(pecas, dec) * tot, proj = projS + projP;
    const rest = Math.max(tot - dec, 0);
    return {
      servicos, pecas, real, mS, mP, meta, projS, projP, proj, margem, marg: div(margem, pecas),
      perfS: div(servicos, mS), perfP: div(pecas, mP), perf: div(real, meta),
      projPctS: div(projS, mS), projPctP: div(projP, mP), projPct: div(proj, meta),
      mediaDia: div(real, dec),
      necS: rest ? Math.max(mS - servicos, 0) / rest : 0,
      necP: rest ? Math.max(mP - pecas, 0) / rest : 0,
      nec: rest ? Math.max(meta - real, 0) / rest : 0,
    };
  };
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

  const tabs = [["painel", "Painel"], ["ranking", "Ranking"], ["proj-serv", "Serviços"], ["proj-pec", "Peças"], ["proj-total", "Serviços & Peças"], ["os", "Projeção + OS"], ["controle-os", "Controle O.S."], ["mecanicos", "Técnicos"], ["agregados", "Agregados"], ["diario", "Diário"], ["config", "Configurar"]];

  const [anoMes, mesNum] = mes.split("-").map(Number);
  const mesExt = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(anoMes!, mesNum! - 1, 1));
  const mesExtenso = mesExt.charAt(0).toUpperCase() + mesExt.slice(1);
  const dataHora = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-t-4 border-primary border-b border-border bg-card print:hidden">
        <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-4 sm:flex sm:flex-wrap sm:justify-between sm:px-6 sm:py-6">
          <div className="flex min-w-0 items-center gap-2 sm:gap-4">
            <img src={bmwLogo.url} alt="BMW" className="size-9 shrink-0 sm:size-14" />
            <div className="min-w-0">
              <h1 className="text-sm font-bold sm:text-xl">PAINEL ESTRATÉGICO <span className="inline-block font-medium text-primary">KLEDSON</span></h1>
              <p className="mt-1 text-xs font-medium text-muted-foreground">PAINEL DE METAS · {params.base === "uteis" ? "Dias úteis" : "Dias corridos"}: {dec} de {tot}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-3">
            <p className="hidden break-all text-xs text-muted-foreground sm:block">{email}</p>
            <ThemeToggle />
            <Button variant="ghost" size="icon" title="Sair" aria-label="Sair" onClick={() => void supabase.auth.signOut()}><LogOut /></Button>
          </div>
        </div>
        <div className="border-t border-border bg-muted/40">
          <div className="mx-auto grid max-w-7xl grid-cols-2 items-center gap-2 px-3 py-3 sm:flex sm:flex-wrap sm:gap-3 sm:px-6">
            <input aria-label="Mês do relatório" type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="min-w-0 w-full rounded-md border border-input bg-card px-2 py-2 text-sm sm:w-auto" />
            <select aria-label="Departamento" value={filtroDept} onChange={(e) => setFiltroDept(e.target.value)} className="min-w-0 w-full rounded-md border border-input bg-card px-2 py-2 text-sm sm:w-auto">
              <option value="todos">Todos departamentos</option>
              {depts.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
            </select>
            <nav aria-label="Abas do painel" className="col-span-2 grid min-w-0 grid-cols-3 gap-1 sm:flex sm:flex-wrap lg:ml-auto">
              {tabs.map(([k, l]) => {
                if (!k) return null;
                const stale = tabUpdateStatus(k, mes, updates, clock).stale;
                return <Button key={k} onClick={() => setTab(k)} variant={tab === k ? "default" : "ghost"}
                  data-update-status={stale ? "pending" : "current"}
                  title={stale ? `${l}: atualização pendente` : l}
                  className={`h-auto min-h-9 min-w-0 whitespace-normal px-1 py-2 text-xs sm:px-4 sm:text-sm ${stale ? "update-alert bg-destructive text-destructive-foreground hover:bg-destructive/90 hover:text-destructive-foreground" : tab === k ? "" : "text-muted-foreground"}`}
                  aria-current={tab === k ? "page" : undefined}>{l}</Button>;
              })}
            </nav>
          </div>
        </div>
      </header>

      {status.latest.length > 0 && <div data-testid="update-banner" className={`border-b print:hidden ${status.stale ? "update-alert border-destructive bg-destructive text-destructive-foreground" : "border-border bg-primary/5 text-muted-foreground"}`}>
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-2 text-xs sm:px-6">
          <div className="min-w-0 flex-1 space-y-1">
            {status.latest.map(({ source, record }) => <p key={source} className="break-words">
              {sourceLabels[source]}: {record ? <>última atualização {dataHora(record.at)} por <span className="font-medium">{record.nome}</span> · {record.origem}</> : "nenhuma atualização registrada."}
            </p>)}
          </div>
          {status.pending.map((source) => <Button key={source} type="button" variant="outline" size="sm" onClick={() => openUpdate(source)} className="h-auto whitespace-normal bg-background font-semibold text-destructive">
            ⚠️ Atualizar {sourceLabels[source]}{source === "controle-os" ? " da semana" : " de hoje"}
          </Button>)}
          {mes !== localDay(clock).slice(0, 7) && <span>Mês arquivado</span>}
        </div>
      </div>}

      <main className={`mx-auto min-w-0 max-w-7xl space-y-4 px-3 py-4 sm:space-y-6 sm:px-6 sm:py-8 ${tab === "painel" ? "painel-phone" : ""}`}>
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
            diario: [`Média da equipe ${brl(total.mediaDia)}/dia; necessário ${brl(total.nec)}/dia.`, total.mediaDia >= total.nec ? "Ritmo diário suficiente: mantenha." : "Identifique os dias fracos e reforce a abertura da manhã."],
            config: [semMeta ? `${semMeta} consultor(es) sem meta neste mês.` : "Metas e dias configurados.", semMeta ? "Cadastre as metas faltantes para a projeção ficar correta." : "Confira feriados nos dias úteis."],
          };
          const [analise, acao] = o[tab] ?? o["painel"]!;
          return (
            <div className="rounded-lg border-l-4 border-primary bg-primary/5 px-4 py-3 text-sm print:hidden">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">Orientação ao gestor</p>
              <p className="mt-1"><span className="font-medium">Análise:</span> {analise}</p>
              <p><span className="font-medium">Ação:</span> {acao}</p>
            </div>
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
                <Kpi label="Projeção Serviços" value={brl(total.projS)} sub={`${pct(total.projPctS)} da meta ${brl(total.mS)}`} cls={tone(total.projPctS)} />
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
              <Kpi label="Realizado Serviços Total" value={brl(total.servicos)} sub={`Meta ${brl(total.mS)} · ${pct(total.perfS)}`} cls={tone(total.perfS)} />
              <Kpi label="Realizado Peças Total" value={brl(total.pecas)} sub={`Meta ${brl(total.mP)} · ${pct(total.perfP)} · margem ${margemTxt(total)}`} cls={tone(total.perfP)} />
              <Kpi label="Projeção Serviços" value={brl(total.projS)} sub={`${pct(total.projPctS)} da meta ${brl(total.mS)}`} cls={tone(total.projPctS)} />
              <Kpi label="Projeção Peças" value={brl(total.projP)} sub={`${pct(total.projPctP)} da meta ${brl(total.mP)}`} cls={tone(total.projPctP)} />
              <Kpi label="Projeção Total" value={brl(total.proj)} sub={`${pct(total.projPct)} · precisa serviços ${brl(total.necS)}/dia · precisa peças ${brl(total.necP)}/dia`} cls={tone(total.projPct)} />
            </div>

            <Box title="Resultados por departamento">
              <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
                {porDept.map((d) => (
                  <div key={d.nome} className="rounded-lg border border-border bg-card p-4">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="font-semibold">{d.nome}</p>
                      <p className={`text-sm font-semibold ${tone(d.projPct)}`}>Proj. {pct(d.projPct)}</p>
                    </div>
                    <div className="mt-2"><Barra p={d.projPct} /></div>
                    <div className="mt-3 space-y-2 text-sm">
                      {!semServicos(d.nome) && (
                        <>
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-muted-foreground">Serviços</span>
                            <span>{brl(d.servicos)} <span className="text-xs text-muted-foreground">meta {brl(d.mS)}</span> <span className={`text-xs font-semibold ${tone(d.perfS)}`}>{pct(d.perfS)}</span></span>
                          </div>
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-xs text-muted-foreground">Projeção serviços</span>
                            <span className={tone(d.projPctS)}>{brl(d.projS)} <span className="text-xs">{pct(d.projPctS)} da meta</span></span>
                          </div>
                        </>
                      )}
                      <div className={`flex items-baseline justify-between gap-2 ${semServicos(d.nome) ? "" : "border-t border-border pt-2"}`}>
                        <span className="text-muted-foreground">Peças</span>
                        <span>{brl(d.pecas)} <span className="text-xs text-muted-foreground">meta {brl(d.mP)}</span> <span className={`text-xs font-semibold ${tone(d.perfP)}`}>{pct(d.perfP)}</span></span>
                      </div>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-xs text-muted-foreground">Projeção peças</span>
                        <span className={tone(d.projPctP)}>{brl(d.projP)} <span className="text-xs">{pct(d.projPctP)} da meta</span></span>
                      </div>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-xs text-muted-foreground">Margem peças</span>
                        <span className={`font-semibold ${margemTone(d.nome, d.margem, d.pecas)}`}>{margemTxt(d)} <span className="text-xs font-normal text-muted-foreground">ideal {pct(margemIdeal(d.nome))}</span></span>
                      </div>
                      <div className="flex items-baseline justify-between gap-2 border-t border-border pt-2">
                        <span className="text-muted-foreground">Projeção total</span>
                        <span className="font-semibold">{brl(d.proj)} <span className={`text-xs font-semibold ${tone(d.projPct)}`}>{pct(d.projPct)}</span></span>
                      </div>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-muted-foreground">Realizado / Meta</span>
                        <span>{brl(d.real)} <span className="text-xs text-muted-foreground">/ {brl(d.meta)}</span> <span className={`text-xs font-semibold ${tone(d.perf)}`}>{pct(d.perf)}</span></span>
                      </div>
                      <p className="text-xs text-muted-foreground">Precisa por dia: {semServicos(d.nome) ? `peças ${brl(d.necP)}` : `serviços ${brl(d.necS)} · peças ${brl(d.necP)}`}</p>
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
            {tab === "painel" && !relatorio && <div id="colar-dados" className="scroll-mt-6 space-y-4 border-t border-border pt-6 print:hidden">
              <h2 className="text-lg font-semibold">Colar dados</h2>
              <SalesImport cons={cons} depts={depts} onDone={load} onPeriod={setMes} />
            </div>}
          </Secao>
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
                    <td className="px-3 py-2">{i + 1}</td>
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
                    <td className="px-3 py-2">{i + 1}</td>
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
            <Box title="Projeção individual (serviços + peças)">
              <Tabela head={["#", "Consultor", "Depto", "Grupo", "Realizado", "Meta", "Performance", "Projeção", "Proj. %", "Necessário/dia", "vs. Líder"]}>
                {linhas.length === 0 && <tr><td colSpan={11} className="px-3 py-10 text-center text-muted-foreground">Sem dados. Cadastre consultores em "Configurar" e cole os dados do dia.</td></tr>}
                {linhas.map((l, i) => {
                  const semServ = soPecas(l.c.nome);
                  const vsLider = (a: number, b: number | undefined) => (b === undefined ? "—" : a >= b ? <span className="font-semibold text-primary">Líder</span> : <span className="text-destructive">−{((b - a) * 100).toFixed(1)} pts</span>);
                  return (
                    <Fragment key={l.c.id}>
                      <tr className="border-t border-border">
                        <td className="px-3 py-2 align-top" rowSpan={3}>{i + 1}</td>
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
            </Box>
          </Secao>
        )}

        {tab === "ranking" && (
          <Box title={`Ranking geral das vendedoras · ${mesExtenso}`}>
            <RankingMobile linhas={linhas} total={total} deptName={deptName} soPecas={soPecas} />
            <div className="hidden overflow-x-auto md:block">
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
        )}
        {show("agregados") && <Secao relatorio={relatorio} titulo="Agregados"><Agregados mes={mes} cons={visiveis} allCons={cons} tot={tot} dec={dec} deptName={deptName} reloadCons={load} relatorio={relatorio} /></Secao>}
        {show("diario") && <Secao relatorio={relatorio} titulo="Performance diária e acumulada"><Diario sales={sales} cons={visiveis} metaTotal={total.meta} tot={tot} /></Secao>}
        {tab === "controle-os" && <ControleOS />}
        {show("mecanicos") && <Secao relatorio={relatorio} titulo="Técnicos"><Mecanicos mes={mes} tot={tot} dec={dec} /></Secao>}
        {tab === "config" && <div className="space-y-6"><Equipe /><Config params={params} salvarParams={salvarParams} depts={depts} cons={cons} goals={goals} mes={mes} reload={load} deptName={deptName} irPara={setMes} /></div>}
      </main>
    </div>
  );
}

function Diario({ sales, cons, metaTotal, tot }: { sales: Sale[]; cons: Cons[]; metaTotal: number; tot: number }) {
  const [sel, setSel] = useState("todos");
  const ids = new Set(sel === "todos" ? cons.map((c) => c.id) : [sel]);
  const dias = [...new Set(sales.map((s) => s.dia))].sort();
  let acS = 0, acP = 0;
  const rows = dias.map((d) => {
    const ss = sales.filter((s) => s.dia === d && ids.has(s.consultant_id));
    const s = ss.reduce((a, x) => a + x.servicos, 0), p = ss.reduce((a, x) => a + x.pecas, 0);
    acS += s; acP += p;
    return { d, s, p, t: s + p, acS, acP, ac: acS + acP };
  });
  const max = Math.max(1, ...rows.map((r) => r.t));
  const metaDia = div(metaTotal, tot);
  return (
    <Box title="Performance diária e acumulada do mês">
      <div className="flex items-center gap-2 p-4">
        <select value={sel} onChange={(e) => setSel(e.target.value)} className="rounded-lg border border-input bg-background px-3 py-2 text-sm">
          <option value="todos">Todos os consultores</option>
          {cons.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        {sel === "todos" && <span className="text-sm text-muted-foreground">Meta diária necessária: {brl(metaDia)}</span>}
      </div>
      <Tabela head={["Dia", "Serviços", "Peças", "Total do dia", "", "Acum. Serviços", "Acum. Peças", "Acumulado"]}>
        {rows.length === 0 && <tr><td colSpan={8} className="px-3 py-10 text-center text-muted-foreground">Nenhum lançamento neste mês.</td></tr>}
        {rows.map((r) => (
          <tr key={r.d} className="border-t border-border">
            <td className="px-3 py-2 font-medium">{r.d.split("-").reverse().join("/")}</td>
            <td className="px-3 py-2">{brl(r.s)}</td>
            <td className="px-3 py-2">{brl(r.p)}</td>
            <td className="px-3 py-2 font-semibold">{brl(r.t)}</td>
            <td className="px-3 py-2"><div className="h-2 w-32 rounded bg-muted"><div className={`h-full rounded ${sel === "todos" && metaDia ? bg(r.t / metaDia) : "bg-primary"}`} style={{ width: `${(r.t / max) * 100}%` }} /></div></td>
            <td className="px-3 py-2">{brl(r.acS)}</td>
            <td className="px-3 py-2">{brl(r.acP)}</td>
            <td className="px-3 py-2 font-semibold">{brl(r.ac)}{sel === "todos" && metaTotal ? <span className="ml-2 text-xs text-muted-foreground">({pct(r.ac / metaTotal)})</span> : null}</td>
          </tr>
        ))}
      </Tabela>
    </Box>
  );
}

function Config({ params, salvarParams, depts, cons, goals, mes, reload, deptName, irPara }: {
  params: Params; salvarParams: (p: Params) => void; depts: Dept[]; cons: Cons[]; goals: Goal[]; mes: string; reload: () => void; deptName: (id: string | null) => string; irPara: (mes: string) => void;
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
      <MetasAno cons={cons} irPara={irPara} onSaved={reload} />
      <div className="grid gap-6 lg:grid-cols-3">
      <section className="space-y-4 rounded-xl border border-border bg-card p-6">
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
      <section className="space-y-3 rounded-xl border border-border bg-card p-6 lg:col-span-2">
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
    </div>
  );
}
