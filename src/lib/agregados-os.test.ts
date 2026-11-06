import { describe, it, expect } from "vitest";
import { agregadosDoFatServicos } from "@/lib/agregados-os";

const H = ["Consultor", "TMO Ref.", "ID O.S.", "Tipo", "Encerrada", "Serv. Líquido", "Consultor"];
const L = (ref: string, os: number, tipo: string, login: string, v: number) => ["X", ref, os, tipo, "05/11/2026", v, login];

describe("agregados nas O.S. Fechadas", () => {
  it("conta cada linha de código de agregado por consultor, sem O.S. internas", () => {
    const r = agregadosDoFatServicos([["O.S. Fechadas"], H,
      L("LIMPSIST", 76914, "C7", "ANDRESSA.O", 190), L("LIMP05", 76914, "C7", "ANDRESSA.O", 190),
      L("0000170", 76914, "C7", "ANDRESSA.O", 700), L("ALINHA01", 76897, "C7", "WESLEY.F", 300),
      L("LIMPSIST", 76845, "NN", "P.BENIGNO", 190), L("0000105.", 76901, "C7", "WESLEY.F", 264)])!;
    const q = (n: string, i: string) => r.registros.filter((x) => x.nome === n && x.item === i).reduce((a, x) => a + x.qtd, 0);
    expect(q("ANDRESSA.O", "limpar")).toBe(2);
    expect(q("ANDRESSA.O", "alinhamento")).toBe(1);
    expect(q("WESLEY.F", "alinhamento")).toBe(1);
    expect(q("P.BENIGNO", "limpar")).toBe(0);
    expect(r.registros.length).toBe(4);
  });
});
