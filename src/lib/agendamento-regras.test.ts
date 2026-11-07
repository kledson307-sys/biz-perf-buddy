import { describe, it, expect } from "vitest";
import { classificar } from "./agendamento";
import { CONS_PASSANTES } from "./agendamentos-data";

describe("classificação de agendamentos", () => {
  it("revisão por termo", () => expect(classificar("Troca de óleo")).toBe("revisao"));
  it("revisão vence outros termos", () => expect(classificar("Revisão e barulho na suspensão")).toBe("revisao"));
  it("recall por troca de peça", () => expect(classificar("Troca de peça")).toBe("recall"));
  it("recall por campanha técnica", () => expect(classificar("CAMPANHA TÉCNICA: SIM")).toBe("recall"));
  it("diagnóstico por cliente alega", () => expect(classificar("Cliente alega ruído solto")).toBe("diagnostico"));
  it("manutenção negada não vira revisão", () => expect(classificar("MANUTENÇÃO: NÃO\nALEGAÇÕES: BARULHO NA SUSPENSÃO")).toBe("diagnostico"));
  it("campanha negada não vira recall", () => expect(classificar("CAMPANHA TÉCNICA: NÃO\nCLIENTE ALEGA LUZ NO PAINEL")).toBe("diagnostico"));
  it("frase negada é ignorada", () => expect(classificar("Cliente não quer revisão, alega ruído no freio")).toBe("diagnostico"));
  it("manutenção sim é revisão", () => expect(classificar("MANUTENÇÃO: SIM\nCAMPANHA TÉCNICA: SIM")).toBe("revisao"));
  it("campanha sim sem manutenção é recall", () => expect(classificar("MANUTENÇÃO: NÃO, CAMPANHA TÉCNICA: SIM")).toBe("recall"));
  it("passantes oficiais", () => {
    for (const a of ["ANDRESSA.O", "WESLEY.F", "P.BENIGNO", "GILBERTO.S", "LUIS.S", "JADNA.S", "RENAN.O"]) expect(CONS_PASSANTES.test(a)).toBe(true);
    expect(CONS_PASSANTES.test("MARCELA.S")).toBe(false);
  });
});
