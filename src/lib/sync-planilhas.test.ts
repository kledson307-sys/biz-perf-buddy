import { describe, it, expect } from "vitest";
import { janela, diasSemNovidade, corSaude, separarAgenda, lerEsteticaOnline, lerAgendaOnline } from "./sync-planilhas";

const bahia = (iso: string) => new Date(new Date(iso + "Z").getTime() + 3 * 3600_000); // hora local da Bahia → UTC

describe("janela de sincronização", () => {
  it("dia útil roda das 7h às 20h", () => {
    expect(janela(bahia("2026-11-13T06:59:00")).ativa).toBe(false);
    expect(janela(bahia("2026-11-13T07:00:00")).ativa).toBe(true);
    expect(janela(bahia("2026-11-13T19:59:00")).ativa).toBe(true);
    expect(janela(bahia("2026-11-13T20:00:00")).ativa).toBe(false);
  });
  it("sábado até 14h e domingo pausado", () => {
    expect(janela(bahia("2026-11-14T13:30:00")).ativa).toBe(true);
    expect(janela(bahia("2026-11-14T14:00:00")).ativa).toBe(false);
    expect(janela(bahia("2026-11-15T10:00:00")).ativa).toBe(false);
  });
  it("último dia do mês roda até 23:59 (fechamento)", () => {
    const j = janela(bahia("2026-11-30T23:30:00"));
    expect(j).toEqual({ ativa: true, fechamento: true });
    expect(janela(bahia("2026-12-01T00:30:00")).ativa).toBe(false);
  });
});

describe("saúde da alimentação", () => {
  it("conta dias sem novidade ignorando domingo", () => {
    expect(diasSemNovidade(bahia("2026-11-13T09:00:00").toISOString(), bahia("2026-11-13T18:00:00"))).toBe(0);
    expect(diasSemNovidade(bahia("2026-11-12T09:00:00").toISOString(), bahia("2026-11-13T18:00:00"))).toBe(1);
    expect(diasSemNovidade(bahia("2026-11-14T09:00:00").toISOString(), bahia("2026-11-16T09:00:00"))).toBe(1);
    expect(corSaude(0)).toBe("verde"); expect(corSaude(1)).toBe("amarelo"); expect(corSaude(3)).toBe("vermelho");
  });
});

describe("leitores", () => {
  it("agenda: hoje = D0 e próxima data = D+1", () => {
    const raw = [["DATA", "CLIENTE", "CONTATO", "SERVIÇO", "OBSERVAÇÃO", "STATUS", "HORA AGENDADA", "MODELO", "OPERADOR", "CHASSI"],
      ["13/11/2026", "A", "", "MANUTENCAO", "", "AGUARDANDO", "08:00", "X1", "", "98MHT"],
      ["14/11/2026", "B", "", "1 REV MOTOS", "", "AGUARDANDO", "09:00", "G310 GS", "", "99Z0G3"]];
    const s = separarAgenda(lerAgendaOnline(raw), "2026-11-13");
    expect(s.d0.length).toBe(1); expect(s.dataD1).toBe("2026-11-14"); expect(s.d1[0]!.segmento).toBe("moto");
  });
  it("estética: lê data, valor e status faturado", () => {
    const raw = [["x"], ["Data Venda", "Tipo", "Executivo Vendas", "Faturado", "Cliente", "Modelo", "Obs. Descrição", "Valor Venda", "Pagamento", "Chassi", "Vendedor Estet.", "Premiação"],
      ["05/11/2026", "Pelicula", "DIEGO", "FATURADO", "DIANA", "SPARK", "", "790,00", "PIX", "", "ANE", ""]];
    const v = lerEsteticaOnline(raw);
    expect(v[0]).toMatchObject({ dia: "2026-11-05", valor: 790, faturado: true, vendedor: "ANE" });
  });
});

import { alertasSync } from "./sync-planilhas";
describe("sininho das planilhas", () => {
  it("avisa só com 2+ dias parada ou falha", () => {
    const agora = bahia("2026-11-13T10:00:00");
    const a = alertasSync({ nps: { at: "", ok: true, mudouEm: bahia("2026-11-12T10:00:00").toISOString() }, estetica: { at: "", ok: true, mudouEm: bahia("2026-11-10T10:00:00").toISOString() }, agenda: { at: "", ok: false, erro: "x", mudouEm: agora.toISOString() } }, agora);
    expect(a.map((x) => x.id.split("-").slice(0, 3).join("-"))).toEqual(["sync-falha-agenda", "sync-parada-estetica"]);
  });
});
