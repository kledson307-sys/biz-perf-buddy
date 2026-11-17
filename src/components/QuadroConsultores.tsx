import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Box, uni } from "@/components/painel-ui";
import type { AgendRow } from "@/lib/agendamentos-data";
import { hojeLocal } from "@/lib/agendamentos-data";
import { AJUSTE_MANUAL, CONSULTORES_AGENDA } from "@/lib/agenda-atribuicao";
import { SLOTS, slotDaHora, statusAgenda, type StatusAgenda } from "@/lib/agenda-status";

const dBR = (iso: string) => iso.split("-").reverse().join("/");
const TIPO = { revisao: ["Revisão", "border-l-primary"], diagnostico: ["Diagnóstico", "border-l-warning"], recall: ["Recall", "border-l-destructive"] } as const;
const ST: Record<StatusAgenda, [string, string, string]> = {
  compareceu: ["✅", "Compareceu", "bg-success/25"],
  "em-atendimento": ["🔧", "Em atendimento", "bg-primary/25"],
  atrasado: ["⏰", "Atrasado", "bg-destructive/30 animate-pulse"],
  confirmado: ["✔️", "Confirmado", "bg-card"],
  aguardando: ["⏳", "Aguardando", "bg-background"],
  cancelado: ["✖️", "Cancelado/Faltou", "bg-muted opacity-60 line-through"],
};
const ALMOCO = new Set(["12:00", "12:30"]);

