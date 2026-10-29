import { describe, it, expect } from "vitest";
import { curvaAbc, lerItensPecas } from "@/lib/pecas-itens";

const H = ["Cód. Item", "Descrição", "Quantidade", "Preço Final", "Tipo Os", "O.S."];
describe("Faturamento de peças por item", () => {
  it("exclui O.S. internas (IO) e soma por código", () => {
    const l = lerItensPecas([H, ["A", "Filtro", 1, 100, "C7", "1"], ["A", "Filtro", 1, 100, "C7", "2"], ["B", "Óleo", 1, 500, "IO", "3"]]);
    expect(l).toEqual([expect.objectContaining({ cod: "A", qtd: 2, valor: 200, os: 2 })]);
  });
  it("curva ABC: A até 80% do faturamento", () => {
    const c = curvaAbc([{ cod: "x", valor: 80 }, { cod: "y", valor: 15 }, { cod: "z", valor: 5 }].map((i) => ({ desc: "", qtd: 1, margem: 0, giro: "", grupo: "", os: 0, ...i })));
    expect(c.map((i) => i.classe)).toEqual(["A", "B", "C"]);
  });
});
