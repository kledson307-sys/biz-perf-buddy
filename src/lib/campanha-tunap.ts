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
