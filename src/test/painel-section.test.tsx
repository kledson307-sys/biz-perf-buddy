import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Secao } from "@/components/painel-ui";

function ImportDraft() {
  const [value, setValue] = useState("");
  return <input aria-label="Prévia da importação" value={value} onChange={e => setValue(e.target.value)} />;
}

describe("Dashboard sections", () => {
  it("preserves import state when the parent refreshes", () => {
    const { rerender } = render(<Secao titulo="Resumo executivo" relatorio={false}><ImportDraft /></Secao>);
    fireEvent.change(screen.getByLabelText("Prévia da importação"), { target: { value: "Planilha conferida" } });
    rerender(<Secao titulo="Resumo executivo atualizado" relatorio={false}><ImportDraft /></Secao>);
    expect((screen.getByLabelText("Prévia da importação") as HTMLInputElement).value).toBe("Planilha conferida");
  });
});