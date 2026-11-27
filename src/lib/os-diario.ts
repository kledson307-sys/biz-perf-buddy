import { ENCERRADO_KEY, ehEncerrado, ehJudicial, type OsItem } from "@/lib/os-controle";

/** Nota gravada nas baixas por ausência; só baixas com esta marca são reabertas automaticamente. */
export const NOTA_AUSENTE = "Encerrada automaticamente · não veio nas O.S. abertas";
const k = (v: string) => v.replace(/\D/g, "").replace(/^0+/, "");
type Enc = { feito?: boolean; auto?: boolean; nota?: string };

/**
 * Cruza o arquivo diário de O.S. abertas com o Controle (última importação semanal + entradas diárias anteriores).
 * - novas: O.S. do arquivo que não estão no Controle → entram como "Em serviço / Fila".
 * - encerrar: O.S. ativas do Controle ausentes do arquivo, só quando o tipo dela é coberto pelo arquivo
 *   (sem tipo conhecido, só se o arquivo for amplo) e nunca casos judiciais.
 * - reabrir: O.S. baixadas por ausência que voltaram a aparecer.
 * Proteção: se menos da metade das O.S. ativas aparece no arquivo, nada é encerrado (arquivo parcial).
 */
export function cruzarOsDiario(controle: OsItem[], arquivo: OsItem[], acoes: Record<string, unknown>, hojeISO: string) {
  const noArquivo = new Set(arquivo.map((i) => k(i.n)));
  const noControle = new Set(controle.map((i) => k(i.n)));
  const tipos = new Set(arquivo.map((i) => i.tipo).filter(Boolean) as string[]);
  const amplo = tipos.size >= 8;
  const novas: OsItem[] = arquivo.filter((i) => !noControle.has(k(i.n))).map((i) => ({ ...i, st: "servico", desde: hojeISO }));
  const ativas = controle.filter((i) => !ehEncerrado(acoes[i.n]) && !ehJudicial(acoes[i.n]) && i.st !== "judicial");
  const presentes = ativas.filter((i) => noArquivo.has(k(i.n))).length;
  const parcial = ativas.length > 0 && presentes < ativas.length / 2;
  const encerrar = parcial ? [] : ativas.filter((i) => !noArquivo.has(k(i.n)) && (i.tipo ? tipos.has(i.tipo) : amplo)).map((i) => i.n);
  const reabrir = controle.filter((i) => {
    const e = (acoes[i.n] as Record<string, Enc> | undefined)?.[ENCERRADO_KEY];
    return noArquivo.has(k(i.n)) && e?.feito && e.auto && e.nota === NOTA_AUSENTE;
  }).map((i) => i.n);
  return { novas, encerrar, reabrir, parcial };
}

/** Une as O.S. diárias à importação semanal sem duplicar: a semanal sempre prevalece. */
export function comDiarias(semanal: OsItem[], diarias: OsItem[]): OsItem[] {
  const tem = new Set(semanal.map((i) => k(i.n)));
  return [...semanal, ...diarias.filter((i) => !tem.has(k(i.n)))];
}
