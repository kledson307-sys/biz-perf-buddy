/** Copa TUNAP 2026 (Jul–Nov): "bateu, levou" por conversão = un. Tunap ÷ passagens de revisão. */
export const CAMPANHA_TUNAP = { de: "2026-07-01", ate: "2026-11-30" };

export type Faixa = { min: number; premio: string; valor: number };
export const FAIXAS: Record<"auto" | "moto" | "loja", Faixa[]> = {
  moto: [
    { min: 1.0, premio: "Smart TV 43\" + fone JBL", valor: 2000 },
    { min: 1.5, premio: "Lava-louça + Alexa Echo Show", valor: 3000 },
    { min: 2.0, premio: "Soundbar + TV 60\" ou PS5", valor: 4000 },
  ],
  auto: [
    { min: 1.0, premio: "Soundbar + TV 55\" ou TV 55\" + chopeira", valor: 3000 },
    { min: 1.5, premio: "Soundbar + TV 60\" ou PS5", valor: 4000 },
    { min: 1.8, premio: "iPhone 16 + fone JBL ou TV 70\"", valor: 5000 },
  ],
  loja: [
    { min: 1.0, premio: "Confraternização: aluguel da casa", valor: 10000 },
    { min: 1.5, premio: "Casa + banda", valor: 12000 },
    { min: 2.0, premio: "Casa + banda + comida + bebidas", valor: 15000 },
  ],
};

export function premioTunap(tipo: keyof typeof FAIXAS, qtd: number, pass: number) {
  const conv = pass > 0 ? qtd / pass : 0;
  const fx = FAIXAS[tipo];
  let atual: Faixa | null = null;
  for (const f of fx) if (conv >= f.min) atual = f;
  const prox = fx.find((f) => conv < f.min) ?? null;
  const faltam = prox && pass > 0 ? Math.max(Math.ceil(prox.min * pass - qtd), 0) : 0;
  return { conv, atual, prox, faltam };
}

/** Base apurada nas planilhas DMS (Faturamento de Peças grupo QUIMICOS TUNAP sem O.S. internas;
 *  revisões = O.S. distintas BSI + Revisão por data de encerramento) para meses fechados da campanha.
 *  [revisões, qtd, valor] por consultor/mês. Meses aqui SUBSTITUEM os dados importados no cartão. */
export const BASE_TUNAP: Record<string, Record<string, [number, number, number]>> = {
  "2026-07": { "ANDRESSA.O": [89, 61, 8092.74], "GILBERTO.S": [22, 66, 9540.21], "P.BENIGNO": [40, 91, 12615.56], "RENAN.O": [1, 29, 7645.89], "WESLEY.F": [84, 75, 10088.87] },
  "2026-08": { "ANDRESSA.O": [96, 82, 11322.46], "GILBERTO.S": [32, 57, 8940.47], "P.BENIGNO": [36, 102, 14820.59], "RENAN.O": [1, 28, 4824.01], "WESLEY.F": [78, 105, 14013.1] },
  "2026-09": { "ANDRESSA.O": [81, 47, 14481.71], "GILBERTO.S": [51, 96, 28042.44], "P.BENIGNO": [14, 39, 10110.94], "RENAN.O": [0, 7, 2183.86], "WESLEY.F": [85, 59, 13052.02] },
  "2026-10": { "ANDRESSA.O": [86, 59, 10666.26], "GILBERTO.S": [24, 44, 13025.2], "P.BENIGNO": [19, 72, 17958.44], "RENAN.O": [0, 15, 1313.85], "WESLEY.F": [75, 66, 14287.33] },
};

/** Meses (AAAA-MM) inteiramente dentro de [de, ate]. */
export function mesesCheios(de: string, ate: string): string[] {
  const out: string[] = [];
  let [y, m] = de.slice(0, 7).split("-").map(Number) as [number, number];
  for (;;) {
    const k = `${y}-${String(m).padStart(2, "0")}`;
    if (k > ate.slice(0, 7)) break;
    const fim = `${k}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
    if (de <= `${k}-01` && ate >= fim) out.push(k);
    m++; if (m > 12) { m = 1; y++; }
  }
  return out;
}
