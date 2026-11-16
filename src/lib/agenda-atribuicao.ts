/** Marca de agendamento ajustado à mão (consultor/horário); a sincronização preserva esses campos. */
export const AJUSTE_MANUAL = "ajuste manual";
export const CONSULTORES_AGENDA = [
  { login: "ANDRESSA.O", nome: "Andressa", icone: "🚗" },
  { login: "WESLEY.F", nome: "Wesley", icone: "🚗" },
  { login: "RENAN.O", nome: "Renan", icone: "🚗" },
  { login: "P.BENIGNO", nome: "Pedro", icone: "🏍" },
  { login: "GILBERTO.S", nome: "Gilberto", icone: "🏍" },
] as const;

type Ajuste = { placa: string; consultor: string; hora: string; importado_por: string };
/** Reaplica consultor/horário ajustados manualmente nas linhas novas da planilha (casando pela placa/chassi). */
export function preservarAjustes<T extends { placa: string; consultor: string; hora: string; importado_por: string }>(novas: T[], antigas: Ajuste[]): T[] {
  const m = new Map(antigas.filter((a) => a.importado_por === AJUSTE_MANUAL).map((a) => [a.placa, a]));
  return novas.map((n) => { const a = m.get(n.placa); return a ? { ...n, consultor: a.consultor, hora: a.hora, importado_por: AJUSTE_MANUAL } : n; });
}
