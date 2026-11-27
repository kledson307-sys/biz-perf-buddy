import { supabase } from "@/integrations/supabase/client";
import { ENCERRADO_KEY, hoje, lerRelatorio, normalizar, type OsItem } from "@/lib/os-controle";
import { cruzarOsDiario, comDiarias, NOTA_AUSENTE } from "@/lib/os-diario";

export const OS_DIARIO_MES = "osdiario";

/** Lê as O.S. que entraram pelas importações diárias (guardadas em oficina_mes, sem nova tabela). */
export async function lerOsDiarias(): Promise<OsItem[]> {
  const { data } = await supabase.from("oficina_mes").select("diario").eq("mes", OS_DIARIO_MES).maybeSingle();
  return ((data?.diario as { itens?: OsItem[] } | null)?.itens ?? []);
}

/** Atualiza o Controle de O.S. com o arquivo diário de O.S. abertas: entrada das novas, baixa das ausentes e reabertura. */
export async function sincronizarControleOs(raw: unknown[][]): Promise<string> {
  let arquivo: OsItem[];
  try { arquivo = lerRelatorio(raw, undefined, hoje()); } catch { return "Controle O.S.: arquivo sem número/observação por O.S., nada alterado"; }
  const [{ data: snap, error: e0 }, { data: acomp, error: e1 }, prevDiarias] = await Promise.all([
    supabase.from("os_imports").select("itens").order("at", { ascending: false }).limit(1),
    supabase.from("os_acompanhamento").select("os_n,acoes,prev_manual"),
    lerOsDiarias(),
  ]);
  if (e0 || e1) throw new Error("Não consegui ler o Controle de O.S. para cruzar as O.S. abertas.");
  const semanal = normalizar((snap?.[0]?.itens ?? []) as unknown as OsItem[]);
  const porOs = new Map((acomp ?? []).map((a) => [a.os_n, a]));
  const acoes = Object.fromEntries([...porOs].map(([n, a]) => [n, a.acoes]));
  const h = hoje();
  const r = cruzarOsDiario(comDiarias(semanal, prevDiarias), arquivo, acoes, h);
  const naSemanal = new Set(semanal.map((i) => i.n));
  const prev = new Map(prevDiarias.map((i) => [i.n, i]));
  const diarias = arquivo.filter((i) => !naSemanal.has(i.n)).map((i) => { const p = prev.get(i.n); return p ? { ...i, st: p.st, desde: p.desde } : { ...i, st: "servico" as const, desde: h }; });
  const up = await supabase.from("oficina_mes").upsert({ mes: OS_DIARIO_MES, diario: { at: new Date().toISOString(), itens: diarias } as never, retornos: [] as never, updated_at: new Date().toISOString() }, { onConflict: "user_id,mes" });
  if (up.error) throw new Error("Erro ao salvar as O.S. novas no Controle: " + up.error.message);
  const agora = new Date().toISOString();
  const linha = (n: string, enc: Record<string, unknown>) => ({ os_n: n, prev_manual: porOs.get(n)?.prev_manual ?? null, updated_at: agora,
    acoes: { ...((porOs.get(n)?.acoes as Record<string, unknown>) ?? {}), [ENCERRADO_KEY]: enc } as never });
  const rows = [
    ...r.encerrar.map((n) => linha(n, { feito: true, nota: NOTA_AUSENTE, at: agora, auto: true })),
    ...r.reabrir.map((n) => linha(n, { feito: false, nota: "Reaberta automaticamente · voltou nas O.S. abertas", at: agora, auto: true })),
  ];
  if (rows.length) { const e = await supabase.from("os_acompanhamento").upsert(rows, { onConflict: "user_id,os_n" }); if (e.error) throw new Error("Erro na baixa automática do Controle: " + e.error.message); }
  window.dispatchEvent(new Event("os-notifications-updated"));
  return `Controle O.S.: ${r.novas.length} nova(s) em "Em serviço / Fila" · ${r.encerrar.length} encerrada(s) por não constarem mais${r.reabrir.length ? ` · ${r.reabrir.length} reaberta(s)` : ""}${r.parcial ? " · ⚠️ arquivo parece parcial: nenhuma O.S. foi encerrada" : ""}`;
}
