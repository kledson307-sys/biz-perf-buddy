import { describe, expect, it } from "vitest";
import { CHASE, estagnada, folhaComissao, pctAcessorios, statusConciliado, type VendaC } from "./acessorios-estetica";

const v = (p: Partial<VendaC>): VendaC => ({ departamento: "ACESSORIOS", vendedor: "RICK", canal: "NOVO", segmento: "CARRO", valor: 0, premiacao: 0, devolucao: 0, obsoleto: false, status: "FATURADO", ...p });

describe("comissão acessórios", () => {
  it("showroom: até 30 mil 3%, até 45 mil 4%, acima 5%", () => {
    expect(pctAcessorios("NOVO", 30000)).toBe(0.03);
    expect(pctAcessorios("SEMINOVO", 42998.35)).toBe(0.04);
    expect(pctAcessorios("NOVO", 45001)).toBe(0.05);
  });
  it("pós-vendas é 3% fixo", () => { expect(pctAcessorios("OFICINA", 90000)).toBe(0.03); });
  it("faixa sobre produção líquida (faturado menos devolução)", () => {
    const [l] = folhaComissao([v({ valor: 47000, devolucao: 3000 })], "ACESSORIOS");
    expect(l!.producao).toBe(44000); expect(l!.pct).toBe(0.04); expect(l!.total).toBe(1760);
  });
  it("obsoleto paga 2% à parte", () => {
    const [l] = folhaComissao([v({ valor: 10000 }), v({ valor: 5000, obsoleto: true })], "ACESSORIOS");
    expect(l!.comissao).toBe(300); expect(l!.comObsoleto).toBe(100); expect(l!.total).toBe(400);
  });
  it("só vendas faturadas entram na folha", () => {
    expect(folhaComissao([v({ valor: 9000, status: "A_FATURAR" })], "ACESSORIOS")).toEqual([]);
  });
});

describe("premiação estética", () => {
  it("soma premiação fixa e não entra na folha de acessórios", () => {
    const vs = [v({ departamento: "ESTETICA", valor: 10990, premiacao: 300 }), v({ departamento: "ESTETICA", valor: 2790, premiacao: 100 })];
    expect(folhaComissao(vs, "ESTETICA")[0]!.total).toBe(400);
    expect(folhaComissao(vs, "ACESSORIOS")).toEqual([]);
  });
  it("PPF XPEL Matte Full paga R$ 500", () => { expect(CHASE.find((p) => p.nome === "PPF XPEL Matte Full")!.premio).toBe(500); });
});

describe("conciliação", () => {
  it("O.S. aberta e faturada", () => {
    expect(statusConciliado({ status: "A_FATURAR", os_n: "76914" }, ["076914"], [])).toBe("OS_ABERTA");
    expect(statusConciliado({ status: "OS_ABERTA", os_n: "76914" }, [], ["76914"])).toBe("FATURADO");
    expect(statusConciliado({ status: "CANCELADO", os_n: "76914" }, [], ["76914"])).toBe("CANCELADO");
  });
  it("a faturar parada há mais de 15 dias", () => {
    expect(estagnada({ status: "A_FATURAR", dia: "2026-11-01" }, "2026-11-17")).toBe(true);
    expect(estagnada({ status: "A_FATURAR", dia: "2026-11-01" }, "2026-11-15")).toBe(false);
  });
});

import { parseRvd } from "./acessorios-estetica";
describe("importador RVD", () => {
  const rows = [
    [null, "NOVO (CARRO)", null, null, null, null, null, null, null, null, 6478.8, null, 8375],
    [null, "VENDEDOR", "VENDA TOTAL", "AC FATURADOS", "A FATURAR", "V.FATURADOS", "V. A FAT.", "TOTAL DE V.", "TICKET GERAL"],
    [null, "RICK NASCIMENTO SANTOS", 25524, 25524, 0, 3, 0, 3, 8508],
    [null, "TOTAL", 25524, 25524, 0, 3, 0, 3],
    [null, "OFICINA (CARRO)", null, null, null, 100],
    [null, "VENDEDOR", "FATURADO", "A FATURAR", "TICKET GERAL", "TARGET", "PASSAGNES"],
    [null, "WESLEY DE JESUS FERREIRA", 3380, 350, null, null, 125],
  ];
  it("lê blocos, veículos e target", () => {
    const r = parseRvd(rows);
    expect(r[0]).toEqual({ vendedor: "RICK NASCIMENTO SANTOS", canal: "NOVO", segmento: "CARRO", faturado: 25524, aFaturar: 0, veiculos: 3, target: 8375 });
    expect(r[1]).toMatchObject({ canal: "OFICINA", faturado: 3380, aFaturar: 350, veiculos: 125, target: 100 });
    expect(r).toHaveLength(2);
  });
});
