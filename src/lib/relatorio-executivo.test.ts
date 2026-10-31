import { describe, expect, it } from "vitest";
import { analisar, nomeArquivo, type EntradaRel } from "./relatorio-executivo";

const base: EntradaRel = {
  mes: "2026-10", geradoEm: new Date(), filtro: "Todos", modo: "acompanhamento", dec: 10, tot: 20, base: "uteis",
  t: { s: 100000, p: 200000, ms: 300000, mp: 300000, os: 0, op: 0 }, ant: null, diaCorte: 10,
  consultores: [{ nome: "ANA", dept: "SG", s: 10, p: 10, mS: 100, mP: 100, perf: 0.1, projPct: 0.2 }], depts: [], pass: 0,
  mec: { s: 0, p: 0, ms: 0, mp: 0, pass: 0 }, os: { abertas: 0, parados: 0, amarelos: 0, mediaDias: 0, fluxo: [] },
  nps: null, npsItens: [], agg: [], agenda: null, retornos: null,
};

describe("relatório executivo", () => {
  it("nomeia o arquivo com AAAAMM", () => expect(nomeArquivo("2026-10")).toBe("Relatorio_Executivo_Pos_Venda_BMW_202610.pdf"));
  it("projeta pelo ritmo de dias", () => expect(analisar(base).pT).toBe(600000));
  it("consultor abaixo de 85% gera ação de prioridade alta", () => expect(analisar(base).acoes.some((a) => a.prioridade === "Alta" && a.acao.includes("ANA"))).toBe(true));
  it("sinaliza indicadores sem dados em vez de inventar", () => expect(analisar(base).indisp.some((x) => x.startsWith("NPS"))).toBe(true));
});
