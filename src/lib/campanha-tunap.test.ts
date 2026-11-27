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
