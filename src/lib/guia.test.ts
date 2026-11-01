import { describe, expect, it } from "vitest";
import { oQueMostrar, perfilGuia, VERSAO_ATUAL } from "@/lib/guia";
import { novosParaAvisar } from "@/lib/aviso-aparelho";

describe("guia e novidades", () => {
  it("novo usuário vê o guia", () => expect(oQueMostrar(false, 0)).toBe("guia"));
  it("usuário antigo vê novidades uma vez", () => {
    expect(oQueMostrar(true, VERSAO_ATUAL - 1)).toBe("novidades");
    expect(oQueMostrar(true, VERSAO_ATUAL)).toBeNull();
  });
  it("Marcos e Delmir usam o guia da oficina", () => {
    expect(perfilGuia("controlador")).toBe("oficina");
    expect(perfilGuia("chefe_oficina")).toBe("oficina");
  });
});

describe("avisos do sininho", () => {
  it("só avisa alertas ainda não emitidos", () => expect(novosParaAvisar(["a", "b"], ["a"]).novos).toEqual(["b"]));
});
