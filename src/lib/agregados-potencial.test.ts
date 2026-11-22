import { describe, expect, it } from "vitest";
import { potencialNaMesa } from "./agregados";

describe("potencialNaMesa", () => {
  it("leva quem está abaixo até a penetração média da equipe, ao preço médio", () => {
    // equipe: 30 un em 100 passagens = 30%; preço médio R$ 100
    const r = potencialNaMesa([
      { nome: "A", qtd: 25, valor: 2500, pass: 50 },
      { nome: "B", qtd: 5, valor: 500, pass: 50 },
    ]);
    expect(r.porConsultor).toEqual([{ nome: "B", un: 10, valor: 1000, zerado: false }]);
    expect(r.valor).toBe(1000);
  });
  it("marca consultor zerado e ignora quem não teve passagem", () => {
    const r = potencialNaMesa([
      { nome: "A", qtd: 10, valor: 1000, pass: 20 },
      { nome: "B", qtd: 0, valor: 0, pass: 20 },
      { nome: "C", qtd: 0, valor: 0, pass: 0 },
    ]);
    expect(r.porConsultor.map((x) => [x.nome, x.un, x.zerado])).toEqual([["B", 5, true]]);
  });
});
