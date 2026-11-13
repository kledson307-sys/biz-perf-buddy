import { alertasSync, type StatusSync } from "@/lib/sync-planilhas";
import { useCallback, useEffect, useState } from "react";
import { Bell, CheckCheck, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { analisar, foraDosAlertas, fmt, hoje, retornoDevido, type OsImport, type OsItem } from "@/lib/os-controle";
import { classe, type NpsItem } from "@/lib/nps";
import { norm } from "@/components/painel-ui";
import { ativarAvisos, atualizarBadge, avisarNovos, avisosAtivos, avisosSuportados } from "@/lib/aviso-aparelho";

type AgendaAlerta = { id: string; hora: string; cliente: string; placa: string; categoria: string; segmento: string; aceito: boolean; confirmacao: string | null };

/** Alertas da oficina (Marcos/Delmir): diagnóstico >3 dias, peças >7 dias, D+1 detrator e fila do testador. */
export async function alertasOficina(): Promise<Notification[]> {
  const mes = hoje().slice(0, 7);
  const [pn, ag, nps] = await Promise.all([
    supabase.rpc("painel_oficina" as never, { p_mes: mes } as never),
    supabase.rpc("oficina_agenda_alertas" as never),
    supabase.rpc("meu_nps"),
  ]);
  if (pn.error) throw pn.error;
  const P = pn.data as unknown as { snapshots: { at: string; itens: OsItem[] }[]; acomp: { os_n: string; prev: string | null; judicial: boolean }[] } | null;
  const [atual, ant] = P?.snapshots ?? [];
  const anterior = ant ? ({ id: "", nome: "", arquivo: "", at: ant.at, itens: ant.itens } as OsImport) : undefined;
  const ac = new Map((P?.acomp ?? []).map((a) => [a.os_n, a]));
  const ref = hoje();
  const out: Notification[] = [];
  for (const i of atual?.itens ?? []) {
    const a = ac.get(i.n); if (a?.judicial || i.st === "encerrado") continue;
    const x = analisar(i, anterior, ref, a?.prev);
    if (i.st === "diag" && x.diasStatus > 3) out.push({ id: `diag-${i.n}`, titulo: `O.S. ${i.n} · diagnóstico parado ${x.diasStatus} dias`, texto: `${i.cli} · ${i.mod} · ${i.cons}`, feito: false });
    if (i.st === "pecas" && x.diasStatus > 7) out.push({ id: `pecas-${i.n}`, titulo: `O.S. ${i.n} · aguardando peça há ${x.diasStatus} dias`, texto: `${i.cli} · ${i.mod}${x.prev ? ` · previsão ${fmt(x.prev)}` : " · sem previsão"}`, feito: false });
  }
  const A = ag.data as unknown as { data: string | null; itens: AgendaAlerta[] } | null;
  const detr = new Set((((nps.data as { itens?: NpsItem[] } | null)?.itens) ?? []).filter((n) => n.nota !== null && classe(n.nota) === "detrator").map((n) => norm(n.cliente.trim())));
  for (const r of A?.itens ?? []) {
    if (detr.has(norm(r.cliente.trim()))) out.push({ id: `detr-${r.id}`, titulo: `Amanhã ${r.hora} · cliente detrator NPS`, texto: `${r.cliente} · ${r.placa} · recepção blindada`, feito: false });
    if (r.categoria === "diagnostico" && !r.aceito) out.push({ id: `test-${r.id}`, titulo: `Testador · diagnóstico de amanhã ${r.hora}`, texto: `${r.cliente} · ${r.placa} · follow-up pendente`, feito: false });
  }
  return out;
}

export const NOTIFICATIONS_EVENT = "os-notifications-updated";
type Retorno = { id: string; os_n: string; consultor: string; data_ref: string; nota: string; visto: boolean };
type Notification = { id: string; titulo: string; texto: string; feito: boolean };

/** Reuses existing team reads and the seller-only RPC; never broadens seller access. */
export function Notificacoes({ vendedor = false, oficina = false, abrir }: { vendedor?: boolean; oficina?: boolean; abrir: () => void }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    try {
      if (oficina) { setItems(await alertasOficina()); setError(""); return; }
      let itens: OsItem[] = [];
      let retornos: Pick<Retorno, "os_n" | "data_ref">[] = [];
      let novos: Retorno[] = [];
      if (vendedor) {
        const result = await supabase.rpc("minhas_os");
        if (result.error) throw result.error;
        const data = result.data as unknown as { itens: OsItem[]; retornos: typeof retornos } | null;
        itens = data?.itens ?? [];
        retornos = data?.retornos ?? [];
      } else {
        const [snapshot, history, acomp] = await Promise.all([
          supabase.from("os_imports").select("itens").order("at", { ascending: false }).limit(1),
          supabase.from("os_retornos").select("id,os_n,consultor,data_ref,nota,visto").order("feito_at", { ascending: false }),
          supabase.from("os_acompanhamento").select("os_n,acoes"),
        ]);
        const judiciais = new Set((acomp.data ?? []).filter(x => foraDosAlertas(x.acoes)).map(x => x.os_n));
        if (snapshot.error) throw snapshot.error;
        if (history.error) throw history.error;
        itens = ((snapshot.data?.[0]?.itens ?? []) as unknown as OsItem[]).filter(i => !judiciais.has(i.n));
        retornos = history.data ?? [];
        novos = (history.data ?? []).filter(r => !r.visto);
      }
      const pendentes: Notification[] = itens.flatMap(i => {
        const due = retornoDevido(i, hoje());
        if (!due || retornos.some(r => r.os_n === i.n && r.data_ref >= due)) return [];
        return [{ id: `pendente-${i.n}`, titulo: `O.S. ${i.n} · retorno pendente`, texto: `${vendedor ? i.cli : i.cons} · ${i.st === "diag" ? "Em diagnóstico" : "Aguardando peças"} · desde ${fmt(due)}`, feito: false }];
      });
      let planilhas: Notification[] = [];
      if (!vendedor) {
        const { data: ss } = await supabase.from("oficina_mes").select("mes,diario").like("mes", "sync-%");
        planilhas = alertasSync(Object.fromEntries((ss ?? []).map((x) => [x.mes.slice(5), x.diario as unknown as StatusSync])));
      }
      setItems([
        ...planilhas,
        ...novos.map(r => ({ id: r.id, titulo: `O.S. ${r.os_n} · retorno realizado`, texto: `${r.consultor}: ${r.nota}`, feito: true })),
        ...pendentes,
      ]);
      setError("");
    } catch {
      setError("Não foi possível carregar as notificações.");
    } finally {
      setLoading(false);
    }
  }, [vendedor, oficina]);
  useEffect(() => {
    void load();
    const refresh = () => { void load(); };
    window.addEventListener("focus", refresh);
    window.addEventListener(NOTIFICATIONS_EVENT, refresh);
    const timer = window.setInterval(refresh, 60000);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener(NOTIFICATIONS_EVENT, refresh);
      window.clearInterval(timer);
    };
  }, [load]);
  const [ativos, setAtivos] = useState(false);
  useEffect(() => { setAtivos(avisosAtivos()); }, []);
  useEffect(() => { if (loading || error) return; atualizarBadge(items.length); avisarNovos(items); }, [items, loading, error]);
  const go = () => { setOpen(false); abrir(); };
  return (
    <Popover open={open} onOpenChange={v => { setOpen(v); if (v) void load(); }}>
      <PopoverTrigger asChild>
        <Button size="icon" variant="ghost" className="relative shrink-0 print:hidden" title="Notificações" aria-label={`Notificações${items.length ? ` (${items.length})` : ""}`}>
          <Bell className={items.length ? "text-destructive" : ""} />
          {items.length > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">{items.length > 99 ? "99+" : items.length}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 max-w-[calc(100vw-2rem)] p-0">
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3"><h2 className="font-semibold">Notificações {items.length > 0 && `(${items.length})`}</h2>
          {!ativos && avisosSuportados() && <Button size="sm" variant="outline" onClick={async () => setAtivos(await ativarAvisos())}>Ativar avisos no aparelho</Button>}
        </div>
        <div className="max-h-80 overflow-y-auto" role="region" aria-label="Lista de notificações">
          {error ? <div className="space-y-2 p-4 text-sm text-destructive"><p role="alert">{error}</p><Button size="sm" variant="outline" onClick={() => void load()}>Tentar novamente</Button></div> : loading ? <p className="p-4 text-sm text-muted-foreground">Carregando…</p> : items.length === 0 ? <p className="p-4 text-sm text-muted-foreground">Nenhuma notificação pendente.</p> : items.map(item => (
            <Button key={item.id} variant="ghost" onClick={go} className="h-auto w-full justify-start gap-3 whitespace-normal rounded-none border-b border-border p-4 text-left">
              {item.feito ? <CheckCheck className="size-4 shrink-0 text-success" /> : <Clock className="size-4 shrink-0 text-destructive" />}
              <span className="min-w-0"><span className="block text-sm font-semibold">{item.titulo}</span><span className="mt-1 block break-words text-xs font-normal text-muted-foreground">{item.texto}</span></span>
            </Button>
          ))}
        </div>
        <div className="border-t border-border p-3"><Button variant="outline" size="sm" className="w-full" onClick={go}>{vendedor ? "Ver meus retornos" : oficina ? "Abrir Pátio & O.S." : "Abrir Controle O.S."}</Button></div>
      </PopoverContent>
    </Popover>
  );
}