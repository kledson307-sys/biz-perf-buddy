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
  it("NPS punitivo do departamento: carro 85%, moto 88%", () => {
    expect(fatorNps("carro", 0.9)).toBe(1);
    expect(fatorNps("carro", 0.8)).toBe(0);
    expect(fatorNps("moto", 0.87)).toBe(0);
    expect(fatorNps("moto", 0.88)).toBe(1);
  });
  it("corte do NPS só atinge premiações; comissão e DSR ficam", () => {
    const e = calcularComissao(PERFIS["ANDRESSA.O"]!, { mo: 50000, pecas: 100000, margemPct: 0.36, npsBmw: 0.8 }, 0.2, { pac: true });
    expect(e.comissao).toBeCloseTo(1500, 2);
    expect(e.dsr).toBeCloseTo(300, 2);
    expect(e.premiosValidos).toBe(0);
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

import { somaComplementares as soma2 } from "./comissoes";
describe("vendas de Acessórios & Estética nas comissões", () => {
  it("soma só faturado, líquido de devolução, por vendedor e departamento", () => {
    const c = soma2([
      { departamento: "ACESSORIOS", vendedor: "wesley.f", valor: 3380, devolucao: 0, status: "FATURADO" },
      { departamento: "ACESSORIOS", vendedor: "WESLEY.F", valor: 350, status: "A_FATURAR" },
      { departamento: "ESTETICA", vendedor: "WESLEY.F", valor: 1000, devolucao: 100, status: "FATURADO" },
    ]);
    expect(c.porVendedor["WESLEY.F"]).toEqual({ ACESSORIOS: 3380, ESTETICA: 900 });
    expect(c.total).toEqual({ ACESSORIOS: 3380, ESTETICA: 900 });
  });
  it("Geovana: 3% sobre R$ 151.201,63 faturados em outubro", () => {
    const e = calcularComissao(PERFIS["GEOVANA.M"]!, { volume: 151201.63 }, 0);
    expect(e.comissao).toBeCloseTo(4536.05, 2);
  });
});

describe("NPS como trava e pneus", () => {
  it("NPS não gera premiação em dinheiro para consultores", async () => {
    const { PERFIS } = await import("@/lib/comissoes");
    for (const k of ["ANDRESSA.O", "WESLEY.F", "RENAN.O", "P.BENIGNO", "GILBERTO.S"]) expect(PERFIS[k]!.premios.some((p) => p.id === "voc")).toBe(false);
  });
  it("departamento Carro abaixo de 85% zera premiações; 85% libera 100%", async () => {
    const { fatorNps } = await import("@/lib/comissoes");
    expect(fatorNps("carro", 0.84)).toBe(0); expect(fatorNps("carro", 0.85)).toBe(1);
    expect(fatorNps("moto", 0.87)).toBe(0); expect(fatorNps("moto", 0.88)).toBe(1);
  });
  it("pneus de Andressa: 50 unidades pagam R$ 400", async () => {
    const { PERFIS, calcularComissao } = await import("@/lib/comissoes");
    const e = calcularComissao(PERFIS["ANDRESSA.O"]!, { pneus: 50, npsBmw: 0.9 }, 0);
    expect(e.premios.find((p) => p.id === "pneus")!.valor).toBe(400);
    expect(calcularComissao(PERFIS["ANDRESSA.O"]!, { pneus: 49 }, 0).premios.find((p) => p.id === "pneus")!.valor).toBe(0);
  });
  it("conta pneus por vendedor no faturamento de peças", async () => {
    const { lerItensPecas, pneusPorVendedor } = await import("@/lib/pecas-itens");
    const raw = [["Cód. Item", "Descrição", "Quantidade", "Preço Final", "Vendedor", "Tipo Os"], ["P1", "PNEU 245/45 R18", "4", "4000", "ANDRESSA.O", "NC"], ["F1", "FILTRO OLEO", "1", "100", "ANDRESSA.O", "NC"], ["P1", "PNEU 245/45 R18", "2", "2000", "ANDRESSA.O", "IO"]];
    expect(pneusPorVendedor(lerItensPecas(raw))["ANDRESSA.O"]).toBe(4);
  });
});
