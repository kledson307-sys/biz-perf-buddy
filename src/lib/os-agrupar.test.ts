import { describe, expect, it } from "vitest";
import { unificarPecas, semPrevisao, filtrarUnificados } from "./os-agrupar";
import type { OsItem } from "./os-controle";
const os = (n: string, placa: string, st: OsItem["st"]): OsItem => ({ n, placa, st, cons: "A", cli: "C", mod: "X1", emi: "", pec: 100, serv: 50, valor: 150, dias: 3, obs: "", desde: "2026-11-01" });
describe("unificarPecas", () => {
  it("une O.S. do mesmo veículo aguardando peças", () => {
    const r = unificarPecas([os("1", "ABC1D23", "pecas"), os("2", "abc-1d23", "pecas")]);
    expect(r).toHaveLength(1); expect(r[0]!.n).toBe("1 / 2"); expect(r[0]!.pec).toBe(200);
  });
  it("separa quando uma muda de status", () => {
    expect(unificarPecas([os("1", "ABC1D23", "pecas"), os("2", "ABC1D23", "servico")])).toHaveLength(2);
  });
});
describe("filtros das O.S. unificadas", () => {
  const grupos = new Map([["100", ["100", "200"]], ["200", ["100", "200"]]]);
  it("encontra o grupo pela segunda O.S.", () => {
    const r = filtrarUnificados([{ item: os("100", "ABC1D23", "pecas") }, { item: os("200", "ABC1D23", "pecas") }], grupos, a => a.item.n.includes("200"));
    expect(r.map(a => a.item.n)).toEqual(["200"]);
  });
  it("mantém o grupo quando só a O.S. mais antiga passa no filtro de dias", () => {
    const recente = { ...os("100", "ABC1D23", "pecas"), dias: 10 };
    const antiga = { ...os("200", "ABC1D23", "pecas"), dias: 31 };
    const r = filtrarUnificados([{ item: recente }, { item: antiga }], grupos, a => a.item.dias > 30);
    expect(r.map(a => a.item.n)).toEqual(["200"]);
  });
  it("usa a O.S. do consultor filtrado sem duplicar o grupo", () => {
    const andressa = { ...os("100", "ABC1D23", "pecas"), cons: "ANDRESSA.O" };
    const pedro = { ...os("200", "ABC1D23", "pecas"), cons: "P.BENIGNO" };
    const r = filtrarUnificados([{ item: andressa }, { item: pedro }], grupos, a => a.item.cons === "P.BENIGNO");
    expect(r.map(a => a.item.n)).toEqual(["200"]);
  });
});
describe("semPrevisao", () => {
  it("vale 10 dias e depois exige data", () => {
    expect(semPrevisao({ __semprev: { at: "2026-11-01T10:00:00Z", por: "x" } }, "2026-11-10").ativo).toBe(true);
    expect(semPrevisao({ __semprev: { at: "2026-11-01T10:00:00Z", por: "x" } }, "2026-11-11")).toMatchObject({ usado: true, ativo: false });
  });
});

import { pecaRecebidaRecente } from "./os-agrupar";
describe("aviso de peça recebida", () => {
  const at = "2026-11-20T12:00:00Z";
  const acoes = { __status: { st: "servico", nota: "Peça recebida pelo setor de peças", at } };
  it("avisa dentro de 48h", () => expect(pecaRecebidaRecente(acoes, Date.parse("2026-11-21T12:00:00Z"))).toBe(at));
  it("some depois de 48h", () => expect(pecaRecebidaRecente(acoes, Date.parse("2026-11-23T12:00:00Z"))).toBeNull());
});
