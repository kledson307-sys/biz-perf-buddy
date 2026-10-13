import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Dono do painel redefine a senha de um usuário da própria equipe. */
export const redefinirSenhaUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { memberId: string; senha: string }) => {
    const senha = String(d.senha ?? "");
    if (senha.length < 6) throw new Error("A senha precisa ter pelo menos 6 caracteres.");
    return { memberId: String(d.memberId), senha };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: m } = await supabase.from("team_members").select("email").eq("id", data.memberId).eq("owner_id", userId).maybeSingle();
    if (!m) throw new Error("Usuário não encontrado na sua equipe.");
    const email = m.email.toLowerCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let id: string | undefined;
    for (let page = 1; page <= 20 && !id; page++) {
      const { data: l } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      id = l?.users.find((u) => u.email?.toLowerCase() === email)?.id;
      if (!l || l.users.length < 200) break;
    }
    if (!id) {
      const c = await supabaseAdmin.auth.admin.createUser({ email, password: data.senha, email_confirm: true });
      if (c.error) throw new Error(c.error.code === "weak_password" ? "Senha fraca demais. Use uma senha mais forte." : "Não foi possível criar a senha.");
      return { ok: true };
    }
    const up = await supabaseAdmin.auth.admin.updateUserById(id, { password: data.senha, email_confirm: true });
    if (up.error) throw new Error(up.error.code === "weak_password" ? "Senha fraca demais. Use uma senha mais forte." : "Não foi possível trocar a senha.");
    return { ok: true };
  });
