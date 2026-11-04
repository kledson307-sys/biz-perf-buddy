import { describe, expect, it } from "vitest";
import { diasUteis } from "./dias-uteis";

describe("dias úteis com sábado 0,5 e feriados", () => {
  it("novembro/2026 tem 21 dias úteis (19 cheios + 4 sábados × 0,5)", () => {
    expect(diasUteis("2026-11", 30)).toBe(21);
  });
  it("até 03/11/2026 decorreu 1 dia útil (02/11 é Finados)", () => {
    expect(diasUteis("2026-11", 3)).toBe(1);
  });
  it("sábado conta meio dia", () => {
    expect(diasUteis("2026-11", 7) - diasUteis("2026-11", 6)).toBe(0.5);
  });
});

import { casarConsultor } from "./sales-report";
describe("nome completo da DMS → login", () => {
  const logins = ["GEOVANA.M", "GILBERTO.S", "WESLEY.F", "PEDRO.B"];
  it("casa os três nomes do relatório", () => {
    expect(casarConsultor("GEOVANA DE MEDEIROS LIMA", logins)).toBe("GEOVANA.M");
    expect(casarConsultor("GILBERTO RIBEIRO SOUSA", logins)).toBe("GILBERTO.S");
    expect(casarConsultor("WESLEY DE JESUS FERREIRA", logins)).toBe("WESLEY.F");
  });
});
