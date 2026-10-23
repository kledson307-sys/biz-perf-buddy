/**
 * Núcleo central de cálculos da Fase 1.
 * Dashboard, relatórios e testes devem usar as mesmas regras.
 */

export type PerformanceCalc = {
  servicos: number;
  pecas: number;
  real: number;
  mS: number;
  mP: number;
  meta: number;
  projS: number;
  projP: number;
  proj: number;
  margem: number;
  marg: number;
  perfS: number;
  perfP: number;
  perf: number;
  projPctS: number;
  projPctP: number;
  projPct: number;
  mediaDia: number;
  necS: number;
  necP: number;
  nec: number;
};

const finite = (value: number) => (Number.isFinite(value) ? value : 0);
const div = (a: number, b: number) => (b > 0 ? a / b : 0);

/**
 * Calcula o desempenho de Serviços, Peças e Total.
 * dec = dias decorridos na base selecionada (úteis ou corridos).
 * tot = total de dias da base no mês.
 * Valores não finitos e dias negativos são normalizados para evitar NaN/Infinity
 * nos indicadores e gráficos.
 */
export function calcPerformance(
  servicos: number,
  pecas: number,
  mS: number,
  mP: number,
  dec: number,
  tot: number,
  margem = 0,
): PerformanceCalc {
  servicos = finite(servicos);
  pecas = finite(pecas);
  mS = finite(mS);
  mP = finite(mP);
  margem = finite(margem);
  tot = Math.max(0, finite(tot));
  dec = Math.max(0, finite(dec));

  const real = servicos + pecas;
  const meta = mS + mP;
  const projS = div(servicos, dec) * tot;
  const projP = div(pecas, dec) * tot;
  const proj = projS + projP;
  const rest = Math.max(tot - dec, 0);

  return {
    servicos, pecas, real, mS, mP, meta, projS, projP, proj, margem,
    marg: div(margem, pecas),
    perfS: div(servicos, mS),
    perfP: div(pecas, mP),
    perf: div(real, meta),
    projPctS: div(projS, mS),
    projPctP: div(projP, mP),
    projPct: div(proj, meta),
    mediaDia: div(real, dec),
    necS: rest > 0 ? Math.max(mS - servicos, 0) / rest : 0,
    necP: rest > 0 ? Math.max(mP - pecas, 0) / rest : 0,
    nec: rest > 0 ? Math.max(meta - real, 0) / rest : 0,
  };
}
