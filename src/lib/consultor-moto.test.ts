import { describe, it, expect } from "vitest";
import { consultorMoto } from "@/lib/mecanicos";
describe("consultorMoto", () => {
  it("Pedro (login P.BENIGNO) e Gilberto são Moto; Andressa é Carro", () => {
    expect(consultorMoto("P.BENIGNO")).toBe(true);
    expect(consultorMoto("GILBERTO.S")).toBe(true);
    expect(consultorMoto("ANDRESSA.O")).toBe(false);
  });
});

import { casarConsultor } from "./sales-report";
describe("casarConsultor inverso", () => {
  it("PEDRO BENIGNO SANTOS SANTANA → P.BENIGNO", () => {
    expect(casarConsultor("PEDRO BENIGNO SANTOS SANTANA", ["P.BENIGNO", "GILBERTO.S"])).toBe("P.BENIGNO");
  });
});
