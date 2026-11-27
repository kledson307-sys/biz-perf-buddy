import { describe, it, expect } from "vitest";
import { cruzarOsDiario, comDiarias, NOTA_AUSENTE } from "@/lib/os-diario";
import { ENCERRADO_KEY, type OsItem } from "@/lib/os-controle";

const os = (n: string, tipo: string | undefined, st: OsItem["st"] = "pecas"): OsItem => ({ n, cons: "WESLEY.F", cli: "", mod: "", placa: "", emi: "", pec: 0, serv: 0, valor: 0, dias: 1, obs: "", st, desde: "2026-11-01", ...(tipo ? { tipo } : {}) });

describe("O.S. abertas diárias no Controle", () => {
  const controle = [os("100", "C7"), os("101", "C7"), os("102", "N7"), os("103", "IN"), os("104", "C7", "judicial")];
  it("adiciona novas como Em serviço e encerra ausentes do mesmo tipo, nunca judiciais ou tipos fora do arquivo", () => {
    const r = cruzarOsDiario(controle, [os("100", "C7"), os("102", "N7"), os("200", "C7")], {}, "2026-11-26");
    expect(r.novas.map((i) => [i.n, i.st])).toEqual([["200", "servico"]]);
    expect(r.encerrar).toEqual(["101"]);
  });
  it("não encerra nada quando o arquivo traz menos da metade das O.S. ativas", () => {
    const r = cruzarOsDiario(controle, [os("100", "C7")], {}, "2026-11-26");
    expect(r.parcial).toBe(true);
    expect(r.encerrar).toEqual([]);
  });
  it("reabre só o que foi baixado por ausência e voltou", () => {
    const acoes = { "101": { [ENCERRADO_KEY]: { feito: true, auto: true, nota: NOTA_AUSENTE } }, "100": { [ENCERRADO_KEY]: { feito: true, auto: true, nota: "Faturada" } } };
    const r = cruzarOsDiario(controle, [os("100", "C7"), os("101", "C7"), os("102", "N7")], acoes, "2026-11-26");
    expect(r.reabrir).toEqual(["101"]);
  });
  it("a importação semanal prevalece sobre a diária", () => {
    expect(comDiarias([os("100", "C7")], [os("100", "C7", "servico"), os("200", "C7", "servico")]).map((i) => i.n)).toEqual(["100", "200"]);
  });
});
