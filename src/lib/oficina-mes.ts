import { supabase } from "@/integrations/supabase/client";
import { juntarDiario, type Diario, type Retorno } from "@/lib/diario-retorno";

/** Grava faturamento por data real e retornos do mês; cada fonte substitui só a sua parte (peças, serviços ou retornos). */
export async function salvarOficinaMes(mes: string, dados: { diario?: Diario; fonte?: "s" | "p"; retornos?: Retorno[] }) {
  const { data: atual } = await supabase.from("oficina_mes").select("diario,retornos").eq("mes", mes).maybeSingle();
  let diario = (atual?.diario as Diario | null) ?? {};
  if (dados.diario && dados.fonte) {
    const f = dados.fonte; diario = Object.fromEntries(Object.entries(diario).map(([d, v]) => { const c = { ...v }; delete c[f]; return [d, c]; }));
    diario = juntarDiario(diario, dados.diario);
  }
  const { error } = await supabase.from("oficina_mes").upsert({ mes, diario: diario as never, retornos: (dados.retornos ?? (atual?.retornos as Retorno[] | null) ?? []) as never, updated_at: new Date().toISOString() }, { onConflict: "user_id,mes" });
  if (error) throw new Error("Erro ao salvar faturamento diário/retornos: " + error.message);
  window.dispatchEvent(new Event("oficina-mes-atualizada"));
}

export async function lerOficinaMes(mes: string): Promise<{ diario: Diario; retornos: Retorno[] }> {
  const { data } = await supabase.from("oficina_mes").select("diario,retornos").eq("mes", mes).maybeSingle();
  return { diario: (data?.diario as Diario | null) ?? {}, retornos: (data?.retornos as Retorno[] | null) ?? [] };
}
