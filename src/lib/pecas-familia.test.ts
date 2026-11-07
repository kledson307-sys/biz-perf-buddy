import { describe, expect, it } from "vitest";
import { curvaAbc, faixasGiro, familiaPeca } from "./pecas-itens";

describe("famílias de peças", () => {
  it("classifica pela descrição", () => {
    expect(familiaPeca({ grupo: "BMW / BMW PECAS", desc: "PASTILHA DE FREIO DIANT" })).toBe("Freios & Desgaste");
    expect(familiaPeca({ grupo: "BMW / BMW PECAS", desc: "FILTRO DE OLEO" })).toBe("Filtros & Revisão");
    expect(familiaPeca({ grupo: "QUIMICOS TUNAP", desc: "LIMPA BICO" })).toBe("Químicos (Tunap & Brazzo)");
  });
  it("faixas ABC somam 100%", () => {
    const base = { desc: "", qtd: 1, margem: 0, giro: "", grupo: "", os: 0 };
    const f = faixasGiro(curvaAbc([{ ...base, cod: "a", valor: 80 }, { ...base, cod: "b", valor: 15 }, { ...base, cod: "c", valor: 5 }]));
    expect(f.map((x) => x.itens)).toEqual([1, 1, 1]);
  });
});
