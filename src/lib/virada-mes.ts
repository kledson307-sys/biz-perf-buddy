/** Metas do mês anterior que ainda não existem no mês atual (nunca sobrescreve metas já lançadas). */
export function metasParaCopiar<T extends { consultant_id: string; item?: string }>(anteriores: T[], atuais: { consultant_id: string; item?: string }[]): T[] {
  const ja = new Set(atuais.map((a) => `${a.consultant_id}|${a.item ?? ""}`));
  return anteriores.filter((a) => !ja.has(`${a.consultant_id}|${a.item ?? ""}`));
}

export const mesAnterior = (mes: string) => {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(y!, m! - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
