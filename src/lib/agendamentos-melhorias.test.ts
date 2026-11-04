import { describe, it, expect } from "vitest";
import { situacaoCapacidade, linkResgate } from "./agendamentos-data";
describe("agendamentos melhorias", () => {
  it("capacidade", () => {
    expect(situacaoCapacidade(8, 10)).toBe("ociosa");
    expect(situacaoCapacidade(10, 10)).toBe("ok");
    expect(situacaoCapacidade(12, 10)).toBe("saturada");
    expect(situacaoCapacidade(5, 0)).toBe("sem-meta");
  });
  it("whatsapp", () => {
    expect(linkResgate("(71) 99999-1234", "JOAO SILVA")).toMatch(/^https:\/\/wa\.me\/5571999991234\?text=Ol/);
    expect(linkResgate("", "X")).toBeNull();
  });
});

import { classificar as classificarCod } from "./agendamento";
describe("códigos de serviço no agendamento", () => {
  it("0000105/0000111 revisão, DIAG diagnóstico, MEC recall", () => {
    expect(classificarCod("0000105 REVISAO")).toBe("revisao");
    expect(classificarCod("0000111")).toBe("revisao");
    expect(classificarCod("DIAG BARULHO")).toBe("diagnostico");
    expect(classificarCod("MEC TROCA")).toBe("recall");
  });
});
