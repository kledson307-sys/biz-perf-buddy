import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { OsSemMudanca } from "@/components/OsSemMudanca";

const mocks = vi.hoisted(() => ({ limit: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => ({ select: () => ({ order: () => ({ limit: mocks.limit }) }) }) } }));
const item = { n: "123", cons: "ANDRESSA.O", cli: "Cliente", mod: "Modelo", placa: "", emi: "", pec: 0, serv: 0, valor: 0, dias: 10, obs: "Diagnóstico", st: "diag", desde: "2026-10-01" };
const snap = (itens: unknown[]) => ({ id: "1", at: "2026-10-13", nome: "Gestor", arquivo: "relatorio.xls", itens });
beforeEach(() => mocks.limit.mockReset());
describe("Avisos de O.S. no Painel", () => {
  it("shows unchanged orders with department, omits changed/new orders and opens control", async () => {
    mocks.limit.mockResolvedValue({ data: [snap([item, { ...item, n: "456", st: "pronto" }, { ...item, n: "789" }]), snap([item, { ...item, n: "456" }])], error: null });
    const abrir = vi.fn();
    render(<OsSemMudanca cons={[{ nome: "ANDRESSA.O", department_id: "oficina" }]} deptName={() => "SG OFICINA"} abrir={abrir} />);
    expect(await screen.findByText("O.S. 123 · SG OFICINA")).toBeInTheDocument();
    expect(screen.queryByText(/O.S. 456/)).not.toBeInTheDocument();
    expect(screen.queryByText(/O.S. 789/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ver no Controle O.S." }));
    expect(abrir).toHaveBeenCalledOnce();
  });
  it("does not report stagnation on the first import", async () => {
    mocks.limit.mockResolvedValue({ data: [snap([item])], error: null });
    render(<OsSemMudanca cons={[]} deptName={() => ""} abrir={() => {}} />);
    await vi.waitFor(() => expect(mocks.limit).toHaveBeenCalled());
    expect(screen.queryByRole("region", { name: "O.S. sem mudança de status" })).not.toBeInTheDocument();
  });
});