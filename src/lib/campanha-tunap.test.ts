import { describe, it, expect } from "vitest";
import { premioTunap } from "./campanha-tunap";

describe("Copa Tunap", () => {
  it("moto com 1,89 garante meta 1,5 e faltam 8 para 2,0", () => {
    const r = premioTunap("moto", 136, 72);
    expect(r.atual?.valor).toBe(3000);
    expect(r.faltam).toBe(8);
  });
  it("auto usa a faixa 1,8 como topo", () => {
    expect(premioTunap("auto", 18, 10).atual?.valor).toBe(5000);
  });
  it("abaixo de 1,0 não ganha nada", () => {
    const r = premioTunap("loja", 401, 663);
    expect(r.atual).toBeNull();
    expect(r.faltam).toBe(262);
  });
});

import { mesesCheios as mc } from "./campanha-tunap";
describe("mesesCheios", () => {
  it("só meses inteiros do período", () => {
    expect(mc("2026-07-01", "2026-11-30")).toEqual(["2026-07", "2026-08", "2026-09", "2026-10", "2026-11"]);
    expect(mc("2026-07-15", "2026-09-29")).toEqual(["2026-08"]);
  });
});
