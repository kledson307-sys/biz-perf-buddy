import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { FONTES, LISTA_FONTES, janela, diasSemNovidade, corSaude, type Fonte, type StatusSync } from "@/lib/sync-planilhas";
import { sincronizarAgora } from "@/lib/sync-planilhas.functions";

const hm = (iso?: string) => (iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");
const COR = { verde: "border-success/50 bg-success/10 text-success", amarelo: "border-warning/50 bg-warning/10 text-warning", vermelho: "border-destructive/50 bg-destructive/10 text-destructive" } as const;

/** Selos de sincronização das planilhas online: conexão, alimentação da equipe e botão "Sincronizar agora". */
export function SyncPlanilhas({ fontes = LISTA_FONTES, compacto = false }: { fontes?: Fonte[]; compacto?: boolean }) {
  const [st, setSt] = useState<Partial<Record<Fonte, StatusSync>>>({});
  const [busy, setBusy] = useState<Fonte | null>(null);
  const sync = useServerFn(sincronizarAgora);
  const load = async () => {
    const { data } = await supabase.from("oficina_mes").select("mes,diario").in("mes", fontes.map((f) => `sync-${f}`));
    setSt(Object.fromEntries((data ?? []).map((x) => [x.mes.slice(5), x.diario as unknown as StatusSync])));
  };
  useEffect(() => { void load(); const t = setInterval(() => void load(), 120_000); return () => clearInterval(t); }, [fontes.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  const agora = async (f: Fonte) => {
    setBusy(f);
    try { const r = await sync({ data: { fonte: f } }); if (r.ok) toast.success(r.resumo ?? "Sincronizado"); else toast.error(`${FONTES[f].label}: ${r.erro}`); await load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao sincronizar"); }
    finally { setBusy(null); }
  };
  const j = janela();
  return <div className={compacto ? "flex flex-wrap gap-2" : "lux-card space-y-2 p-3"}>
    {!compacto && <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
      <b className="text-sm">Sincronização em nuvem (SharePoint)</b>
      <span className="text-muted-foreground">{j.fechamento ? "🔥 Modo fechamento: sincroniza até 23:59" : j.ativa ? "Robôs ativos (Seg–Sex 7h–20h · Sáb 7h–14h)" : "Robôs em pausa até 07:00"}</span>
    </div>}
    <div className={compacto ? "contents" : "grid gap-2 md:grid-cols-2 xl:grid-cols-4"}>
      {fontes.map((f) => {
        const s = st[f]; const dias = s?.mudouEm ? diasSemNovidade(s.mudouEm) : null; const cor = dias === null ? null : corSaude(dias);
        return <div key={f} className="flex flex-wrap items-center gap-2 rounded-lg border border-border px-2 py-1.5 text-[11px]">
          <span className="font-semibold">{FONTES[f].label}</span>
          <span className="text-muted-foreground">a cada {FONTES[f].minutos} min</span>
          <span className={s ? (s.ok ? "text-success" : "text-warning") : "text-muted-foreground"} title={s?.erro}>{s ? (s.ok ? `🟢 lida ${hm(s.at)}` : `🟠 falha ${hm(s.at)} · dados anteriores mantidos`) : "aguardando 1ª leitura"}</span>
          {cor && <span className={`rounded border px-1.5 ${COR[cor]}`} title={`Responsável: ${FONTES[f].responsavel}`}>
            {cor === "verde" ? "Alimentação em dia" : cor === "amarelo" ? "1 dia sem novos lançamentos" : `⚠️ ${dias} dias sem novos lançamentos (${FONTES[f].responsavel})`}
          </span>}
          <button type="button" disabled={busy !== null} onClick={() => void agora(f)} className="ml-auto rounded border border-primary/50 px-2 py-0.5 text-primary hover:bg-primary/10 disabled:opacity-50">{busy === f ? "Sincronizando…" : "🔄 Sincronizar agora"}</button>
        </div>;
      })}
    </div>
  </div>;
}
