/** Dias úteis da loja: seg–sex = 1, sábado = 0,5 (meio turno), domingo e feriado nacional = 0. */

function pascoa(y: number) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(y, mes - 1, dia);
}

const chave = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Feriados nacionais (fixos + Sexta-feira Santa). */
export function feriadosNacionais(y: number): Set<string> {
  const fixos = ["01-01", "04-21", "05-01", "09-07", "10-12", "11-02", "11-15", "11-20", "12-25"].map((md) => `${y}-${md}`);
  const sexta = pascoa(y); sexta.setDate(sexta.getDate() - 2);
  return new Set([...fixos, chave(sexta)]);
}

/** Peso de um dia: 1, 0,5 (sábado) ou 0 (domingo/feriado). */
export function pesoDia(d: Date, feriados = feriadosNacionais(d.getFullYear())) {
  if (feriados.has(chave(d))) return 0;
  const w = d.getDay();
  return w === 0 ? 0 : w === 6 ? 0.5 : 1;
}

/** Soma dos dias úteis de "AAAA-MM" do dia 1 até o dia `ate` (inclusive). */
export function diasUteis(mes: string, ate: number) {
  const [y, m] = mes.split("-").map(Number);
  const fer = feriadosNacionais(y!);
  let n = 0;
  for (let d = 1; d <= ate; d++) n += pesoDia(new Date(y!, m! - 1, d), fer);
  return n;
}
