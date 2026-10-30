import { describe, expect, it } from "vitest";
import { isoDia, osDasPassagens, pecasPorDia, retornosPorChassi, servicosPorDia } from "@/lib/diario-retorno";

const H = ["ID O.S.", "Consultor", "Produtivo", "TMO Ref.", "Tipo", "Chassi", "Placa", "Cliente", "Modelo", "Encerrada", "Serv. Líquido"];
const row = (os: string, tipo: string, data: string, prod: string, tmo = "X", sv = 100) => [os, "ANDRESSA", prod, tmo, tipo, "WBA123456", "ABC1D23", "CLI", "X3", data, sv];

describe("faturamento por data real e retorno por chassi", () => {
  it("converte data dd/mm/aaaa", () => expect(isoDia("16/10/2026 14:32:19")).toBe("2026-10-16"));
  it("peças somam por dia da venda e ignoram O.S. interna", () => {
    const raw = [["Cód. Item", "Preço Final", "Venda", "Tipo Os"], ["A", 100, "16/10/2026", "C7"], ["B", 50, "16/10/2026", "IO"], ["C", 30, "17/10/2026", "C7"]];
    expect(pecasPorDia(raw, "2026-10")).toEqual({ "2026-10-16": { p: 100 }, "2026-10-17": { p: 30 } });
  });
  it("serviço conta uma vez por O.S.", () => {
    const oss = osDasPassagens([H, row("1", "C7", "10/10/2026", "JOAO"), row("1", "C7", "10/10/2026", "JOAO")]);
    expect(servicosPorDia(oss, "2026-10")).toEqual({ "2026-10-10": { s: 100 } });
  });
  it("reparo em até 60 dias no mesmo chassi é retorno do técnico anterior", () => {
    const r = retornosPorChassi(osDasPassagens([H, row("1", "C7", "01/10/2026", "JOAO"), row("2", "C4", "20/10/2026", "PAULO")]));
    expect(r).toHaveLength(1); expect(r[0]).toMatchObject({ os: "2", osAnterior: "1", dias: 19, tecnicoAnterior: "JOAO" });
  });
  it("revisão e prazo acima de 60 dias não são retorno", () => {
    expect(retornosPorChassi(osDasPassagens([H, row("1", "C7", "01/08/2026", "JOAO"), row("2", "C7", "20/10/2026", "JOAO")]))).toHaveLength(0);
    expect(retornosPorChassi(osDasPassagens([H, row("1", "C7", "01/10/2026", "JOAO"), row("2", "BS", "05/10/2026", "JOAO")]))).toHaveLength(0);
  });
});
