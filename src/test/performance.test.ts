import { describe, expect, it } from "vitest";
import { calcPerformance } from "@/lib/performance";

describe("calcPerformance", () => {
  it("calcula realizado, meta, performance e projeção", () => {
    const r = calcPerformance(40_000, 20_000, 60_000, 40_000, 10, 20);

    expect(r.real).toBe(60_000);
    expect(r.meta).toBe(100_000);
    expect(r.perf).toBeCloseTo(0.6);
    expect(r.projS).toBe(80_000);
    expect(r.projP).toBe(40_000);
    expect(r.proj).toBe(120_000);
    expect(r.projPct).toBeCloseTo(1.2);
  });

  it("calcula a necessidade diária somente sobre os dias restantes", () => {
    const r = calcPerformance(40_000, 20_000, 60_000, 40_000, 10, 20);

    expect(r.necS).toBe(2_000);
    expect(r.necP).toBe(2_000);
    expect(r.nec).toBe(4_000);
  });

  it("não cria necessidade após o fim do período", () => {
    const r = calcPerformance(100_000, 50_000, 60_000, 40_000, 20, 20);

    expect(r.perf).toBe(1.5);
    expect(r.necS).toBe(0);
    expect(r.necP).toBe(0);
    expect(r.nec).toBe(0);
  });

  it("não quebra quando ainda não há dias decorridos ou metas", () => {
    const r = calcPerformance(0, 0, 0, 0, 0, 22);

    expect(r.proj).toBe(0);
    expect(r.perf).toBe(0);
    expect(r.projPct).toBe(0);
    expect(r.mediaDia).toBe(0);
    expect(r.nec).toBe(0);
  });

  it("mantém margem e calcula percentual sobre peças", () => {
    const r = calcPerformance(0, 10_000, 0, 20_000, 5, 20, 3_000);

    expect(r.marg).toBeCloseTo(0.3);
    expect(r.perfP).toBeCloseTo(0.5);
  });
});


describe("calcPerformance — entradas inválidas", () => {
  it("normaliza valores não finitos sem produzir NaN ou Infinity", () => {
    const r = calcPerformance(Number.NaN, Number.POSITIVE_INFINITY, 100, 100, 2, 20);
    for (const value of Object.values(r)) expect(Number.isFinite(value)).toBe(true);
    expect(r.servicos).toBe(0);
    expect(r.pecas).toBe(0);
  });

  it("trata dias negativos como zero", () => {
    const r = calcPerformance(100, 50, 200, 100, -2, -20);
    expect(r.proj).toBe(0);
    expect(r.mediaDia).toBe(0);
    expect(r.nec).toBe(0);
    for (const value of Object.values(r)) expect(Number.isFinite(value)).toBe(true);
  });
});
