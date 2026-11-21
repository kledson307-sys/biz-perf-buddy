import type { OsItem } from "@/lib/os-controle";

/** Item exibido: pode representar várias O.S. do mesmo veículo aguardando peças. */
export type OsGrupo = OsItem & { ns: string[] };

const chave = (i: OsItem) => i.placa.replace(/[^A-Z0-9]/gi, "").toUpperCase();

/** Une O.S. do mesmo veículo enquanto TODAS estão em "Aguardando peças"; nos demais status ficam separadas. */
export function unificarPecas(itens: OsItem[]): OsGrupo[] {
  const out: OsGrupo[] = []; const idx = new Map<string, number>();
  for (const i of itens) {
    const k = chave(i);
    if (i.st !== "pecas" || k.length < 5) { out.push({ ...i, ns: [i.n] }); continue; }
    const j = idx.get(k);
    if (j === undefined) { idx.set(k, out.length); out.push({ ...i, ns: [i.n] }); continue; }
    const g = out[j]!;
    out[j] = { ...g, ns: [...g.ns, i.n], n: [...g.ns, i.n].join(" / "), pec: g.pec + i.pec, serv: g.serv + i.serv, valor: g.valor + i.valor,
      dias: Math.max(g.dias, i.dias), desde: g.desde < i.desde ? g.desde : i.desde, obs: [g.obs, i.obs].filter(Boolean).join(" | ") };
  }
  return out;
}

export const SEM_PREV_KEY = "__semprev";
export const SEM_PREV_DIAS = 10;
export type SemPrev = { at: string; por: string };

/** "Sem previsão": só pode ser marcado uma vez por O.S. e vale 10 dias; depois a data é obrigatória. */
export function semPrevisao(acoes: Record<string, unknown> | undefined, hojeIso: string): { usado: boolean; ativo: boolean; restam: number } {
  const s = acoes?.[SEM_PREV_KEY] as SemPrev | undefined;
  if (!s?.at) return { usado: false, ativo: false, restam: 0 };
  const dias = Math.floor((Date.parse(hojeIso) - Date.parse(s.at.slice(0, 10))) / 864e5);
  const restam = SEM_PREV_DIAS - dias;
  return { usado: true, ativo: restam > 0, restam: Math.max(0, restam) };
}

/** Validação de retorno pelo Chefe de Oficina, gravada em os_acompanhamento com os_n = "ret:<os>". */
export const RET_KEY = "__retorno";
export type DecisaoRetorno = "sim" | "nao";
export const retChave = (os: string) => `ret:${os}`;

/** Peça recebida pelo setor de peças nas últimas `horas` (lê o status manual gravado em acoes.__status). */
export function pecaRecebidaRecente(acoes: Record<string, unknown> | undefined, agoraMs: number, horas = 48): string | null {
  const st = acoes?.["__status"] as { st?: string; nota?: string; at?: string } | undefined;
  if (!st?.at || st.st !== "servico" || !/pe[çc]a recebida/i.test(st.nota ?? "")) return null;
  return agoraMs - Date.parse(st.at) <= horas * 36e5 ? st.at : null;
}
