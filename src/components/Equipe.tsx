import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Box } from "@/components/painel-ui";
import { criarAcessoVendedor } from "@/lib/vendedores.functions";
import { UsuariosAdmin } from "@/components/UsuariosAdmin";
import { AcessoTecnicos } from "@/components/AcessoTecnicos";
import { AcessosUsuarios } from "@/components/AcessosUsuarios";

type M = { id: string; email: string; papel: string; owner_id: string; consultant_id: string | null };
type C = { id: string; nome: string };

export function Equipe() {
  const [lista, setLista] = useState<M[]>([]);
  const [meu, setMeu] = useState<M | null>(null);
  const [cons, setCons] = useState<C[]>([]);
  const [email, setEmail] = useState("");
  const [papel, setPapel] = useState("viewer");
  const [msg, setMsg] = useState("");
  const [vCons, setVCons] = useState("");
  const [vEmail, setVEmail] = useState("");
  const [vSenha, setVSenha] = useState("");
  const [vMsg, setVMsg] = useState("");
  const [salvando, setSalvando] = useState(false);
  const criar = useServerFn(criarAcessoVendedor);

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    const [{ data }, { data: c }] = await Promise.all([
      supabase.from("team_members").select("id,email,papel,owner_id,consultant_id").order("created_at"),
      supabase.from("consultants").select("id,nome").order("nome"),
    ]);
    const rows = (data ?? []) as M[];
    setMeu(rows.find((r) => r.email.toLowerCase() === (u.user?.email ?? "").toLowerCase()) ?? null);
    setLista(rows.filter((r) => r.owner_id === u.user?.id));
    setCons(c ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);

  if (meu) {
    return (
      <div className="space-y-4">
        {meu.papel === "editor" && <AcessosUsuarios />}
        <Box title="Equipe">
          <p className="p-5 text-sm text-muted-foreground">
            Você acessa o painel compartilhado como <b>{meu.papel === "editor" ? "Editor" : "Visualizador"}</b>.
            {meu.papel !== "editor" && " Você pode ver tudo, mas não alterar dados."}
          </p>
        </Box>
      </div>
    );
  }

  const add = async () => {
    const e = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(e)) return setMsg("E-mail inválido.");
    const { error } = await supabase.from("team_members").insert({ email: e, papel });
    setMsg(error ? (error.code === "23505" ? "Esse e-mail já está em uma equipe." : "Não foi possível adicionar.") : "Adicionado! Peça para a pessoa entrar no link com esse e-mail.");
    if (!error) setEmail("");
    void load();
  };

  const addVendedor = async () => {
    setVMsg("");
    if (!vCons) return setVMsg("Escolha o vendedor.");
    setSalvando(true);
    try {
      await criar({ data: { consultantId: vCons, email: vEmail, senha: vSenha } });
      setVMsg(`Pronto! Passe para o vendedor: e-mail ${vEmail.trim().toLowerCase()} e a senha que você criou.`);
      setVEmail(""); setVSenha(""); setVCons("");
      void load();
    } catch (e) {
      setVMsg(e instanceof Error ? e.message : "Não foi possível criar o acesso.");
    } finally { setSalvando(false); }
  };

  const nomeCons = (id: string | null) => cons.find((c) => c.id === id)?.nome ?? "—";
  const gestores = lista.filter((m) => m.papel !== "vendedor" && m.papel !== "tecnico");
  const vendedores = lista.filter((m) => m.papel === "vendedor");

  return (
    <div className="space-y-4">
      <AcessosUsuarios />
      <UsuariosAdmin lista={lista} cons={cons} onChange={() => void load()} />
      <AcessoTecnicos lista={lista} onChange={() => void load()} />
      <Box title="Acesso dos vendedores (cada um vê só a sua performance)">
        <div className="p-5">
          <p className="mb-3 text-sm text-muted-foreground">
            Crie um usuário e senha para cada vendedor. Ao entrar, ele vê apenas os próprios números: serviços, peças, margem, agregados e a posição no ranking (sem os valores dos colegas).
            Para trocar a senha, crie de novo com o mesmo e-mail.
          </p>
          <div className="flex flex-wrap gap-2">
            <select className="h-9 rounded-md border bg-background px-2 text-sm" value={vCons} onChange={(e) => setVCons(e.target.value)}>
              <option value="">Vendedor…</option>
              {cons.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
            <input className="h-9 flex-1 rounded-md border bg-background px-3 text-sm" placeholder="email@exemplo.com" value={vEmail} onChange={(e) => setVEmail(e.target.value)} />
            <input className="h-9 w-40 rounded-md border bg-background px-3 text-sm" placeholder="Senha (mín. 6)" value={vSenha} onChange={(e) => setVSenha(e.target.value)} />
            <Button onClick={addVendedor} disabled={salvando}>{salvando ? "Salvando…" : "Criar acesso"}</Button>
          </div>
          {vMsg && <p className="mt-2 text-sm">{vMsg}</p>}
          <ul className="mt-4 divide-y text-sm">
            {vendedores.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 py-2">
                <span><b>{nomeCons(m.consultant_id)}</b> · {m.email}</span>
                <Button size="sm" variant="outline" onClick={async () => { await supabase.from("team_members").delete().eq("id", m.id); void load(); }}>Remover acesso</Button>
              </li>
            ))}
            {!vendedores.length && <li className="py-2 text-muted-foreground">Nenhum vendedor com acesso ainda.</li>}
          </ul>
        </div>
      </Box>

      <Box title="Equipe de gestão (compartilhar o painel inteiro)">
        <div className="p-5">
          <p className="mb-3 text-sm text-muted-foreground">
            Cadastre o e-mail de quem pode acessar tudo. A pessoa entra no link com esse e-mail (ou Google) e vê todos os seus dados.
            <b> Visualizador</b> só vê; <b>Editor</b> também importa e lança dados.
          </p>
          <div className="flex flex-wrap gap-2">
            <input className="h-9 flex-1 rounded-md border bg-background px-3 text-sm" placeholder="email@exemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <select className="h-9 rounded-md border bg-background px-2 text-sm" value={papel} onChange={(e) => setPapel(e.target.value)}>
              <option value="viewer">Visualizador</option>
              <option value="editor">Editor</option>
            </select>
            <Button onClick={add}>Adicionar</Button>
          </div>
          {msg && <p className="mt-2 text-sm">{msg}</p>}
          <ul className="mt-4 divide-y text-sm">
            {gestores.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 py-2">
                <span>{m.email}</span>
                <span className="flex items-center gap-2">
                  <select className="h-8 rounded-md border bg-background px-2" value={m.papel} onChange={async (e) => { await supabase.from("team_members").update({ papel: e.target.value }).eq("id", m.id); void load(); }}>
                    <option value="viewer">Visualizador</option>
                    <option value="editor">Editor</option>
                  </select>
                  <Button size="sm" variant="outline" onClick={async () => { await supabase.from("team_members").delete().eq("id", m.id); void load(); }}>Remover</Button>
                </span>
              </li>
            ))}
            {!gestores.length && <li className="py-2 text-muted-foreground">Ninguém cadastrado ainda.</li>}
          </ul>
        </div>
      </Box>
    </div>
  );
}
