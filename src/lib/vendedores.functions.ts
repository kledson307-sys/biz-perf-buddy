import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type In = { consultantId?: string; tecnicoNome?: string; email: string; senha: string };

/** Dono do painel cria (ou redefine a senha de) um acesso de vendedor ligado a um consultor. */
export const criarAcessoVendedor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: In) => {
    const email = String(d.email ?? "").trim().toLowerCase();
    const senha = String(d.senha ?? "");
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("E-mail inválido.");
    if (senha.length < 6) throw new Error("A senha precisa ter pelo menos 6 caracteres.");
    const tecnicoNome = d.tecnicoNome ? String(d.tecnicoNome).trim().toUpperCase() : "";
    if (!tecnicoNome && !d.consultantId) throw new Error("Escolha a pessoa.");
    return { consultantId: tecnicoNome ? "" : String(d.consultantId), tecnicoNome, email, senha };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    const meuEmail = String(claims.email ?? "").toLowerCase();
    if (data.email === meuEmail) throw new Error("Use outro e-mail, diferente do seu.");
    // Só o dono do painel (quem não é membro de equipe) pode criar acessos.
    const { data: membro } = await supabase.from("team_members").select("id").ilike("email", meuEmail).maybeSingle();
    if (membro) throw new Error("Só o dono do painel pode criar acessos.");
    if (data.tecnicoNome) {
      const { data: t } = await supabase.from("mech_month").select("id").eq("user_id", userId).ilike("nome", data.tecnicoNome).limit(1);
      if (!t?.length) throw new Error("Técnico não encontrado.");
    } else {
      const { data: cons } = await supabase.from("consultants").select("id").eq("id", data.consultantId).eq("user_id", userId).maybeSingle();
      if (!cons) throw new Error("Consultor não encontrado.");
    }

    const { data: outro } = await supabase.from("team_members").select("id,owner_id").ilike("email", data.email).maybeSingle();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Existe em outra equipe? (RLS só mostra as do dono, então consulta com admin)
    const { data: qualquer } = await supabaseAdmin.from("team_members").select("id,owner_id").ilike("email", data.email).maybeSingle();
    if (qualquer && qualquer.owner_id !== userId) throw new Error("Esse e-mail já está em outra equipe.");

    const criado = await supabaseAdmin.auth.admin.createUser({ email: data.email, password: data.senha, email_confirm: true });
    if (criado.error) {
      console.error("createUser", criado.error.code, criado.error.message);
      if (criado.error.code === "weak_password") throw new Error("Senha fraca demais: foi recusada por ser muito comum ou já ter vazado na internet. Use uma senha mais forte.");
      let id: string | undefined;
      for (let page = 1; page <= 20 && !id; page++) {
        const { data: l } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
        id = l?.users.find((u) => u.email?.toLowerCase() === data.email)?.id;
        if (!l || l.users.length < 200) break;
      }
      if (!id) throw new Error("Não foi possível criar o usuário.");
      const up = await supabaseAdmin.auth.admin.updateUserById(id, { password: data.senha, email_confirm: true });
      if (up.error) throw new Error("Não foi possível atualizar a senha.");
    }
    const row = data.tecnicoNome
      ? { email: data.email, papel: "tecnico", consultant_id: null, tecnico_nome: data.tecnicoNome }
      : { email: data.email, papel: "vendedor", consultant_id: data.consultantId, tecnico_nome: null };
    const r = outro
      ? await supabase.from("team_members").update(row).eq("id", outro.id)
      : await supabase.from("team_members").insert(row);
    if (r.error) throw new Error("Não foi possível salvar o acesso.");
    return { ok: true };
  });
