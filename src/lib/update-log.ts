import { supabase } from "@/integrations/supabase/client";

// Registra quem atualizou os dados, quando e de onde (usado no aviso do topo).
export async function registrarUpdate(origem: string) {
  const { data } = await supabase.auth.getUser();
  const nome = data.user?.email ?? data.user?.id ?? "desconhecido";
  await supabase.from("update_log").insert({ nome, origem });
}
