import { supabase } from "@/integrations/supabase/client";

/** Cadeado de fechamento de mês: mês travado não aceita novas importações. Só o gestor master trava/destrava. */
export const MASTER_EMAIL = "kledson307@gmail.com";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const t = () => (supabase as any).from("month_locks");

export async function mesTravado(mes: string): Promise<boolean> {
  const { data } = await t().select("mes").eq("mes", mes).maybeSingle();
  return !!data;
}
export async function travarMes(mes: string, email: string) {
  return t().insert({ mes, locked_by: email });
}
export async function destravarMes(mes: string) {
  return t().delete().eq("mes", mes);
}
export const msgTravado = (mes: string) => `O mês ${mes.split("-").reverse().join("/")} está fechado com cadeado. Peça ao gestor master para reabrir antes de importar.`;
