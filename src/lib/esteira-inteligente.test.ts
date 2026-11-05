import { describe, it, expect } from "vitest";
import { mesclarFat } from "@/lib/faturamento-historico";
import { tecnicosDoFatServicos } from "@/lib/mecanicos";

const cab = ["Consultor", "Produtivo", "ID O.S.", "Tipo", "Encerrada", "Itens Líquido", "Serv. Líquido"];

describe("Esteira inteligente", () => {
  it("O.S. Fechadas gera M.O. e peças por técnico, sem internas, e separa sem apontamento", () => {
    const r = tecnicosDoFatServicos([["O.S. Fechadas"], cab,
      ["WESLEY", "VICTOR", "1", "C7", "03/11/2026", 5355, 410],
      ["WESLEY", "VICTOR", "2", "C7", "04/11/2026", 0, 460],
      ["PEDRO", "MATHEUS FELIX", "3", "NN", "04/11/2026", 0, 230.4],
      ["RENAN", "", "4", "C5", "04/11/2026", 2905.13, 1400],
    ])!;
    expect(r.rows).toEqual([{ nome: "VICTOR", servicos: 870, pecas: 5355 }]);
    expect(r.semApontamento).toEqual({ servicos: 1400, pecas: 2905.13 });
  });

  it("importar serviços mantém as peças já gravadas do dia", () => {
    const out = mesclarFat([{ consultant_id: "w", dia: "2026-11-04", servicos: 0, pecas: 1519.42, margem_pecas: 300 }],
      [{ consultant_id: "w", dia: "2026-11-04", servicos: 1180, pecas: 0, margem_pecas: 0 }], "s");
    expect(out).toEqual([{ consultant_id: "w", dia: "2026-11-04", servicos: 1180, pecas: 1519.42, margem_pecas: 300 }]);
  });

  it("importar peças mantém os serviços e substitui as peças antigas", () => {
    const out = mesclarFat([{ consultant_id: "w", dia: "2026-11-04", servicos: 1180, pecas: 999, margem_pecas: 1 }],
      [{ consultant_id: "w", dia: "2026-11-04", servicos: 0, pecas: 1519.42, margem_pecas: 300 }], "p");
    expect(out).toEqual([{ consultant_id: "w", dia: "2026-11-04", servicos: 1180, pecas: 1519.42, margem_pecas: 300 }]);
  });
});

import { ehOsAbertas } from "@/lib/os-abertas";
describe("Reconhecimento O.S. Fechadas × Abertas", () => {
  it("O.S. Fechadas (com Tipo, Recepcionista e Encerrada) não é O.S. aberta", () => {
    expect(ehOsAbertas([["O.S. Fechadas"], ["Consultor", "Produtivo", "ID O.S.", "Tipo", "Encerrada", "Serv. Líquido", "Recepcionista"]])).toBe(false);
  });
  it("O.S. Abertas continua reconhecida", () => {
    expect(ehOsAbertas([["O.S. Abertas"], ["Número", "Tipo", "Recep.", "Serv. Líquido"]])).toBe(true);
  });
});
describe("O.S. Abertas com coluna Encerrada vazia", () => {
  it("continua reconhecida como aberta", () => {
    expect(ehOsAbertas([["Relatório"], ["Número", "Tipo", "Recep.", "Encerrada"], ["1", "C7", "X", ""]])).toBe(true);
  });
  it("com datas de encerramento é fechada", () => {
    expect(ehOsAbertas([["Relatório"], ["Número", "Tipo", "Recep.", "Encerrada"], ["1", "C7", "X", "04/11/2026"]])).toBe(false);
  });
});

import { metasParaCopiar, mesAnterior } from "@/lib/virada-mes";
describe("Virada de mês", () => {
  it("copia só metas ainda não lançadas no mês", () => {
    expect(metasParaCopiar([{ consultant_id: "a", servicos: 1 }, { consultant_id: "b", servicos: 2 }], [{ consultant_id: "a" }])).toEqual([{ consultant_id: "b", servicos: 2 }]);
  });
  it("mês anterior de janeiro é dezembro do ano anterior", () => { expect(mesAnterior("2027-01")).toBe("2026-12"); });
});
