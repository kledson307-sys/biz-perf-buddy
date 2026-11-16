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
