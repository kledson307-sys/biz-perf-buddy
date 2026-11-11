import { describe, it, expect } from "vitest";
import { ehFluidoMl, litrosDe, qtdItem, type ItemPeca } from "@/lib/pecas-itens";

const item = (desc: string, qtd: number, valor: number): ItemPeca =>
  ({ cod: "x", desc, qtd, valor, margem: 0, giro: "", grupo: "", os: 0 });

describe("óleo e fluidos mostrados em litros", () => {
  it("Óleo BMW 0W30 LL01 ML: 146.200 ml vira 146,2 L", () => {
    const i = item("OLEO BMW  0W30  LL01 ML", 146200, 17826.76);
    expect(ehFluidoMl(i)).toBe(true);
    expect(litrosDe(i)).toBeCloseTo(146.2, 6);
    expect(qtdItem(i)).toBe("146,2 L");
  });
  it("Lubrificante Hypoid 500ML lançado em ml: 200 ml vira 0,20 L", () => {
    expect(qtdItem(item("LUBRIFICANTE HYPOID AXLE G3 500ML", 200, 172.8))).toBe("0,20 L");
  });
  it("Óleo Motorrad 1 LITRO é contagem de unidades: 58", () => {
    expect(qtdItem(item("OLEO MOTORRAD 5W40 ULTIMATE 1 LITRO", 58, 7155.52))).toBe("58");
  });
  it("Filtro de óleo e fluido de freio em embalagem continuam em unidades", () => {
    expect(qtdItem(item("ELEMENTO FILTRO DE OLEO", 13, 3710.41))).toBe("13");
    expect(qtdItem(item("FLUIDO FREIO DOT4 LV BAIXO VISCO 500ML", 21, 2091.39))).toBe("21");
  });
});
