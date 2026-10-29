import { supabase } from "@/integrations/supabase/client";
import { grupoDe, norm, type PassReport } from "@/lib/mecanicos";
import { registrarUpdate } from "@/lib/update-log";

/** Grava o relatório de Passagens do mês: técnicos (passagens + composição), mix e passagens dos consultores. Substitui o mês, nunca soma. */
export async function salvarPassagens(r: PassReport, mes: string): Promise<string> {
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
  window.dispatchEvent(new Event("tecnicos-atualizados"));
  return `Passagens importadas: ${r.mecanicos.length} técnicos e ${vRows.length} consultores (O.S. repetidas contadas uma única vez).${ignorados ? ` ${ignorados} consultores não cadastrados foram ignorados.` : ""} Totais do mês substituídos, sem somar.`;
}
