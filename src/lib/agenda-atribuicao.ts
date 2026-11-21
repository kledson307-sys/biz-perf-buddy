/** Marca de agendamento ajustado à mão (consultor/horário); a sincronização preserva esses campos. */
export const AJUSTE_MANUAL = "ajuste manual";
export const CONSULTORES_AGENDA = [
  { login: "ANDRESSA.O", nome: "Andressa", icone: "🚗" },
  { login: "WESLEY.F", nome: "Wesley", icone: "🚗" },
  { login: "RENAN.O", nome: "Renan", icone: "🚗" },
  { login: "P.BENIGNO", nome: "Pedro", icone: "🏍" },
  { login: "GILBERTO.S", nome: "Gilberto", icone: "🏍" },
] as const;

type Ajuste = { placa: string; consultor: string; hora: string; importado_por: string; status?: string };
/** Status marcados à mão no quadro (check-in); a sincronização mantém. */
export const STATUS_MANUAL = ["COMPARECEU", "EM ATENDIMENTO", "FALTOU"] as const;
/** Reaplica consultor/horário ajustados manualmente nas linhas novas da planilha (casando pela placa/chassi). */
export function preservarAjustes<T extends { placa: string; consultor: string; hora: string; importado_por: string }>(novas: T[], antigas: Ajuste[]): T[] {
  const m = new Map(antigas.filter((a) => a.importado_por === AJUSTE_MANUAL).map((a) => [a.placa, a]));
  return novas.map((n) => { const a = m.get(n.placa); if (!a) return n; const st = (STATUS_MANUAL as readonly string[]).includes(a.status ?? "") && !/CANCEL|DESMARC/i.test((n as { status?: string }).status ?? "") ? { status: a.status } : {}; return { ...n, consultor: a.consultor, hora: a.hora, importado_por: AJUSTE_MANUAL, ...st }; });
}

/** Link wa.me de confirmação do agendamento de amanhã (envio manual). */
export function linkConfirmacao(r: { celular: string; cliente: string; data: string; hora: string; consultor: string }, nomeConsultor: string): string | null {
  let d = r.celular.replace(/\D/g, "");
  if (d.length < 10) return null;
  if (!d.startsWith("55")) d = "55" + d;
  const msg = `Olá, ${r.cliente.split(" ")[0]}! Aqui é da HAUS MOTORS Salvador. Confirmamos seu agendamento em ${r.data.split("-").reverse().join("/")} às ${r.hora}${nomeConsultor ? ` com o consultor ${nomeConsultor}` : ""}. Podemos confirmar sua presença?`;
  return `https://wa.me/${d}?text=${encodeURIComponent(msg)}`;
}
