import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Box } from "@/components/painel-ui";

type M = { id: string; email: string; papel: string; owner_id: string };

export function Equipe() {
  const [lista, setLista] = useState<M[]>([]);
  const [meu, setMeu] = useState<M | null>(null);
  const [email, setEmail] = useState("");
  const [papel, setPapel] = useState("viewer");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    const { data } = await supabase.from("team_members").select("id,email,papel,owner_id").order("created_at");
    const rows = (data ?? []) as M[];
    setMeu(rows.find((r) => r.email.toLowerCase() === (u.user?.email ?? "").toLowerCase()) ?? null);
    setLista(rows.filter((r) => r.owner_id === u.user?.id));
  }, []);
  useEffect(() => { void load(); }, [load]);

  if (meu) {
    return (
      <Box title="Equipe">
        <p className="text-sm text-muted-foreground">
          Você acessa o painel compartilhado como <b>{meu.papel === "editor" ? "Editor" : "Visualizador"}</b>.
          {meu.papel !== "editor" && " Você pode ver tudo, mas não alterar dados."}
        </p>
      </Box>
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

  return (
    <Box title="Equipe (compartilhar o painel)">
      <p className="mb-3 text-sm text-muted-foreground">
        Cadastre o e-mail de quem pode acessar. A pessoa entra no link com esse e-mail (ou Google) e vê todos os seus dados.
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
        {lista.map((m) => (
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
        {!lista.length && <li className="py-2 text-muted-foreground">Ninguém cadastrado ainda.</li>}
      </ul>
    </Box>
  );
}
