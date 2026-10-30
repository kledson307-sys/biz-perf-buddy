import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { lerAgendamento } from "@/lib/agendamento";
import { lerAbaNps, daLoja } from "@/lib/nps";
import { ehFatServicos, lerFatServicos } from "@/lib/faturamento-historico";
import { ehFaturamentoPecas } from "@/lib/pecas-itens";
import { ehRelatorioPassagens } from "@/lib/mecanicos";
import { ehOsAbertas, lerOsTabela } from "@/lib/os-abertas";

const abas = (f: string) => {
  const wb = XLSX.read(readFileSync(f), { type: "buffer", cellDates: true });
  return wb.SheetNames.map((s) => ({ s, raw: XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[s]!, { header: 1, defval: "" }) }));
};
const U = "/tmp/browser/agend/";

describe("reconhecimento com os arquivos reais enviados", () => {
  it("agendamento D+1 e do dia", () => {
    const d1 = abas(U + "agendamento_d_1.xls").map((a) => lerAgendamento(a.raw)).find(Boolean);
    const d0 = abas(U + "agendamento_do_dia.xls").map((a) => lerAgendamento(a.raw)).find(Boolean);
    expect(d1?.tipo).toBe("d1"); expect(d1!.itens.length).toBeGreaterThan(0);
    expect(d0?.tipo).toBe("d0"); expect(d0!.itens.length).toBeGreaterThan(0);
  });
  it("NPS pós-vendas e prospecção", () => {
    const nps = abas(U + "NPS_VENDAS_30.09.2026.xlsx").flatMap((a) => lerAbaNps(a.raw, a.s));
    expect(nps.length).toBeGreaterThan(100);
    expect(daLoja(nps).length).toBeGreaterThan(50);
    const prosp = abas(U + "PROSPECÇÃO_31.xlsx").flatMap((a) => lerAbaNps(a.raw, a.s));
    expect(prosp.length).toBeGreaterThan(100);
  });
  it("faturamento de serviços (9 meses) gera histórico diário", () => {
    const a = abas(U + "Faturamento_de_serviços_01.01.2026_á_30.09.2026.xlsx")[0]!;
    expect(ehFatServicos(a.raw)).toBe(true);
    expect(ehRelatorioPassagens(a.raw)).toBe(true);
    const fat = lerFatServicos(a.raw)!;
    expect(fat.meses.length).toBe(9);
    expect(fat.linhas.length).toBeGreaterThan(10000);
  });
  it("faturamento de peças (9 meses) é reconhecido", () => {
    const a = abas(U + "Faturamento_de_peças_01.01.2026_á_30.09.2026.xlsx")[0]!;
    expect(ehFaturamentoPecas(a.raw)).toBe(true);
  });
  it("O.S. abertas é reconhecida", () => {
    const a = abas(U + "O.S_abertas_AC_BS_MC_NC_C7_M7_N7_CF_C5_MF_MS_C4_MG_NG.xlsx")[0]!;
    expect(ehOsAbertas(a.raw)).toBe(true);
    expect(lerOsTabela(a.raw)!.length).toBeGreaterThan(0);
  });
});
