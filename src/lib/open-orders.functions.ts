import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const ordersSchema = z.record(z.string().uuid(), z.object({
  s: z.number().finite().min(0).max(1e12),
  p: z.number().finite().min(0).max(1e12),
}));
export type OpenOrders = z.infer<typeof ordersSchema>;

export const loadOpenOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ mes: monthSchema }).parse(data))
  .handler(async ({ data, context }) => {
    const [snapshot, permission] = await Promise.all([
      context.supabase.from("open_order_snapshots").select("valores").eq("mes", data.mes).maybeSingle(),
      context.supabase.rpc("can_edit"),
    ]);
    if (snapshot.error || permission.error) throw new Error("Não foi possível carregar as O.S. salvas. Tente novamente.");
    return { valores: snapshot.data ? ordersSchema.parse(snapshot.data.valores) : null, canEdit: permission.data === true };
  });

export const saveOpenOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ mes: monthSchema, valores: ordersSchema }).parse(data))
  .handler(async ({ data, context }) => {
    const permission = await context.supabase.rpc("can_edit");
    if (permission.error || !permission.data) throw new Error("Seu acesso permite apenas visualizar as O.S.");
    const ids = Object.keys(data.valores);
    if (ids.length) {
      const consultants = await context.supabase.from("consultants").select("id").in("id", ids);
      if (consultants.error || consultants.data.length !== ids.length) throw new Error("Consultor inválido para este painel.");
    }
    const { error } = await context.supabase.from("open_order_snapshots").upsert({
      mes: data.mes, valores: data.valores, updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,mes" });
    if (error) throw new Error("Não foi possível salvar as O.S. Tente novamente antes de sair.");
    return { saved: true };
  });