import { useEffect, useMemo, useState } from "react";
import { LogOut, PackageCheck, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { brl } from "@/components/painel-ui";
import bmwLogo from "@/assets/bmw-logo.asset.json";
import { comStatusManual, ehEncerrado, hoje, normalizar, STATUS, STATUS_KEY, type OsItem, type StatusManual } from "@/lib/os-controle";
import { NOTIFICATIONS_EVENT } from "@/components/Notificacoes";
import { toast } from "sonner";
import { unificarPecas, semPrevisao, SEM_PREV_KEY, type OsGrupo } from "@/lib/os-agrupar";

type Acomp = { acoes: Record<string, unknown>; prev_manual: string | null };

/** Tela do setor de peças: previsão de chegada e baixa "peça recebida" (status → Em serviço). */
export function AcessoPecas({ email }: { email: string }) {
  const [imp, setImp] = useState<{ at: string; itens: OsItem[] } | null>(null);
  const [acomp, setAcomp] = useState<Record<string, Acomp>>({});
  const [busca, setBusca] = useState("");
  const [todos, setTodos] = useState(false);
  const load = async () => {
    const [i, a] = await Promise.all([
      supabase.from("os_imports").select("at,itens").order("at", { ascending: false }).limit(1),
      supabase.from("os_acompanhamento").select("os_n,acoes,prev_manual"),
    ]);
    const s = i.data?.[0];
    setImp(s ? { at: s.at, itens: normalizar(s.itens as unknown as OsItem[]) } : { at: "", itens: [] });
    setAcomp(Object.fromEntries((a.data ?? []).map((x) => [x.os_n, { acoes: (x.acoes ?? {}) as Record<string, unknown>, prev_manual: x.prev_manual }])));
  };
  useEffect(() => { void load(); }, []);
  const salvar = async (n: string, v: Acomp) => {
    setAcomp((p) => ({ ...p, [n]: v }));
    const { error } = await supabase.from("os_acompanhamento").upsert({ os_n: n, acoes: v.acoes as never, prev_manual: v.prev_manual, updated_at: new Date().toISOString() }, { onConflict: "user_id,os_n" });
    if (error) { toast.error("Não foi possível salvar: " + error.message); return false; }
    window.dispatchEvent(new Event(NOTIFICATIONS_EVENT));
    return true;
  };
  const lista = useMemo(() => (imp?.itens ?? [])
    .filter((i) => !ehEncerrado(acomp[i.n]?.acoes))
    .map((i) => comStatusManual(i, acomp[i.n]?.acoes, imp!.at))
    .filter((i) => todos ? i.st !== "pronto" : i.st === "pecas")
    .filter((i) => { const q = busca.trim().toLowerCase(); return !q || [i.n, i.placa, i.cli, i.mod].some((x) => x.toLowerCase().includes(q)); })
    .sort((a, b) => b.dias - a.dias), [imp, acomp, busca, todos]);
  const grupos = useMemo(() => unificarPecas(lista), [lista]);
  const ref = hoje();
  const aguard = (imp?.itens ?? []).filter((i) => !ehEncerrado(acomp[i.n]?.acoes) && comStatusManual(i, acomp[i.n]?.acoes, imp!.at).st === "pecas");
  const semPrev = aguard.filter((i) => !acomp[i.n]?.prev_manual && !semPrevisao(acomp[i.n]?.acoes, hoje()).ativo).length;
  const atras = aguard.filter((i) => { const p = acomp[i.n]?.prev_manual; return p && p < ref; }).length;
  const recebida = async (g: OsGrupo) => {
    if (!confirm(`Confirmar chegada da peça da O.S. ${g.n}? A O.S. vai para "Em serviço".`)) return;
    let ok = true;
    for (const n of g.ns) {
      const ac = acomp[n] ?? { acoes: {}, prev_manual: null };
      const m = ac.acoes[STATUS_KEY] as StatusManual | undefined;
      const at = new Date().toISOString(); const nota = "Peça recebida pelo setor de peças";
      const hist = [{ st: "servico" as const, nota, at, por: email }, ...(m?.hist ?? [])].slice(0, 30);
      ok = (await salvar(n, { ...ac, acoes: { ...ac.acoes, [STATUS_KEY]: { feito: true, nota, at, st: "servico", hist } } })) && ok;
    }
    if (ok) toast.success(`O.S. ${g.n} agora está Em serviço.`);
  };
  const salvarPrev = async (g: OsGrupo, v: string | null) => {
    let ok = true;
    for (const n of g.ns) ok = (await salvar(n, { acoes: acomp[n]?.acoes ?? {}, prev_manual: v })) && ok;
    if (ok) toast.success("Previsão salva.");
  };
  const marcarSemPrev = async (g: OsGrupo) => {
    if (!confirm("Marcar \"Sem previsão\"? Só pode ser usado uma vez e vale 10 dias; depois a data será obrigatória.")) return;
    let ok = true; const at = new Date().toISOString();
    for (const n of g.ns) { const ac = acomp[n] ?? { acoes: {}, prev_manual: null }; ok = (await salvar(n, { ...ac, acoes: { ...ac.acoes, [SEM_PREV_KEY]: { at, por: email } } })) && ok; }
    if (ok) toast.success("Marcado como sem previsão por 10 dias.");
  };
  const nome = (k: string) => STATUS.find((s) => s.k === k)?.nome ?? k;
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-card/95 px-4 py-2 backdrop-blur">
        <img src={bmwLogo.url} alt="BMW" className="size-9" />
        <div className="flex-1 leading-tight"><h1 className="font-bold">Setor de Peças</h1><p className="text-[11px] text-muted-foreground">Previsões de chegada e peças recebidas · {email}</p></div>
        <ThemeToggle />
        <Button variant="ghost" size="icon" aria-label="Sair" onClick={() => void supabase.auth.signOut()}><LogOut /></Button>
      </header>
      <main className="mx-auto max-w-6xl space-y-3 p-3 sm:p-5">
        <div className="grid grid-cols-3 gap-2">
          {[["Aguardando peças", aguard.length, ""], ["Sem previsão", semPrev, "text-warning"], ["Previsão vencida", atras, "text-destructive"]].map(([l, v, c]) => (
            <div key={l as string} className="lux-card p-3"><p className="text-[11px] uppercase text-muted-foreground">{l}</p><p className={`text-2xl font-bold ${c}`}>{v}</p></div>))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1"><Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar O.S., placa, cliente ou modelo" aria-label="Buscar" className="w-full rounded-md border border-input bg-background py-2 pl-8 pr-2 text-sm" /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={todos} onChange={(e) => setTodos(e.target.checked)} />Mostrar outras O.S. abertas</label>
        </div>
        {!imp ? <p className="p-6 text-center text-muted-foreground">Carregando…</p> : grupos.length === 0 ? <p className="p-6 text-center text-muted-foreground">Nenhuma O.S. aguardando peças.</p> :
        <div className="space-y-2">{grupos.map((i) => { const ac = acomp[i.ns[0]!]; const p = ac?.prev_manual ?? ""; const venc = p && p < ref;
          const sp = semPrevisao(ac?.acoes, ref); const exige = sp.usado && !sp.ativo && !p; return (
          <div key={i.n} className={`lux-card flex flex-wrap items-center gap-3 p-3 text-sm ${venc || exige ? "border-destructive/60" : ""}`}>
            <div className="min-w-48 flex-1"><p className="font-semibold">O.S. {i.n} · {i.placa || "sem placa"}{i.ns.length > 1 && <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] text-primary">{i.ns.length} O.S. unificadas</span>}</p>
              <p className="text-xs text-muted-foreground">{i.cli} · {i.mod} · {i.cons}</p>
              <p className="text-xs text-muted-foreground">{nome(i.st)} · {i.dias} d na oficina · peças {brl(i.pec)}</p>
              {i.obs && <p className="text-[11px] text-muted-foreground">Obs.: {i.obs}</p>}
              {!p && sp.ativo && <p className="text-[11px] text-warning">Sem previsão (aguardando código) · restam {sp.restam} dia(s)</p>}
              {exige && <p className="text-[11px] font-semibold text-destructive">Prazo de 10 dias encerrado — informe a previsão.</p>}</div>
            <label className="text-xs text-muted-foreground">Previsão de chegada
              <input type="date" aria-label={`Previsão de chegada O.S. ${i.n}`} value={p} onChange={(e) => void salvarPrev(i, e.target.value || null)}
                className={`mt-1 block rounded border border-input bg-background px-2 py-1 text-foreground ${venc || exige ? "border-destructive" : ""}`} /></label>
            {!p && !sp.usado && <Button variant="outline" size="sm" onClick={() => void marcarSemPrev(i)}>Sem previsão</Button>}
            <Button onClick={() => void recebida(i)} className="gap-1"><PackageCheck className="size-4" />Peça recebida</Button>
          </div>); })}</div>}
      </main>
    </div>
  );
}
