import { describe, it, expect } from "vitest";
import { statusAgenda, slotDaHora } from "./agenda-status";
describe("statusAgenda", () => {
  it("atrasado quando passou 15 min hoje sem entrada", () => expect(statusAgenda("AGENDADO", "2026-11-16", "09:00", "2026-11-16", 9 * 60 + 16)).toBe("atrasado"));
  it("ainda aguardando dentro da tolerância", () => expect(statusAgenda("AGENDADO", "2026-11-16", "09:00", "2026-11-16", 9 * 60 + 10)).toBe("aguardando"));
  it("compareceu vence o atraso", () => expect(statusAgenda("EFETIVADO", "2026-11-16", "08:00", "2026-11-16", 900)).toBe("compareceu"));
  it("D+1 nunca fica atrasado", () => expect(statusAgenda("CONFIRMADO", "2026-11-17", "08:00", "2026-11-16", 900)).toBe("confirmado"));
  it("cancelado", () => expect(statusAgenda("Cancelado", "2026-11-16", "08:00", "2026-11-16", 0)).toBe("cancelado"));
});
describe("slotDaHora", () => {
  it("07:30 é a primeira coluna e 12:15 cai em 12:00", () => { expect(slotDaHora("07:30")).toBe(0); expect(slotDaHora("12:15")).toBe(9); });
});
