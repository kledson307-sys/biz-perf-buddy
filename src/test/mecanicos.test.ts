import { describe, it, expect } from "vitest";
import { classificar, lerPassagens } from "@/lib/mecanicos";

describe("passagens por categoria", () => {
  it("separa as 5 categorias e conta cada O.S. uma vez", () => {
    const c = classificar([
      { os: "1", tipo: "BS", cod: "" }, { os: "1", tipo: "BS", cod: "x" },
      { os: "2", tipo: "C7", cod: "0000105." }, { os: "2", tipo: "C7", cod: "y" },
      { os: "3", tipo: "C7", cod: "z" }, { os: "4", tipo: "MG", cod: "" },
      { os: "5", tipo: "C4", cod: "" }, { os: "6", tipo: "CF", cod: "" }, { os: "7", tipo: "MS", cod: "" },
    ]);
    expect(c.bs).toEqual(["1"]); expect(c.rev).toEqual(["2"]); expect(c.pagos).toEqual(["3"]);
    expect(c.c4.sort()).toEqual(["4", "5"]); expect(c.funilaria.sort()).toEqual(["6", "7"]);
  });
  it("ignora O.S. internas IO/IP/IU/IN/NN para técnico e consultor", () => {
    const r = lerPassagens([
      ["ID O.S.", "Consultor", "Produtivo", "TMO Ref.", "Tipo"],
      ["10", "ANDRESSA.O", "ORLANDO", "a", "C7"],
      ["11", "ANDRESSA.O", "ORLANDO", "a", "IO"],
      ["12", "ANDRESSA.O", "ORLANDO", "a", "NN"],
    ]);
    expect(r.mecanicos[0]!.passagens).toBe(1);
    expect(r.consultores[0]!.passagens).toBe(1);
  });
});

import { TIPOS_INTERNOS as TI } from "@/lib/mecanicos";
describe("O.S. internas", () => {
  it("ID também é O.S. interna", () => { expect(TI.has("ID")).toBe(true); });
});
