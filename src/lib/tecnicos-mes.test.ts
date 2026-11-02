import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn() } }));
import { supabase } from "@/integrations/supabase/client";
import { inicializarTecnicosMes, copiarMetasTecnicos } from "./tecnicos-mes";

describe("operações de continuidade", () => {
  it("encaminha o mês escolhido para a inicialização atômica", async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: 14, error: null } as never);
    expect(await inicializarTecnicosMes("2026-11")).toBe(14);
    expect(supabase.rpc).toHaveBeenCalledWith("inicializar_tecnicos_mes", { p_mes: "2026-11" });
  });
  it("não informa sucesso quando o banco rejeita mês fechado", async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: null, error: { message: "Mês fechado" } } as never);
    await expect(copiarMetasTecnicos("2026-10")).rejects.toThrow("Mês fechado");
  });
});

const sessionPath = process.env['TECH_TEST_SESSION'];
describe.skipIf(!sessionPath)("novembro na base real", () => {
  const client = createClient(process.env['VITE_SUPABASE_URL'] ?? "", process.env['VITE_SUPABASE_PUBLISHABLE_KEY'] ?? "", { auth: { persistSession: false, autoRefreshToken: false } });
  const authenticate = async () => {
    if (!sessionPath) throw new Error("Sessão de teste ausente");
    const { session } = JSON.parse(readFileSync(sessionPath, "utf8"));
    const { error } = await client.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
    if (error) throw new Error("Falha ao restaurar sessão de teste");
  };
  const targets: [string,number,number][] = [
    ["JONATAS MORAES",75000,250000], ["WELLIGTON DA SILVA TELES",75000,250000],
    ["ORLANDO",55000,200000], ["SERGIO CARVALHO",55000,200000], ["FLAVIO PINHEIRO",50000,110000],
    ["VICTOR FILIPE SILVA ROCHA",40000,70000], ["MATHEUS DA PAZ",10000,20000],
    ["JOÃO PAULO",30000,90000], ["MATHEUS FELIX DA SILVA",30000,90000],
    ["INOCENCIO RIBEIRO NETO",20000,70000], ["JAIR ALVES DOS ANJOS",10000,40000],
    ["DELMIR",0,0], ["LUIS SANDRO",0,0], ["VINICIUS",0,0],
  ];
  it.each(targets)("%s mantém as metas aprovadas de novembro", async (nome,s,p) => {
    await authenticate();
    const { data,error } = await client.from("mech_month").select("meta_servicos,meta_pecas").eq("mes","2026-11").eq("nome",nome).single();
    expect(error).toBeNull(); expect(data).toEqual({ meta_servicos:s,meta_pecas:p });
  });
  it("reabrir novembro não duplica nem altera a produção dos 14 técnicos", async () => {
    await authenticate();
    const before = await client.from("mech_month").select("*").eq("mes","2026-11").order("nome");
    expect(before.data).toHaveLength(14);
    const result = await client.rpc("inicializar_tecnicos_mes",{ p_mes:"2026-11" });
    expect(result.error).toBeNull(); expect(result.data).toBe(0);
    const after = await client.from("mech_month").select("*").eq("mes","2026-11").order("nome");
    expect(after.data).toEqual(before.data);
    expect(after.data?.every(r => r.servicos===0 && r.pecas===0 && r.passagens===0)).toBe(true);
  });
  it("outubro fechado rejeita escrita técnica e preserva o histórico", async () => {
    await authenticate();
    const before = await client.from("mech_month").select("id,meta_servicos").eq("mes","2026-10").eq("nome","JONATAS MORAES").single();
    expect(before.error).toBeNull();
    if (!before.data) throw new Error("Técnico histórico ausente");
    const write = await client.from("mech_month").update({ meta_servicos:before.data.meta_servicos }).eq("id",before.data.id);
    expect(write.error?.message).toContain("Mês fechado");
    const copy = await client.rpc("copiar_metas_tecnicos", { p_mes:"2026-10" });
    expect(copy.error?.message).toContain("Mês fechado");
    const after = await client.from("mech_month").select("id,meta_servicos").eq("id",before.data.id).single();
    expect(after.data).toEqual(before.data);
  });
  it.each([
    ["marcos@hausmotors.com.br","controlador"],
    ["delmirxavier@hausmotors.com.br","chefe_oficina"],
    ["tunap@tunap.com.br","tunap"],
  ])("%s tem o acesso operacional aprovado", async (email,papel) => {
    await authenticate();
    const result = await client.from("team_members").select("papel").eq("email",email).single();
    expect(result.error).toBeNull(); expect(result.data?.papel).toBe(papel);
  });
});