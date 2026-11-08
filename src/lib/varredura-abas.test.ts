import { describe, expect, it } from "vitest";
import { faltamPromotores } from "./nps";
import { comStatusManual, STATUS_KEY, type OsItem } from "./os-controle";

const os: OsItem = { n: "1", cons: "A", cli: "", mod: "", placa: "", emi: "", pec: 0, serv: 0, valor: 0, dias: 10, obs: "", st: "autorizacao", desde: "2026-11-01" };

describe("trava NPS", () => {
  it("Carro 82/100 com meta 85% precisa de 20 notas 9/10", () => expect(faltamPromotores(82, 100, 0.85)).toBe(20));
  it("já na meta não falta nada", () => expect(faltamPromotores(85, 100, 0.85)).toBe(0));
  it("Moto 44/50 com meta 88% já bateu", () => expect(faltamPromotores(44, 50, 0.88)).toBe(0));
});

describe("status manual da O.S.", () => {
  it("mudança feita depois da planilha prevalece", () => {
    const r = comStatusManual(os, { [STATUS_KEY]: { feito: true, nota: "ok", st: "servico", at: "2026-11-05T10:00:00Z" } }, "2026-11-03T08:00:00Z");
    expect(r.st).toBe("servico");
  });
  it("planilha nova (posterior) prevalece sobre mudança antiga", () => {
    const r = comStatusManual(os, { [STATUS_KEY]: { feito: true, nota: "ok", st: "servico", at: "2026-11-05T10:00:00Z" } }, "2026-11-10T08:00:00Z");
    expect(r.st).toBe("autorizacao");
  });
});

import { bonusLimpar } from "./agregados";
describe("bonificação Limpar", () => {
  it("R$10 por serviço Limpar, ignorando outros itens", () => {
    expect(bonusLimpar([{ item: "limpar", qtd: 3 }, { item: "oxi", qtd: 5 }, { item: "limpar", qtd: 2 }])).toEqual({ qtd: 5, bonus: 50 });
  });
});
