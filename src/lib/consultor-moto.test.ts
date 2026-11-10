import { describe, it, expect } from "vitest";
import { consultorMoto } from "@/lib/mecanicos";
describe("consultorMoto", () => {
  it("Pedro (login P.BENIGNO) e Gilberto são Moto; Andressa é Carro", () => {
    expect(consultorMoto("P.BENIGNO")).toBe(true);
    expect(consultorMoto("GILBERTO.S")).toBe(true);
    expect(consultorMoto("ANDRESSA.O")).toBe(false);
  });
});
