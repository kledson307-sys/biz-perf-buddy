import { supabase } from "@/integrations/supabase/client";
import { UPDATE_EVENT } from "@/lib/update-status";

// Registra quem atualizou os dados, quando e de onde (usado no aviso do topo).
export async function registrarUpdate(origem: string, mes: string | null = null) {
  const { data } = await supabase.auth.getUser();
  const nome = data.user?.email ?? data.user?.id ?? "desconhecido";
  const { error } = await supabase.from("update_log").insert({ nome, origem, mes });
  if (!error) window.dispatchEvent(new Event(UPDATE_EVENT));
}
