import { describe, expect, it } from "vitest";
import { PERFIS, calcularComissao, dsrComissao, dsrDoMes, escada, fatorNps, perfilTecnico, promotoresFaltando } from "./comissoes";

describe("comissões", () => {
  it("DSR de novembro/2026 = 7 repousos ÷ 23 dias (domingos + 2/11, 15/11 sáb? não, 20/11)", () => {
    // Nov/2026: 5 domingos + feriados 02/11 (seg) e 20/11 (sex); 15/11 cai no domingo.
    expect(dsrDoMes("2026-11")).toBeCloseTo(7 / 23, 6);
  });
  it("comissão de outubro usa o DSR de novembro", () => {
    expect(dsrComissao("2026-10")).toBeCloseTo(dsrDoMes("2026-11"), 6);
    expect(dsrComissao("2026-12")).toBeCloseTo(dsrDoMes("2027-01"), 6);
  });
  it("Geovana: 3% fixo sobre a venda (ficha 152.451,63 → 4.573,55), sem escalonamento", () => {
    const e = calcularComissao(PERFIS["GEOVANA.M"]!, { volume: 152451.63, margemPct: 0.25, ticket: 3850 }, 0.1923);
    expect(e.comissao).toBeCloseTo(4573.55, 2);
    expect(e.premiosBrutos).toBe(0);
    const alto = calcularComissao(PERFIS["GEOVANA.M"]!, { volume: 300000 }, 0);
    expect(alto.comissao).toBeCloseTo(9000, 2);
  });
  it("Geovana: degraus de ticket, margem e volume pagam 100–400", () => {
    const e = calcularComissao(PERFIS["GEOVANA.M"]!, { volume: 224400, margemPct: 0.36, ticket: 7986 }, 0);
    expect(e.premios.map((p) => p.valor)).toEqual([400, 300, 200]);
  });
  it("Marcela: 2,5% sobre tudo que faturar e sem premiação", () => {
    const e = calcularComissao(PERFIS["MARCELA.S"]!, { volume: 40000 }, 0);
    expect(e.comissao).toBe(1000);
    expect(e.premios).toHaveLength(0);
  });
  it("Delmir: fixo 7.000 + 3 × 500, sem DSR; máximo 8.500", () => {
    const e = calcularComissao(PERFIS["DELMIR"]!, { metaOficinaOk: true, npsBmw: 0.9 }, 0.2, { videos: true });
    expect(e.total).toBe(8500);
    expect(e.dsr).toBe(0);
    expect(calcularComissao(PERFIS["DELMIR"]!, { metaOficinaOk: false, npsBmw: 0.8 }, 0.2, { videos: false }).total).toBe(7000);
  });
  it("NPS punitivo: carro 50% BMW + 50% MINI; moto 100% Motorrad 88%", () => {
    expect(fatorNps("carro", 0.9, 0.9)).toBe(1);
    expect(fatorNps("carro", 0.9, 0.8)).toBe(0.5);
    expect(fatorNps("carro", 0.8, 0.8)).toBe(0);
    expect(fatorNps("moto", 0.87)).toBe(0);
    expect(fatorNps("moto", 0.88)).toBe(1);
  });
  it("corte do NPS só atinge premiações; comissão e DSR ficam", () => {
    const e = calcularComissao(PERFIS["ANDRESSA.O"]!, { mo: 50000, pecas: 100000, margemPct: 0.36, npsBmw: 0.9, npsMini: 0.5 }, 0.2, { pac: true });
    expect(e.comissao).toBeCloseTo(1500, 2);
    expect(e.dsr).toBeCloseTo(300, 2);
    expect(e.premiosValidos).toBeCloseTo(e.premiosBrutos * 0.5, 2);
  });
  it("técnico: 10% M.O. + escada de peças; Victor 1.600 + 6%", () => {
    expect(calcularComissao(perfilTecnico("Flavio Pinheiro", "carro"), { mo: 50000, pecas: 253000 }, 0).total).toBe(5300);
    expect(calcularComissao(perfilTecnico("Victor Filipe Silva Rocha", "carro"), { mo: 10000, pecas: 0 }, 0).total).toBe(2200);
  });
  it("escada informa quanto falta para o próximo degrau", () => {
    expect(escada(200000, [[204000, 100], [224400, 200]]).falta).toBe(4000);
  });
  it("promotores faltando para 85%", () => {
    expect(promotoresFaltando(10, 7, 0.85)).toBe(10);
    expect(promotoresFaltando(10, 9, 0.85)).toBe(0);
  });
});
