import { describe, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));
import { readFileSync, existsSync } from "node:fs";
import { lerAgendamento, classificar, ehAgendamento, tipoAgenda, salvarAgendamento, type AgendReport } from "./agendamento";
import { AJUSTE_MANUAL } from "./agenda-atribuicao";
import { contar } from "./agendamentos-data";

describe("agendamento", () => {
  it("classifica recall, diagnóstico e revisão pela descrição", () => {
    expect(classificar("CAMPANHA ATUALIZAÇÃO DE SOFTWARE")).toBe("recall");
    expect(classificar("ALEGAÇÕES: BARULHO NA SUSPENSÃO")).toBe("diagnostico");
    expect(classificar("ALEGAÇÕES:NÃO POSSUI\nBSI: NÃO\nTROCA DE ÓLEO")).toBe("revisao");
  });
  it("agenda de amanhã é D+1 mesmo impressa com a mesma data", () => {
    expect(tipoAgenda("2026-11-13", "2026-11-13", "2026-11-12")).toBe("d1");
    expect(tipoAgenda("2026-11-12", "2026-11-12", "2026-11-12")).toBe("d0");
    expect(tipoAgenda("2026-11-13", "2026-11-12", "2026-11-13")).toBe("d1");
  });
  it("não reconhece planilha qualquer", () => { expect(ehAgendamento([["Nome", "Valor"]])).toBe(false); });
  const f = (n: string) => `/tmp/${n}.json`;
  it.skipIf(!existsSync(f("agendamento_d_1")))("identifica D+1 e D0 pelo conteúdo", () => {
    const d1 = lerAgendamento(JSON.parse(readFileSync(f("agendamento_d_1"), "utf8")))!;
    const d0 = lerAgendamento(JSON.parse(readFileSync(f("agendamento_do_dia"), "utf8")))!;
    expect(d1.tipo).toBe("d1"); expect(d1.data).toBe("2026-10-31");
    expect(d0.tipo).toBe("d0"); expect(d0.data).toBe("2026-10-30");
    console.log(d1.itens.length, d0.itens.length, d1.itens.map((i) => i.categoria + "/" + i.segmento).join(","));
  });

  it("preserva consultor e horário manuais ao reimportar o mesmo dia", async () => {
    const inseridos = vi.fn().mockResolvedValue({ error: null });
    mocks.from.mockImplementation((tabela: string) => tabela === "agendamentos" ? {
      select: () => ({ eq: () => ({ eq: async () => ({ data: [{ placa: "ABC1D23", consultor: "ANDRESSA.O", hora: "08:30", importado_por: AJUSTE_MANUAL }], error: null }) }) }),
      delete: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }),
      insert: inseridos,
    } : { insert: vi.fn().mockResolvedValue({ error: null }) });
    const relatorio: AgendReport = { tipo: "d0", data: "2026-11-18", itens: [{ hora: "08:00", status: "AGENDADO", cliente: "CLIENTE", os: "", celular: "", consultor: "AGENDADOR", produto: "X1", placa: "ABC1D23", segmento: "carro", categoria: "revisao", obs: "" }] };

    await salvarAgendamento(relatorio, "agenda.xlsx", "Kledson");

    expect(inseridos).toHaveBeenCalledWith([expect.objectContaining({ placa: "ABC1D23", consultor: "ANDRESSA.O", hora: "08:30", importado_por: AJUSTE_MANUAL })]);
  });

  it("separa carros e motos em cada categoria", () => {
    const linha = (segmento: "carro" | "moto", categoria: "revisao" | "diagnostico" | "recall") =>
      ({ segmento, categoria }) as never;
    const c = contar([
      linha("carro", "revisao"), linha("carro", "revisao"), linha("moto", "revisao"),
      linha("carro", "diagnostico"), linha("moto", "recall"),
    ] as never);
    expect(c.carro).toBe(3);
    expect(c.moto).toBe(2);
    expect(c.porCat.revisao).toEqual({ carro: 2, moto: 1 });
    expect(c.porCat.diagnostico).toEqual({ carro: 1, moto: 0 });
    expect(c.porCat.recall).toEqual({ carro: 0, moto: 1 });
  });
});
