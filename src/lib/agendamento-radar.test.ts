import { describe, expect, it } from "vitest";
import { dataRadarD1 } from "./agendamentos-data";

describe("radar D+1", () => {
  it("mostra a agenda de amanhã mesmo havendo D+1 de hoje", () => {
    expect(dataRadarD1(["2026-11-04", "2026-11-05", "2026-11-06"], "2026-11-05")).toBe("2026-11-06");
  });
  it("sem agenda futura, usa a mais recente importada", () => {
    expect(dataRadarD1(["2026-11-04", "2026-11-05"], "2026-11-05")).toBe("2026-11-05");
  });
});
