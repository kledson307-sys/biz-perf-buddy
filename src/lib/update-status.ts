export type UpdateRecord = { at: string; nome: string; origem: string; mes: string | null };
export type UpdateSource = "faturamento" | "os" | "controle-os" | "mecanicos" | "agregados";
export const UPDATE_EVENT = "haus-data-updated";

export function updateSources(origem: string): UpdateSource[] {
  if (origem.startsWith("Faturamento")) return ["faturamento"];
  if (origem.startsWith("O.S. abertas")) return ["os"];
  if (origem === "Controle de O.S.") return ["controle-os"];
  if (origem.startsWith("Técnicos")) return origem === "Técnicos (grupo)" ? [] : ["mecanicos"];
  if (origem === "Passagens (importação)") return ["mecanicos", "agregados"];
  if (origem.startsWith("Agregados") || origem.startsWith("Passagens agregados")) return ["agregados"];
  return [];
}

export function sourcesForTab(tab: string): UpdateSource[] {
  if (tab === "config") return [];
  if (tab === "os") return ["faturamento", "os"];
  if (tab === "controle-os" || tab === "mecanicos" || tab === "agregados") return [tab];
  return ["faturamento"];
}

export const sourceLabels: Record<UpdateSource, string> = {
  faturamento: "Faturamento", os: "O.S. abertas", "controle-os": "Controle O.S.", mecanicos: "Técnicos", agregados: "Agregados",
};

export const localDay = (date: Date) => new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
}).format(date);

export function tabUpdateStatus(tab: string, mes: string, records: UpdateRecord[], now = new Date()) {
  const today = localDay(now);
  const historical = mes !== today.slice(0, 7);
  const sources = sourcesForTab(tab);
  const latest = sources.map((source) => {
    const record = records.filter((r) => updateSources(r.origem).includes(source)
      && (source === "controle-os" || (r.mes ?? localDay(new Date(r.at)).slice(0, 7)) === mes))
      .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0];
    const age = record ? (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${localDay(new Date(record.at))}T00:00:00Z`)) / 86400000 : Infinity;
    const stale = !historical && (source === "controle-os" ? age >= 7 : age > 0);
    return { source, record, stale };
  });
  return { latest, stale: latest.some((s) => s.stale), pending: latest.filter((s) => s.stale).map((s) => s.source) };
}