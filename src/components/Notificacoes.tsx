import { useCallback, useEffect, useState } from "react";
import { Bell, CheckCheck, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { fmt, hoje, retornoDevido, type OsItem } from "@/lib/os-controle";

export const NOTIFICATIONS_EVENT = "os-notifications-updated";
type Retorno = { id: string; os_n: string; consultor: string; data_ref: string; nota: string; visto: boolean };
type Notification = { id: string; titulo: string; texto: string; feito: boolean };

/** Reuses existing team reads and the seller-only RPC; never broadens seller access. */
export function Notificacoes({ vendedor = false, abrir }: { vendedor?: boolean; abrir: () => void }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    try {
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
        const [snapshot, history] = await Promise.all([
          supabase.from("os_imports").select("itens").order("at", { ascending: false }).limit(1),
          supabase.from("os_retornos").select("id,os_n,consultor,data_ref,nota,visto").order("feito_at", { ascending: false }),
        ]);
        if (snapshot.error) throw snapshot.error;
        if (history.error) throw history.error;
        itens = (snapshot.data?.[0]?.itens ?? []) as unknown as OsItem[];
        retornos = history.data ?? [];
        novos = (history.data ?? []).filter(r => !r.visto);
      }
      const pendentes: Notification[] = itens.flatMap(i => {
        const due = retornoDevido(i, hoje());
        if (!due || retornos.some(r => r.os_n === i.n && r.data_ref >= due)) return [];
        return [{ id: `pendente-${i.n}`, titulo: `O.S. ${i.n} · retorno pendente`, texto: `${vendedor ? i.cli : i.cons} · ${i.st === "diag" ? "Em diagnóstico" : "Aguardando peças"} · desde ${fmt(due)}`, feito: false }];
      });
      setItems([
        ...novos.map(r => ({ id: r.id, titulo: `O.S. ${r.os_n} · retorno realizado`, texto: `${r.consultor}: ${r.nota}`, feito: true })),
        ...pendentes,
      ]);
      setError("");
    } catch {
      setError("Não foi possível carregar as notificações.");
    } finally {
      setLoading(false);
    }
  }, [vendedor]);
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
        <div className="border-b border-border px-4 py-3"><h2 className="font-semibold">Notificações {items.length > 0 && `(${items.length})`}</h2></div>
        <div className="max-h-80 overflow-y-auto" role="region" aria-label="Lista de notificações">
          {error ? <div className="space-y-2 p-4 text-sm text-destructive"><p role="alert">{error}</p><Button size="sm" variant="outline" onClick={() => void load()}>Tentar novamente</Button></div> : loading ? <p className="p-4 text-sm text-muted-foreground">Carregando…</p> : items.length === 0 ? <p className="p-4 text-sm text-muted-foreground">Nenhuma notificação pendente.</p> : items.map(item => (
            <Button key={item.id} variant="ghost" onClick={go} className="h-auto w-full justify-start gap-3 whitespace-normal rounded-none border-b border-border p-4 text-left">
              {item.feito ? <CheckCheck className="size-4 shrink-0 text-success" /> : <Clock className="size-4 shrink-0 text-destructive" />}
              <span className="min-w-0"><span className="block text-sm font-semibold">{item.titulo}</span><span className="mt-1 block break-words text-xs font-normal text-muted-foreground">{item.texto}</span></span>
            </Button>
          ))}
        </div>
        <div className="border-t border-border p-3"><Button variant="outline" size="sm" className="w-full" onClick={go}>{vendedor ? "Ver meus retornos" : "Abrir Controle O.S."}</Button></div>
      </PopoverContent>
    </Popover>
  );
}