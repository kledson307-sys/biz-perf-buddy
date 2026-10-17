import { describe, expect, it } from "vitest";
import { sourceStatus, tabUpdateStatus, type UpdateRecord } from "@/lib/update-status";

const now = new Date("2026-10-09T18:27:00Z");
const record = (origem: string, at = now.toISOString(), mes: string | null = "2026-10"): UpdateRecord => ({ origem, at, mes, nome: "Gestor" });
const status = (tab: string, records: UpdateRecord[], mes = "2026-10") => tabUpdateStatus(tab, mes, records, now);

describe("Independent tab freshness", () => {
  it("an agregado update cannot clear sales, technician or open order alerts", () => {
    const records = [record("Agregados (importação)")];
    expect(status("agregados", records).stale).toBe(false);
    for (const tab of ["painel", "proj-serv", "proj-pec", "proj-total", "mecanicos", "os"]) expect(status(tab, records).stale).toBe(true);
  });
  it("all sales views refresh together but OS still requires its own import", () => {
    const records = [record("Faturamento (Excel/colar)")];
    for (const tab of ["painel", "proj-serv", "proj-pec", "proj-total"]) expect(status(tab, records).stale).toBe(false);
    expect(status("os", records).pending).toEqual(["os"]);
    expect(status("os", [...records, record("O.S. abertas (importação/edição)")]).stale).toBe(false);
    expect(status("agregados", records).stale).toBe(true);
  });
  it("yesterday and imports for another month never clear today's alert", () => {
    expect(status("painel", [record("Faturamento (Excel/colar)", "2026-10-08T18:00:00Z")]).stale).toBe(true);
    expect(status("painel", [record("Faturamento (Excel/colar)", now.toISOString(), "2026-09")]).stale).toBe(true);
  });
  it("uses São Paulo dates rather than UTC midnight and supports legacy logs", () => {
    expect(tabUpdateStatus("painel", "2026-10", [record("Faturamento (Excel/colar)", "2026-10-09T18:00:00Z", null)], new Date("2026-10-10T01:00:00Z")).stale).toBe(false);
  });
  it("preserves weekly control and does not blink archived months or settings", () => {
    expect(status("controle-os", [record("Controle de O.S.", "2026-10-03T18:00:00Z", null)]).stale).toBe(false);
    expect(status("controle-os", [record("Controle de O.S.", "2026-10-02T18:00:00Z", null)]).stale).toBe(true);
    expect(status("painel", [], "2026-09").stale).toBe(false);
    expect(status("config", []).stale).toBe(false);
  });
  it("marks only an update made today as fresh for the ✅/❌ badge", () => {
    expect(sourceStatus("faturamento", "2026-10", [record("Faturamento (Excel/colar)")], now).fresh).toBe(true);
    expect(sourceStatus("faturamento", "2026-10", [record("Faturamento (Excel/colar)", "2026-10-08T18:00:00Z")], now).fresh).toBe(false);
    expect(sourceStatus("faturamento", "2026-10", [], now).fresh).toBe(false);
    expect(sourceStatus("agregados", "2026-10", [record("Faturamento (Excel/colar)")], now).record).toBeUndefined();
  });
  it("group changes do not refresh technician results", () => {
    expect(status("mecanicos", [record("Técnicos (grupo)")]).stale).toBe(true);
    expect(status("mecanicos", [record("Técnicos (importação)")]).stale).toBe(false);
  });
});