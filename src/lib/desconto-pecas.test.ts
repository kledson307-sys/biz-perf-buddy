import { describe, it, expect } from "vitest";
import { lerItensPecas, descontoPorVendedor, toneDesconto } from "@/lib/pecas-itens";
describe("desconto de peças", () => {
  it("soma desconto por vendedor e ignora O.S. interna", () => {
    const raw = [["Cód. Item", "Descrição", "Unitário", "Quantidade", "Preço Final", "Vendedor", "Tipo Os"],
      ["A", "FILTRO", 100, 2, 180, "WESLEY.F", "NC"], ["B", "OLEO", 50, 1, 50, "WESLEY.F", "NC"], ["C", "X", 100, 1, 10, "WESLEY.F", "IO"]];
    const d = descontoPorVendedor(lerItensPecas(raw))["WESLEY.F"]!;
    expect(d.tabela).toBe(250); expect(d.desconto).toBe(20); expect(d.pct).toBeCloseTo(0.08);
  });
  it("semáforo 6% / 10%", () => {
    expect(toneDesconto(0.06)).toBe("text-success"); expect(toneDesconto(0.1)).toBe("text-warning"); expect(toneDesconto(0.11)).toBe("text-coral");
  });
});
