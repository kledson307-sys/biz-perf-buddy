import { supabase } from "@/integrations/supabase/client";

/** Idempotent database operation: inherits only an entirely empty, unlocked month. */
export async function inicializarTecnicosMes(mes: string) {
  const { data, error } = await supabase.rpc("inicializar_tecnicos_mes", { p_mes: mes });
  if (error) throw new Error("Não foi possível preparar a equipe técnica: " + error.message);
  return data;
}

export async function copiarMetasTecnicos(mes: string) {
  const { data, error } = await supabase.rpc("copiar_metas_tecnicos", { p_mes: mes });
  if (error) throw new Error("Não foi possível copiar as metas: " + error.message);
  return data;
}