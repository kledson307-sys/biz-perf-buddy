import { describe, expect, it } from "vitest";
import { dataRadarD1, faltasDoMes } from "./agendamentos-data";

describe("radar D+1", () => {
  it("mostra a agenda de amanhã mesmo havendo D+1 de hoje", () => {
    expect(dataRadarD1(["2026-11-04", "2026-11-05", "2026-11-06"], "2026-11-05")).toBe("2026-11-06");
  });
  it("sem agenda futura, usa a mais recente importada", () => {
    expect(dataRadarD1(["2026-11-04", "2026-11-05"], "2026-11-05")).toBe("2026-11-05");
  });
});

describe("faltasDoMes", () => {
  const r = (tipo: "d1" | "d0", data: string, placa: string, status = "") => ({ tipo, data, placa, status, cliente: placa, celular: "" }) as never;
  it("agenda futura ou de hoje sem planilha do dia não conta falta", () => {
    expect(faltasDoMes([r("d1", "2026-11-07", "A"), r("d1", "2026-11-06", "B")], "2026-11-06")).toHaveLength(0);
  });
  it("dia passado sem comparecimento conta falta", () => {
    expect(faltasDoMes([r("d1", "2026-11-05", "A")], "2026-11-06")).toHaveLength(1);
  });
});
