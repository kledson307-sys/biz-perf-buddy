import { describe, expect, it } from "vitest";
import { ajustar, calcularDepto, lerGnc, type EfetDepto, type SimDepto } from "./simulado";

describe("regra de ajuste do Simulado", () => {
  it("simulado abaixo da média dos 5 meses vira a média", () => {
    expect(ajustar(10000, 15000, 2000)).toEqual({ valor: 15000, origem: "media5" });
  });
  it("GNC SYS maior que simulado e média prevalece", () => {
    expect(ajustar(10000, 12000, 18000)).toEqual({ valor: 18000, origem: "gnc" });
  });
  it("simulado acima dos dois é mantido", () => {
    expect(ajustar(20000, 15000, 5000)).toEqual({ valor: 20000, origem: "base" });
  });
});

describe("cálculo por departamento", () => {
  const z = () => Array(12).fill(0) as number[];
  const efet: EfetDepto = { grupos: { pessoal: z(), terceiros: z(), ocupacao: z(), funcionamento: z(), comissoes: z(), vendas: z() }, venda: z(), lbr: z(), despTotal: z() };
  // jan..set com movimento; média de mai..set da ocupação = 30.000
  for (let k = 0; k < 9; k++) { efet.venda[k] = 100; efet.despTotal[k] = 1; efet.grupos.ocupacao[k] = k < 4 ? 99999 : 30000; }
  const sim: SimDepto = { linhas: [
    { nome: "VENDA BRUTA", orcado: 300000, simulado: 0, chave: "venda" },
    { nome: "LUCRO BRUTO + RENDAS OPER.", orcado: 150000, simulado: 0, chave: "lbr" },
    { nome: "Desp. de Ocupação", orcado: 20000, simulado: 0, chave: "ocupacao" },
  ] };
  it("usa os últimos 5 meses com movimento antes do mês (nov → mai a set)", () => {
    const d = calcularDepto("SG", sim, efet, undefined, 10);
    const oc = d.grupos.find((g) => g.grupo === "ocupacao")!;
    expect(d.mesesMedia).toEqual([4, 5, 6, 7, 8]);
    expect(oc.ajustado).toBe(30000);
    expect(d.loAjustado).toBe(120000);
  });
  it("GNC só considera os centros marcados", () => {
    const g = lerGnc([
      { "Desc. Centro": "OFICINA MOTOS", "Tipo Conta": "Funcionamento", "Saldo": 100, "Mês/Ano": "11/2026" },
      { "Desc. Centro": "VEICULOS NOVOS", "Tipo Conta": "Funcionamento", "Saldo": 999 },
      { "Desc. Centro": "PEÇAS", "Tipo Conta": "Despesas com Vendas", "Saldo": 50 },
    ])!;
    expect(g.mes).toBe("2026-11");
    expect(g.lancamentos.map((l) => [l.depto, l.grupo, l.valor])).toEqual([["SG", "funcionamento", 100], ["PC", "vendas", 50]]);
  });
});
