import { supabase } from "@/integrations/supabase/client";
import { grupoDe, type PassReport } from "@/lib/mecanicos";
import { norm } from "@/components/painel-ui";
import { casarConsultor } from "@/lib/sales-report";
import { registrarUpdate } from "@/lib/update-log";
import { ENCERRADO_KEY, osFaturadasAtivas, type OsItem } from "@/lib/os-controle";
import { mesTravado, msgTravado } from "@/lib/month-lock";
import { inicializarTecnicosMes } from "@/lib/tecnicos-mes";

/** Baixa automática: O.S. ativas do Controle de O.S. que aparecem como faturadas são encerradas. Retorna quantas. */
export async function baixarOsFaturadas(faturadas: string[]): Promise<number> {
  if (!faturadas.length) return 0;
  const [{ data: snap }, { data: acomp }] = await Promise.all([
    supabase.from("os_imports").select("itens").order("at", { ascending: false }).limit(1),
    supabase.from("os_acompanhamento").select("os_n,acoes,prev_manual"),
  ]);
  const itens = (snap?.[0]?.itens ?? []) as unknown as OsItem[];
  const porOs = new Map((acomp ?? []).map((a) => [a.os_n, a]));
  const acoes = Object.fromEntries([...porOs].map(([k, a]) => [k, a.acoes]));
  const alvo = osFaturadasAtivas(itens, acoes, faturadas);
  if (!alvo.length) return 0;
  const d = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10).split("-").reverse().join("/");
  const rows = alvo.map((n) => ({ os_n: n, prev_manual: porOs.get(n)?.prev_manual ?? null, updated_at: new Date().toISOString(),
    acoes: { ...((porOs.get(n)?.acoes as Record<string, unknown>) ?? {}), [ENCERRADO_KEY]: { feito: true, nota: `Encerrada automaticamente · Faturada em ${d}`, at: new Date().toISOString(), auto: true } } as never }));
  const { error } = await supabase.from("os_acompanhamento").upsert(rows, { onConflict: "user_id,os_n" });
  if (error) throw new Error("Erro na baixa automática do Controle de O.S.: " + error.message);
  window.dispatchEvent(new Event("os-notifications-updated"));
  return alvo.length;
}

