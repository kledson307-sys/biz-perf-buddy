import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Box } from "@/components/painel-ui";
import { redefinirSenhaUsuario } from "@/lib/usuarios.functions";

type M = { id: string; email: string; papel: string; consultant_id: string | null };
type C = { id: string; nome: string };
const PAPEIS: Record<string, string> = { vendedor: "Vendedor", tecnico: "Técnico", editor: "Editor", viewer: "Visualizador" };

export function UsuariosAdmin({ lista, cons, onChange }: { lista: M[]; cons: C[]; onChange: () => void }) {
  const [busca, setBusca] = useState("");
  const [senhaDe, setSenhaDe] = useState<string | null>(null);
  const [senha, setSenha] = useState("");
  const [msg, setMsg] = useState("");
  const trocar = useServerFn(redefinirSenhaUsuario);

  const nome = (id: string | null) => cons.find((c) => c.id === id)?.nome ?? "";
  const f = busca.trim().toLowerCase();
  const rows = lista.filter((m) => !f || m.email.toLowerCase().includes(f) || nome(m.consultant_id).toLowerCase().includes(f));

  const upd = async (id: string, v: Partial<M>) => {
    const { error } = await supabase.from("team_members").update(v).eq("id", id);
    setMsg(error ? "Não foi possível salvar." : "Alteração salva.");
    onChange();
  };
  const salvarSenha = async (id: string) => {
    try { await trocar({ data: { memberId: id, senha } }); setMsg("Senha trocada."); setSenhaDe(null); setSenha(""); }
    catch (e) { setMsg(e instanceof Error ? e.message : "Erro ao trocar a senha."); }
  };
  const remover = async (m: M) => {
    if (!confirm(`Remover o acesso de ${m.email}?`)) return;
    await supabase.from("team_members").delete().eq("id", m.id);
    setMsg("Acesso removido."); onChange();
  };

  return (
    <Box title={`Administrar usuários (${lista.length})`}>
      <div className="p-5">
        <input className="mb-3 h-9 w-full rounded-md border bg-background px-3 text-sm" placeholder="Buscar por e-mail ou vendedor…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        {msg && <p className="mb-2 text-sm">{msg}</p>}
        <ul className="divide-y text-sm">
          {rows.map((m) => (
            <li key={m.id} className="space-y-2 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0 break-all"><b>{m.email}</b>{m.consultant_id && <span className="text-muted-foreground"> · {nome(m.consultant_id)}</span>}</span>
                <span className="flex flex-wrap items-center gap-2">
                  <select className="h-8 rounded-md border bg-background px-2" value={m.papel}
                    onChange={(e) => {
                      const p = e.target.value;
                      if (p === "tecnico") return setMsg("Para criar acesso de técnico, use o bloco Acesso dos técnicos.");
                      if (p === "vendedor" && !m.consultant_id) return setMsg("Para virar vendedor, escolha o vendedor ligado primeiro (crie o acesso em Acesso dos vendedores).");
                      void upd(m.id, { papel: p, consultant_id: p === "vendedor" ? m.consultant_id : null });
                    }}>
                    {Object.entries(PAPEIS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  {m.papel === "vendedor" && (
                    <select className="h-8 rounded-md border bg-background px-2" value={m.consultant_id ?? ""} onChange={(e) => void upd(m.id, { consultant_id: e.target.value })}>
                      {cons.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                  )}
                  <Button size="sm" variant="outline" onClick={() => { setSenhaDe(senhaDe === m.id ? null : m.id); setSenha(""); }}>Trocar senha</Button>
                  <Button size="sm" variant="outline" onClick={() => void remover(m)}>Remover</Button>
                </span>
              </div>
              {senhaDe === m.id && (
                <div className="flex flex-wrap gap-2">
                  <input className="h-8 w-56 rounded-md border bg-background px-3" placeholder="Nova senha (mín. 6)" value={senha} onChange={(e) => setSenha(e.target.value)} />
                  <Button size="sm" onClick={() => void salvarSenha(m.id)}>Salvar senha</Button>
                </div>
              )}
            </li>
          ))}
          {!rows.length && <li className="py-2 text-muted-foreground">Nenhum usuário encontrado.</li>}
        </ul>
      </div>
    </Box>
  );
}
