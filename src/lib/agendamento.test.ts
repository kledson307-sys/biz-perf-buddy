import { describe, it, expect, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { readFileSync, existsSync } from "node:fs";
import { lerAgendamento, classificar, ehAgendamento } from "./agendamento";

describe("agendamento", () => {
  it("classifica recall, diagnóstico e revisão pela descrição", () => {
    expect(classificar("CAMPANHA ATUALIZAÇÃO DE SOFTWARE")).toBe("recall");
    expect(classificar("ALEGAÇÕES: BARULHO NA SUSPENSÃO")).toBe("diagnostico");
    expect(classificar("ALEGAÇÕES:NÃO POSSUI\nBSI: NÃO\nTROCA DE ÓLEO")).toBe("revisao");
  });
  it("não reconhece planilha qualquer", () => { expect(ehAgendamento([["Nome", "Valor"]])).toBe(false); });
  const f = (n: string) => `/tmp/${n}.json`;
  it.skipIf(!existsSync(f("agendamento_d_1")))("identifica D+1 e D0 pelo conteúdo", () => {
    const d1 = lerAgendamento(JSON.parse(readFileSync(f("agendamento_d_1"), "utf8")))!;
    const d0 = lerAgendamento(JSON.parse(readFileSync(f("agendamento_do_dia"), "utf8")))!;
    expect(d1.tipo).toBe("d1"); expect(d1.data).toBe("2026-10-31");
    expect(d0.tipo).toBe("d0"); expect(d0.data).toBe("2026-10-30");
    console.log(d1.itens.length, d0.itens.length, d1.itens.map((i) => i.categoria + "/" + i.segmento).join(","));
  });
});
