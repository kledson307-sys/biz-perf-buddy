import { describe, expect, it } from "vitest";
import { lerAbaNps } from "@/lib/nps";
import { ehFatServicos, ehFatPecas, lerFatServicos, lerFatPecas, consolidarFat } from "@/lib/faturamento-historico";
import { ehOsAbertas, lerOsTabela } from "@/lib/os-abertas";

describe("NPS — formatos da montadora", () => {
  it("reconhece pós-vendas com coluna VENDEDOR (A) em vez de CONSULTOR", () => {
    const raw = [
      ["LOJA", "CLIENTE", "CHASSI", "VENDEDOR (A)", "FECHAMENTO DA OS", "DATA DE RECEBIMENTO", "ATUALIZAÇÃO", "NOTA PSI", "TELEFONE", "E-MAIL", "OBSERVAÇÃO", "RAC ABERTA", "MOTIVO DA RAC", "VEÍCULO"],
      ["HAUS SALVADOR", "ALISON CONCEICAO", "99Z0M3007TZ969569", "ALEXANDRE", "46262", "46276", "46268", "9", "(73) 99962-5663", "a@b.com", "ok", "SIM", "AVALIAÇÃO", "R1300 GSA"],
    ];
    const itens = lerAbaNps(raw, "SALVADOR");
    expect(itens).toHaveLength(1);
    expect(itens[0]).toMatchObject({ consultor: "ALEXANDRE", nota: 9, loja_padrao: "1", segmento: "moto", rac: true });
  });

  it("reconhece prospecção (Advisor/VIN/NOTA/Dealer Name) e marca só Haus (40484) como loja padrão", () => {
    const raw = [
      ["Brand", "Touchpoint", "Customer ID", "Dealer Name", "Advisor", "E-MAIL", "Mobilephone", "Model", "VIN", "Import Date", "Status", "Is Submitted", "NOTA ", "OBSERVAÇÃO"],
      ["BMW Motorrad", "Service", "PAULO CEZAR", "Haus (40484)", "GILBERTO RIBEIRO", "p@gmail.com", "75991336162", "BMW/R1250GS A", "99Z0M1000PZ925732", "46237.34", "Qualified (valid)", "Not Submitted", "0", "sem nota"],
      ["BMW", "Service", "GEORGE FELIPE", "Haus Fortaleza (47560)", "WESLEY DE JESUS", "g@gmail.com", "75988645953", "BMW/X1 S20I", "98M40EE01P4021269", "46238.34", "Qualified (valid)", "Submitted", "10", "ótimo"],
    ];
    const itens = lerAbaNps(raw, "pos vendas");
    expect(itens).toHaveLength(2);
    expect(itens[0]).toMatchObject({ consultor: "GILBERTO RIBEIRO", nota: null, loja_padrao: "1", segmento: "moto", chassi: "99Z0M1000PZ925732" });
    expect(itens[1]).toMatchObject({ nota: 10, loja_padrao: "0", segmento: "carro" });
  });
});

describe("Faturamento em linhas (histórico diário)", () => {
  const cabServ = ["Empresa", "Consultor", "Produtivo", "ID O.S.", "Tipo", "Encerrada", "Serv. Líquido", "Consultor"];
  it("reconhece e totaliza serviços por dia, excluindo O.S. internas", () => {
    const raw = [
      ["Faturamento de serviços"], ["Data de Geração"], cabServ,
      ["HAUS", "RENAN JESUS", "DELMIR", "59390", "C7", "16/01/2026", "1500.50", "RENAN.O"],
      ["HAUS", "RENAN JESUS", "DELMIR", "59391", "IN", "16/01/2026", "999", "RENAN.O"],
      ["HAUS", "WESLEY F", "JOAO", "59392", "N7", "17/01/2026", "2000", "WESLEY.F"],
    ];
    expect(ehFatServicos(raw)).toBe(true);
    const fat = lerFatServicos(raw)!;
    expect(fat.meses).toEqual(["2026-01"]);
    expect(fat.linhas).toHaveLength(2);
    expect(fat.linhas[0]).toMatchObject({ login: "RENAN.O", dia: "2026-01-16", servicos: 1500.5 });
  });

  const cabPec = ["Cód. Item", "Quantidade", "Preço Final", "Venda", "Vendedor", "Tipo Os", "Devolvida", "Preço Contábil", "Preço Liquido"];
  it("reconhece peças por dia com margem, fora devolvidas e internas", () => {
    const raw = [
      ["Lista de itens"], ["Data de Geração"], cabPec,
      ["AG60HD", "1", "2320.17", "10/04/2026", "GEOVANA.L", "NC", "", "1488.3", "2320.17"],
      ["AG60HD", "2", "1000", "10/04/2026", "GEOVANA.M", "IO", "", "400", "1000"],
      ["AG60HD", "1", "500", "11/04/2026", "GEOVANA.M", "NC", "1", "300", "500"],
    ];
    expect(ehFatPecas(raw)).toBe(true);
    const fat = lerFatPecas(raw)!;
    expect(fat.linhas).toHaveLength(1); // apelido GEOVANA.L -> GEOVANA.M; interna e devolvida fora
    expect(fat.linhas[0]).toMatchObject({ login: "GEOVANA.M", dia: "2026-04-10", pecas: 2320.17 });
    expect(fat.linhas[0]!.margem).toBeCloseTo(831.87, 2);
  });

  it("consolida por consultor e dia e lista logins fora da equipe", () => {
    const fat = { linhas: [
      { login: "RENAN.O", dia: "2026-01-16", servicos: 100, pecas: 0, margem: 0 },
      { login: "RENAN.O", dia: "2026-01-16", servicos: 0, pecas: 50, margem: 10 },
      { login: "DESCONHECIDO", dia: "2026-01-16", servicos: 5, pecas: 0, margem: 0 },
    ], meses: ["2026-01"], ignorados: new Map() };
    const { rows, ignorados } = consolidarFat(fat, [{ id: "abc", nome: "RENAN.O" }]);
    expect(rows).toEqual([{ consultant_id: "abc", dia: "2026-01-16", servicos: 100, pecas: 50, margem_pecas: 10 }]);
    expect(ignorados).toEqual(["DESCONHECIDO"]);
  });
});

describe("O.S. abertas", () => {
  it("reconhece o relatório em tabela e aplica 30% em C4/MG/NG", () => {
    const raw = [
      ["O.S. Abertas"], ["Data de Geração: 09/10/2026"],
      ["Número", "Tipo", "E-mail", "Dias na Oficina", "Cliente", "Modelo", "Recep.", "Placa", "Emissão", "Prometida", "Serv. Líquido", "Itens Líquido"],
      ["70001", "C7", "", "10", "CLIENTE A", "BMW X1", "WESLEY.F", "ABC1D23", "01/10/2026", "10/10/2026", "1000", "2000"],
      ["70002", "C4", "", "5", "CLIENTE B", "BMW X3", "RENAN.O", "DEF4G56", "01/10/2026", "10/10/2026", "1000", "2000"],
      ["70003", "IO", "", "5", "INTERNA", "BMW X5", "RENAN.O", "GHI7H89", "01/10/2026", "10/10/2026", "9999", "9999"],
    ];
    expect(ehOsAbertas(raw)).toBe(true);
    const linhas = lerOsTabela(raw)!;
    expect(linhas).toHaveLength(2);
    expect(linhas[0]).toMatchObject({ nome: "WESLEY.F", servicos: 1000, pecas: 2000 });
    expect(linhas[1]).toMatchObject({ nome: "RENAN.O", servicos: 300, pecas: 600 });
  });
});