/** Grava o relatório de Passagens do mês: técnicos (passagens + composição), mix e passagens dos consultores. Substitui o mês, nunca soma. */
export async function salvarPassagens(r: PassReport, mes: string): Promise<string> {
  if (await mesTravado(mes)) throw new Error(msgTravado(mes));
  await inicializarTecnicosMes(mes);
  const { data: atuais } = await supabase.from("mech_month").select("nome,grupo,servicos,pecas,meta_servicos,meta_pecas").eq("mes", mes);
  const porNome = new Map((atuais ?? []).map((a) => [norm(a.nome), a]));
  const mecs = r.mecanicos.map((x) => {
    const a = porNome.get(norm(x.nome));
    return { nome: a?.nome ?? x.nome.trim().toUpperCase(), grupo: a?.grupo ?? grupoDe(x.nome), servicos: a?.servicos ?? 0, pecas: a?.pecas ?? 0, meta_servicos: a?.meta_servicos ?? 0, meta_pecas: a?.meta_pecas ?? 0,
      passagens: x.passagens, composicao: (x.composicao ?? {}) as never, mes, updated_at: new Date().toISOString() };
  });
  if (mecs.length) {
    const { error } = await supabase.from("mech_month").upsert(mecs, { onConflict: "user_id,mes,nome" });
    if (error) throw new Error("Erro ao salvar passagens dos técnicos: " + error.message);
  }
  const { data: cons } = await supabase.from("consultants").select("id,nome");
  const byNome = new Map((cons ?? []).map((c) => [norm(c.nome).replace(/\s+/g, " "), c.id]));
  // Nome completo da DMS → login do painel (ex.: WESLEY DE JESUS FERREIRA → WESLEY.F).
  const logins = (cons ?? []).map((c) => c.nome);
  r = { ...r, consultores: r.consultores.map((x) => ({ ...x, nome: casarConsultor(x.nome, logins) ?? x.nome })) };
  const [y, m] = mes.split("-").map(Number);
  const dia = `${mes}-${String(new Date(y!, m!, 0).getDate()).padStart(2, "0")}`;
  const vRows = r.consultores.filter((x) => byNome.has(norm(x.nome).replace(/\s+/g, " ")))
    .map((x) => ({ consultant_id: byNome.get(norm(x.nome).replace(/\s+/g, " "))!, dia, passagens: x.passagens }));
  const ignorados = r.consultores.length - vRows.length;
  const mixRows = r.consultores.filter((x) => x.mix).map((x) => ({ mes, nome: x.nome, composicao: x.mix as never, updated_at: new Date().toISOString() }));
  if (mixRows.length) {
    await supabase.from("cons_mix").delete().eq("mes", mes);
    const { error } = await supabase.from("cons_mix").insert(mixRows);
    if (error) throw new Error("Erro ao salvar mix de passagens dos consultores: " + error.message);
  }
  if (vRows.length) {
    const { error } = await supabase.from("agg_visits").upsert(vRows, { onConflict: "consultant_id,dia" });
    if (error) throw new Error("Erro ao salvar passagens dos consultores: " + error.message);
  }
  await registrarUpdate("Passagens (importação)", mes);
  const baixadas = await baixarOsFaturadas(r.osIds ?? []).catch(() => -1);
  window.dispatchEvent(new Event("tecnicos-atualizados"));
  return `Passagens importadas: ${r.mecanicos.length} técnicos e ${vRows.length} consultores (O.S. repetidas contadas uma única vez).${ignorados ? ` ${ignorados} consultores não cadastrados foram ignorados.` : ""} Totais do mês substituídos, sem somar.${baixadas > 0 ? ` ${baixadas} O.S. faturada(s) encerrada(s) automaticamente no Controle de O.S.` : baixadas < 0 ? " Não foi possível fazer a baixa automática no Controle de O.S." : ""}`;
}

/** Grava M.O. e peças por técnico vindas do "O.S. Fechadas". O relatório é do mês até hoje: substitui o mês (técnicos fora dele ficam zerados), nunca soma. */
export async function salvarFatTecnicos(ft: import("@/lib/mecanicos").FatTecnicos, mes: string): Promise<string> {
  if (await mesTravado(mes)) throw new Error(msgTravado(mes));
  await inicializarTecnicosMes(mes);
  const { data: atuais, error: e0 } = await supabase.from("mech_month").select("nome,grupo,servicos,pecas,passagens,meta_servicos,meta_pecas").eq("mes", mes);
  if (e0) throw e0;
  const porNome = new Map(ft.rows.map((r) => [norm(r.nome).replace(/\s+/g, " "), r]));
  const vistos = new Set<string>();
  const rows = (atuais ?? []).map((a) => {
    const k = norm(a.nome).replace(/\s+/g, " "); const n = porNome.get(k); if (n) vistos.add(k);
    return { ...a, servicos: n?.servicos ?? 0, pecas: n?.pecas ?? 0, mes, updated_at: new Date().toISOString() };
  });
  for (const [k, n] of porNome) if (!vistos.has(k)) rows.push({ nome: n.nome, grupo: grupoDe(n.nome), servicos: n.servicos, pecas: n.pecas, passagens: 0, meta_servicos: 0, meta_pecas: 0, mes, updated_at: new Date().toISOString() });
  const { error } = await supabase.from("mech_month").upsert(rows, { onConflict: "user_id,mes,nome" });
  if (error) throw new Error("Erro ao salvar faturamento dos técnicos: " + error.message);
  await registrarUpdate("Técnicos (importação)", mes);
  window.dispatchEvent(new Event("tecnicos-atualizados"));
  const s = ft.semApontamento; const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  return `Faturamento de ${ft.rows.length} técnico(s)${s.servicos + s.pecas > 0 ? ` · ⚠️ ${brl(s.servicos + s.pecas)} sem técnico apontado na DMS` : ""}`;
}
