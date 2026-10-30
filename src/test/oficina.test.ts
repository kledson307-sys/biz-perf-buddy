import { describe, expect, it } from "vitest";
import { porPassagem, ratioFaixa, ritmo } from "@/lib/oficina";

describe("oficina", () => {
  it("conversão é unidades por passagem, não %: 14 vendas ÷ 2 passagens = 7", () => {
    expect(porPassagem(14, 2)).toBe(7);
  });
  it("ratio peças/M.O. ideal entre 2,50 e 3,50 fica verde", () => {
    expect(ratioFaixa(3000, 1000).cls).toBe("text-success");
    expect(ratioFaixa(1000, 1000).cls).toBe("text-destructive");
  });
  it("projeção e necessidade diária", () => {
    const r = ritmo(10000, 22000, 10, 22);
    expect(r.proj).toBe(22000);
    expect(r.nec).toBe(1000);
  });
});
