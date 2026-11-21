import { describe, it, expect } from "vitest";
import { preservarAjustes, AJUSTE_MANUAL } from "./agenda-atribuicao";
describe("preservarAjustes", () => {
  it("mantém consultor e horário ajustados após nova sincronização", () => {
    const r = preservarAjustes([{ placa: "ABC1", consultor: "AGENDADOR", hora: "08:00", importado_por: "sincronização" }], [{ placa: "ABC1", consultor: "WESLEY.F", hora: "08:30", importado_por: AJUSTE_MANUAL }]);
    expect(r[0]).toMatchObject({ consultor: "WESLEY.F", hora: "08:30" });
  });
  it("não altera linhas sem ajuste manual", () => {
    const r = preservarAjustes([{ placa: "X", consultor: "AG", hora: "09:00", importado_por: "sincronização" }], [{ placa: "X", consultor: "OUTRO", hora: "10:00", importado_por: "sincronização" }]);
    expect(r[0]?.consultor).toBe("AG");
  });
});

import { linkConfirmacao, preservarAjustes as pa } from "./agenda-atribuicao";
describe("check-in e confirmação", () => {
  it("mantém status de check-in manual na sincronização", () => {
    const r = pa([{ placa: "ABC1234", consultor: "X", hora: "08:00", importado_por: "sync", status: "AGENDADO" }], [{ placa: "ABC1234", consultor: "WESLEY.F", hora: "09:00", importado_por: "ajuste manual", status: "COMPARECEU" }]);
    expect(r[0]?.status).toBe("COMPARECEU");
  });
  it("cancelamento da planilha vence o check-in", () => {
    const r = pa([{ placa: "ABC1234", consultor: "X", hora: "08:00", importado_por: "sync", status: "CANCELADO" }], [{ placa: "ABC1234", consultor: "WESLEY.F", hora: "09:00", importado_por: "ajuste manual", status: "COMPARECEU" }]);
    expect(r[0]?.status).toBe("CANCELADO");
  });
  it("gera link com DDI 55", () => expect(linkConfirmacao({ celular: "(71) 99999-0000", cliente: "João Silva", data: "2026-11-22", hora: "08:30", consultor: "WESLEY.F" }, "Wesley")).toMatch(/^https:\/\/wa\.me\/5571999990000\?text=/));
});
