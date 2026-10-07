import { describe, expect, it } from "vitest";
import { readSalesReport } from "@/lib/sales-report";

describe("sales report", () => {
  const header = ["Vendedor", "", "Nome Completo", "", "Serviços", "Imposto Srv.", "", "Peças", "", "Custo Peças"];
  it("reads cumulative period, correct revenues, and skips footer and repeated headers", () => {
    const r = readSalesReport([
      ["O.S. Fechadas no Periodo de 01/10/2026 a 05/10/2026"], header,
      ["ANDRESSA.O", "", "ANDRESSA SILVA", "", "13.294,88", "1.800,82", "", "22.535,43"],
      ["GEOVANA.M", "", "GEOVANA DE", "", "0,00", "1.800,82", "", "3.537,00"], [], header,
      ["MARCELA.S", "", "MARCELA", "", "0,00", "", "", "19.700,00"],
      ["P.BENIGNO", "", "PEDRO BENIGNO", "", "2.898,35", "", "", "6.255,37"],
      ["WESLEY.F", "", "WESLEY DE JESUS", "", "1.269,27", "", "", "7.402,87"],
      ["Total Geral", "", "", "", "17.462,50", "", "", "59.430,67"],
    ]);
    expect(r.periodo).toEqual({ ini: "2026-10-01", fim: "2026-10-05" });
    expect(r.rows).toHaveLength(5);
    expect(r.rows[0]?.nome).toBe("ANDRESSA.O");
    expect(r.rows.reduce((n,r)=>n+r.servicos,0)).toBeCloseTo(17462.50);
    expect(r.rows.reduce((n,r)=>n+r.pecas,0)).toBeCloseTo(59430.67);
  });
  it("preserves basic daily paste and groups names ignoring case", () => {
    const r = readSalesReport([["Consultor", "Departamento", "Serviços", "Peças"], ["João", "Oficina", "1.250,00", 830], ["JOÃO", "Oficina", 50, 0]]);
    expect(r.periodo).toBeNull();
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.servicos).toBe(1300);
  });
  it("rejects missing sales and cross-month totals", () => {
    expect(()=>readSalesReport([["Imposto Srv.", "Custo Peças"]])).toThrow();
    expect(()=>readSalesReport([["Periodo de 30/09/2026 a 05/10/2026"],header])).toThrow();
  });
});