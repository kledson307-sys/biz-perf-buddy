import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { LISTA_FONTES, type Fonte } from "./sync-planilhas";

/** Botão "Sincronizar agora": só gestor/editor; grava no painel do dono da equipe. */
export const sincronizarAgora = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i: { fonte: string }) => {
    if (!(LISTA_FONTES as string[]).includes(i.fonte)) throw new Error("Fonte inválida");
    return { fonte: i.fonte as Fonte };
  })
  .handler(async ({ data, context }) => {
    const { data: pode } = await context.supabase.rpc("can_edit");
    if (!pode) throw new Error("Apenas o gestor ou editores podem sincronizar");
    const { data: owner } = await context.supabase.rpc("data_owner");
    if (!owner) throw new Error("Equipe não encontrada");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sincronizar } = await import("./sync-planilhas.server");
    return sincronizar(supabaseAdmin, data.fonte, owner);
  });
