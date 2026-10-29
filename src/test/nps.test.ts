import { describe, it, expect } from "vitest";
import { classe, resumir, META_PROMOTOR, ehPJ, acaoReversao, type NpsItem } from "@/lib/nps";
import { classificarConsultor } from "@/lib/mecanicos";

const it_ = (nota: number | null, extra: Partial<NpsItem> = {}): NpsItem => ({
  loja: "SALVADOR", loja_padrao: "1", cliente: "JOAO SILVA", chassi: Math.random().toString(), consultor: "X", fechamento: "", recebimento: "",
  nota, status: "", telefone: "", obs: "", rac: false, motivo: "", veiculo: "", segmento: "carro", pj: false, ...extra,
});

describe("NPS BMW", () => {
  it("1-6 detrator, 7-8 neutro, 9-10 promotor", () => {
    expect(classe(6)).toBe("detrator"); expect(classe(7)).toBe("neutro"); expect(classe(8)).toBe("neutro"); expect(classe(9)).toBe("promotor");
  });
  it("metas mínimas de promotor: carro 85%, moto 88%", () => {
    expect(META_PROMOTOR.carro).toBe(0.85); expect(META_PROMOTOR.moto).toBe(0.88);
  });
  it("CNPJ fica fora da base do NPS", () => {
    const r = resumir([it_(10), it_(3, { pj: true })]);
    expect(r.avaliados).toBe(1); expect(r.det).toBe(0);
  });
  it("reconhece empresa pelo nome", () => { expect(ehPJ("AUTO PECAS LTDA")).toBe(true); expect(ehPJ("MARIA SOUZA")).toBe(false); });
  it("café gera ação de encantamento", () => { expect(acaoReversao("faltou café na recepção")).toMatch(/café/); });
});

describe("mix de passagens por consultor", () => {
  it("Carro: BSI, revisão C7 por código, garantia C4/MG, reparo C7 sem revisão", () => {
    const m = classificarConsultor([
      { os: "1", tipo: "BS", cod: "" }, { os: "2", tipo: "C7", cod: "0000105" }, { os: "2", tipo: "C7", cod: "999" },
      { os: "3", tipo: "C7", cod: "123" }, { os: "4", tipo: "MG", cod: "" },
    ], false);
    expect([m.bsi.length, m.rev.length, m.gar.length, m.rep.length]).toEqual([1, 1, 1, 1]);
  });
  it("Moto: sem BSI, revisão 0000111/0000119, garantia NG, reparo N7/N5/NF sem revisão", () => {
    const m = classificarConsultor([
      { os: "1", tipo: "N7", cod: "0000111" }, { os: "2", tipo: "N5", cod: "0000119" }, { os: "3", tipo: "NF", cod: "x" },
      { os: "4", tipo: "NG", cod: "" }, { os: "5", tipo: "BS", cod: "" },
    ], true);
    expect([m.bsi.length, m.rev.length, m.gar.length, m.rep.length]).toEqual([0, 2, 1, 1]);
  });
});
