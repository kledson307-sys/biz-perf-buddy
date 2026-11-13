import { describe, expect, it } from "vitest";
import { CHASE, conciliarCarteira, estagnada, folhaComissao, pctAcessorios, statusConciliado, type VendaC } from "./acessorios-estetica";

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
  it("abate da carteira os R$ 3.191,20 que o DMS já faturou além do declarado", () => {
    const r = conciliarCarteira([
      v({ valor: 10943, status: "FATURADO" }),
      v({ valor: 13662, status: "A_FATURAR" }),
    ], 14134.20);
    expect(r.carteira).toBe(24605);
    expect(r.aFaturar).toBe(10470.80);
    expect(r.abatido).toBe(3191.20);
    expect(r.proj).toBe(24605);
  });
  it("DMS acima da carteira zera o pendente e mantém o faturamento real", () => {
    const r = conciliarCarteira([v({ valor: 10000, status: "FATURADO" }), v({ valor: 5000, status: "A_FATURAR" })], 18000);
    expect(r.aFaturar).toBe(0);
    expect(r.abatido).toBe(5000);
    expect(r.proj).toBe(18000);
  });
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

import { diferencaRvd, possiveisDuplicadas } from "./acessorios-estetica";
describe("revisor de duplicadas", () => {
  it("mesmo cliente, vendedor e valor é possível duplicada", () => {
    const a = v({ id: "1", cliente: "João Silva", valor: 2790 }), b = v({ id: "2", cliente: "JOAO  SILVA", valor: 2790.5 }), c = v({ id: "3", cliente: "Maria", valor: 2790 });
    expect([...possiveisDuplicadas([a, b, c])].sort()).toEqual(["1", "2"]);
  });
  it("cancelada não conta", () => {
    expect(possiveisDuplicadas([v({ id: "1", cliente: "A", valor: 10 }), v({ id: "2", cliente: "A", valor: 10, status: "CANCELADO" })]).size).toBe(0);
  });
  it("RVD importa só a diferença do que foi lançado à mão", () => {
    const d = diferencaRvd({ vendedor: "RICK", canal: "NOVO", segmento: "CARRO", faturado: 25524, aFaturar: 0, veiculos: 3, target: 0 }, [v({ vendedor: "Rick", valor: 5000 })]);
    expect(d.fat).toBe(20524);
  });
});

import { casarVendedor as cv, radarDia as rd } from "./acessorios-estetica";
describe("dicionário de vendedores RVD", () => {
  it("casa abreviação e acento com o cadastro", () => {
    expect(cv("joão s.", ["JOAO SILVA", "MARIA LIMA"])).toBe("JOAO SILVA");
    expect(cv("MARIA", ["JOAO SILVA", "MARIA LIMA"])).toBe("MARIA LIMA");
  });
  it("não casa quando há ambiguidade", () => {
    expect(cv("JOAO", ["JOAO SILVA", "JOAO SOUZA"])).toBe("JOAO");
  });
});
describe("radar do dia", () => {
  it("só conta lançamentos de hoje", () => {
    const r = rd([{ created_at: "2026-11-07T15:00:00Z" }, { created_at: "2026-11-05T15:00:00Z" }], [], "2026-11-07");
    expect(r.vendasHoje).toBe(1); expect(r.ok).toBe(true);
    expect(rd([{ created_at: "2026-11-05T15:00:00Z" }], [], "2026-11-07").ok).toBe(false);
  });
});

import { targetTicket as tt } from "./acessorios-estetica";
import { describe as d2, it as i2, expect as e2 } from "vitest";
d2("target de ticket médio", () => {
  i2("valores por canal/segmento", () => {
    e2(tt("NOVO", "CARRO")).toBe(8000); e2(tt("NOVO", "MOTO")).toBe(4500);
    e2(tt("SEMINOVO", "CARRO")).toBe(2000); e2(tt("SEMINOVO", "MOTO")).toBe(1000);
    e2(tt("OFICINA", "CARRO")).toBe(300); e2(tt("OFICINA", "MOTO")).toBe(300);
  });
});
