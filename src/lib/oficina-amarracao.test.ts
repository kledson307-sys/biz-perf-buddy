import { describe, expect, it } from "vitest";
import { classificar, lerPassagens } from "@/lib/mecanicos";
import { osFaturadasAtivas } from "@/lib/os-controle";

const cab = ["ID O.S.", "Tipo O.S.", "Consultor", "Produtivo", "TMO Ref."];

describe("amarração e baixa automática", () => {
  it("linha sem Produtivo é atribuída ao técnico da mesma O.S.", () => {
    const r = lerPassagens([cab, ["100", "C7", "WESLEY", "", "0000200"], ["100", "C7", "WESLEY", "JONATAS MORAES", "0000300"], ["101", "C7", "WESLEY", "", "0000200"]]);
    expect(r.mecanicos).toEqual([expect.objectContaining({ nome: "JONATAS MORAES", passagens: 1 })]);
    expect(r.osIds).toEqual(["100", "101"]);
  });

  it("classifica O.S. de moto: revisão 0000111, reparo N7, garantia NG", () => {
    const c = classificar([{ os: "1", tipo: "N7", cod: "0000111." }, { os: "2", tipo: "N5", cod: "123" }, { os: "3", tipo: "NG", cod: "1" }]);
    expect([c.rev, c.pagos, c.c4]).toEqual([["1"], ["2"], ["3"]]);
  });

  it("baixa só O.S. ativas que aparecem no faturamento, ignorando zeros à esquerda", () => {
    const itens = [{ n: "000123" }, { n: "456" }, { n: "789" }];
    const acoes = { "789": { __encerrado: { feito: true } } };
    expect(osFaturadasAtivas(itens, acoes, ["123", "789", "999"])).toEqual(["000123"]);
  });
});
