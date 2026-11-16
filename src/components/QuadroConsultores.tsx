import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Box, uni } from "@/components/painel-ui";
import type { AgendRow } from "@/lib/agendamentos-data";
import { AJUSTE_MANUAL, CONSULTORES_AGENDA } from "@/lib/agenda-atribuicao";

const dBR = (iso: string) => iso.split("-").reverse().join("/");

/** Quadro do dia: um chip por agendamento, uma linha por consultor; consultor e horário ajustáveis e preservados pela sincronização. */
export function QuadroConsultores({ itens, data, onChange }: { itens: AgendRow[]; data: string; onChange: () => void }) {
  const [salvando, setSalvando] = useState("");
  const oficiais: string[] = CONSULTORES_AGENDA.map((c) => c.login);
  const salvar = async (r: AgendRow, campos: { consultor?: string; hora?: string }) => {
    setSalvando(r.id);
    const { error } = await supabase.from("agendamentos").update({ ...campos, importado_por: AJUSTE_MANUAL }).eq("id", r.id);
    setSalvando("");
    if (error) { toast.error(`Não foi possível salvar: ${error.message}`); return; }
    toast.success(`${r.cliente} · ${campos.consultor ? `atribuído a ${campos.consultor}` : `horário ${campos.hora}`}`);
    onChange();
  };
  const linhas = [{ login: "", nome: "Não atribuídos", icone: "⏳" }, ...CONSULTORES_AGENDA];
  const chip = (r: AgendRow) => (
    <div key={r.id} className={`flex flex-wrap items-center gap-1 rounded-lg border px-2 py-1 text-[11px] ${r.importado_por === AJUSTE_MANUAL ? "border-primary/60 bg-primary/10" : "border-border bg-card/70"} ${salvando === r.id ? "opacity-50" : ""}`}>
      <input type="time" defaultValue={r.hora} onBlur={(e) => { if (e.target.value && e.target.value !== r.hora) void salvar(r, { hora: e.target.value }); }} className="w-[5.2rem] rounded bg-background px-1" aria-label="Horário" />
      <span className="font-semibold">{r.cliente}</span>
      <span className="text-muted-foreground">{r.segmento === "moto" ? "🏍" : "🚗"} {r.placa} · {r.categoria}</span>
      <select value={oficiais.includes(r.consultor) ? r.consultor : ""} onChange={(e) => void salvar(r, { consultor: e.target.value })} className="rounded bg-background px-1" aria-label="Consultor">
        <option value="">{oficiais.includes(r.consultor) ? "— pendente" : `Agendador: ${r.consultor || "—"}`}</option>
        {CONSULTORES_AGENDA.map((c) => <option key={c.login} value={c.login}>{c.nome}</option>)}
      </select>
    </div>
  );
  return (
    <Box title={`Agendamentos do dia · ${data ? dBR(data) : "—"} (${uni(itens.length)})`} right={<p className="text-xs text-muted-foreground">Atribuições e horários ajustados ficam salvos mesmo após a sincronização</p>} fit="xl:max-h-[46vh]">
      <div className="space-y-2 p-3">
        {linhas.map((l) => {
          const doConsultor = itens.filter((r) => (l.login ? r.consultor === l.login : !oficiais.includes(r.consultor))).sort((a, b) => a.hora.localeCompare(b.hora));
          if (!l.login && !doConsultor.length) return null;
          return (
            <div key={l.nome} className={`rounded-lg p-2 ${l.login ? "bg-background/60" : "bg-warning/15"}`}>
              <p className="mb-1 text-xs font-semibold">{l.icone} {l.nome} · {uni(doConsultor.length)}</p>
              <div className="flex flex-wrap gap-1">{doConsultor.length ? doConsultor.map(chip) : <span className="text-[11px] text-muted-foreground">Sem agendamentos</span>}</div>
            </div>
          );
        })}
      </div>
    </Box>
  );
}
