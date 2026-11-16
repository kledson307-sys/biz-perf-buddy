/** Status do agendamento no quadro do consultor (derivado do texto da planilha + horário). */
export type StatusAgenda = "compareceu" | "em-atendimento" | "atrasado" | "confirmado" | "aguardando" | "cancelado";

/** "atrasado" = dia de hoje, horário já passou há mais de 15 min e sem entrada registrada. */
export function statusAgenda(status: string, data: string, hora: string, hoje: string, agoraMin: number): StatusAgenda {
  const s = status.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  if (/CANCEL|DESMARC|NAO COMPAR|FALTOU|NO.?SHOW/.test(s)) return "cancelado";
  if (/EFETIVAD|ENCERRAD|FINALIZAD|COMPARECEU|CHEGOU|ENTREGUE|FATURAD/.test(s)) return "compareceu";
  if (/ANDAMENTO|EM SERVICO|ATENDIMENTO|ABERT/.test(s)) return "em-atendimento";
  const m = hora.match(/(\d{1,2}):(\d{2})/);
  const min = m ? Number(m[1]) * 60 + Number(m[2]) : -1;
  if (data < hoje || (data === hoje && min >= 0 && agoraMin > min + 15)) return "atrasado";
  if (/CONFIRM/.test(s)) return "confirmado";
  return "aguardando";
}

/** Índice da coluna de meia hora (07:30 = 0 … 18:00 = 21); fora da faixa vai para a ponta. */
export const SLOTS = Array.from({ length: 22 }, (_, i) => { const t = 450 + i * 30; return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`; });
export function slotDaHora(hora: string): number {
  const m = hora.match(/(\d{1,2}):(\d{2})/);
  if (!m) return 0;
  const i = Math.floor((Number(m[1]) * 60 + Number(m[2]) - 450) / 30);
  return Math.max(0, Math.min(SLOTS.length - 1, i));
}