/** Quadro em grade horária (estilo NBS): uma linha por consultor; não atribuídos ficam numa gaveta oculta. */
export function QuadroConsultores({ itens, data, titulo, onChange }: { itens: AgendRow[]; data: string; titulo: string; onChange: () => void }) {
  const [salvando, setSalvando] = useState("");
  const [gaveta, setGaveta] = useState(false);
  const [agora, setAgora] = useState(() => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); });
  useEffect(() => { const t = setInterval(() => { const d = new Date(); setAgora(d.getHours() * 60 + d.getMinutes()); }, 60000); return () => clearInterval(t); }, []);
  const hoje = hojeLocal();
  const oficiais: string[] = CONSULTORES_AGENDA.map((c) => c.login);
  const salvar = async (r: AgendRow, campos: { consultor?: string; hora?: string }) => {
    setSalvando(r.id);
    const { error } = await supabase.from("agendamentos").update({ ...campos, importado_por: AJUSTE_MANUAL }).eq("id", r.id);
    setSalvando("");
    if (error) { toast.error(`Não foi possível salvar: ${error.message}`); return; }
    toast.success(`${r.cliente} · ${campos.consultor ? `atribuído a ${campos.consultor}` : `horário ${campos.hora}`}`);
    onChange();
  };
  const st = (r: AgendRow) => statusAgenda(r.status, r.data, r.hora, hoje, agora);
  const pendentes = itens.filter((r) => !oficiais.includes(r.consultor)).sort((a, b) => a.hora.localeCompare(b.hora));
  const atribuidos = itens.filter((r) => oficiais.includes(r.consultor));
  const cont = (Object.keys(ST) as StatusAgenda[]).map((k) => [k, atribuidos.filter((r) => st(r) === k).length] as const);

  const seletor = (r: AgendRow) => (
    <select value={oficiais.includes(r.consultor) ? r.consultor : ""} onChange={(e) => void salvar(r, { consultor: e.target.value })} className="w-full rounded bg-background px-1 text-[10px]" aria-label="Consultor">
      <option value="">{oficiais.includes(r.consultor) ? "— remover" : `Agendador: ${r.consultor || "—"}`}</option>
      {CONSULTORES_AGENDA.map((c) => <option key={c.login} value={c.login}>{c.nome}</option>)}
    </select>
  );
  const bloco = (r: AgendRow) => {
    const s = st(r);
    return (
      <div key={r.id} title={`${r.cliente} · ${r.placa} · ${r.produto}\nStatus planilha: ${r.status || "—"}`} className={`mb-1 rounded border border-border border-l-4 ${TIPO[r.categoria][1]} ${ST[s][2]} p-1 text-[10px] leading-tight ${salvando === r.id ? "opacity-50" : ""} ${r.importado_por === AJUSTE_MANUAL ? "ring-1 ring-primary/60" : ""}`}>
        <div className="flex items-center justify-between gap-1">
          <input type="time" defaultValue={r.hora} onBlur={(e) => { if (e.target.value && e.target.value !== r.hora) void salvar(r, { hora: e.target.value }); }} className="w-[4.6rem] rounded bg-transparent font-semibold" aria-label="Horário" />
          <span>{ST[s][0]}</span>
        </div>
        <p className="truncate font-semibold">{r.cliente}</p>
        <p className="truncate text-muted-foreground">{r.segmento === "moto" ? "🏍" : "🚗"} {TIPO[r.categoria][0]} · {ST[s][1]}</p>
        {seletor(r)}
      </div>
    );
  };

  return (
    <Box title={`${titulo} · ${data ? dBR(data) : "—"} (${uni(itens.filter((r) => r.segmento !== "moto").length)} carros · ${uni(itens.filter((r) => r.segmento === "moto").length)} motos · total ${uni(itens.length)})`} right={
      <button type="button" onClick={() => setGaveta((g) => !g)} className={`rounded-md px-3 py-1 text-xs font-semibold ${pendentes.length ? "bg-warning text-background" : "bg-card text-muted-foreground"}`}>
        ⏳ Não atribuídos ({uni(pendentes.length)}) {gaveta ? "▲" : "▼"}
      </button>}>
      <div className="flex flex-wrap gap-2 px-3 pt-2 text-[11px]">
        {cont.map(([k, n]) => <span key={k} className={`rounded px-2 py-0.5 ${ST[k][2].replace("animate-pulse", "")}`}>{ST[k][0]} {ST[k][1]} · <b>{uni(n)}</b></span>)}
        <span className="ml-auto flex gap-2 text-muted-foreground">
          {Object.values(TIPO).map(([n, c]) => <span key={n} className={`border-l-4 ${c} pl-1`}>{n}</span>)}
        </span>
      </div>
      {gaveta && (
        <div className="m-3 rounded-lg bg-warning/15 p-2">
          <p className="mb-1 text-xs font-semibold">Escolha o consultor para levar o agendamento ao quadro</p>
          {pendentes.length ? <div className="grid grid-cols-2 gap-1 sm:grid-cols-4 xl:grid-cols-6">{pendentes.map(bloco)}</div> : <p className="text-[11px] text-muted-foreground">Todos os agendamentos já estão atribuídos.</p>}
        </div>
      )}
      <div className="overflow-x-auto p-3">
        <div className="grid min-w-[1400px] text-[10px]" style={{ gridTemplateColumns: `7rem repeat(${SLOTS.length}, minmax(0, 1fr))` }}>
          <div className="sticky left-0 bg-card px-1 py-1 font-semibold">Consultor</div>
          {SLOTS.map((s) => <div key={s} className={`border-l border-border px-1 py-1 text-center font-semibold ${ALMOCO.has(s) ? "bg-warning/20" : ""} ${data === hoje && slotDaHora(`${Math.floor(agora / 60)}:${String(agora % 60).padStart(2, "0")}`) === SLOTS.indexOf(s) ? "text-primary" : "text-muted-foreground"}`}>{s}</div>)}
          {CONSULTORES_AGENDA.map((c) => {
            const meus = atribuidos.filter((r) => r.consultor === c.login);
            return [
              <div key={c.login} className="sticky left-0 border-t border-border bg-card px-1 py-2 text-xs font-semibold">{c.icone} {c.nome}<p className="text-[10px] font-normal text-muted-foreground">{uni(meus.length)} agend.</p></div>,
              ...SLOTS.map((s, i) => (
                <div key={c.login + s} className={`min-h-[3.5rem] border-l border-t border-border p-0.5 ${ALMOCO.has(s) ? "bg-warning/10" : ""}`}>
                  {meus.filter((r) => slotDaHora(r.hora) === i).sort((a, b) => a.hora.localeCompare(b.hora)).map(bloco)}
                </div>
              )),
            ];
          })}
        </div>
      </div>
    </Box>
  );
}
