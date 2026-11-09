import { describe, it, expect } from "vitest";
import { resumoLoja, viloes, diasDesde, type DeptoCalc } from "./simulado";
const d = (o: Partial<DeptoCalc>): DeptoCalc => ({ depto: "SG", venda: 0, lbr: 0, grupos: [], despBase: 0, despAjustada: 0, loOrcado: 0, loAjustado: 0, margemLb: 0, breakEven: 0, mesesMedia: [], ...o });
describe("cockpit do simulado", () => {
  it("ponto de equilíbrio = despesa ajustada ÷ margem bruta", () => {
    const r = resumoLoja([d({ venda: 1000, lbr: 400, despBase: 300, despAjustada: 500 })]);
    expect(r.breakEven).toBe(1250);
    expect(r.lo).toBe(-100);
    expect(r.estouro).toBe(200);
  });
  it("vilão é a conta com maior estouro sobre o simulado", () => {
    const v = viloes([d({ grupos: [
      { grupo: "pessoal", base: 100, origemBase: "simulado", media5: 150, gnc: 0, ajustado: 150, origem: "media5", fixo: true },
      { grupo: "pessoal", base: 100, origemBase: "simulado", media5: 0, gnc: 400, ajustado: 400, origem: "gnc", fixo: true },
    ] as DeptoCalc["grupos"] })]);
    expect(v[0]!.excesso).toBe(300);
  });
  it("conta dias desde a atualização", () => {
    expect(diasDesde("2026-11-01T00:00:00Z", new Date("2026-11-09T01:00:00Z"))).toBe(8);
  });
});
