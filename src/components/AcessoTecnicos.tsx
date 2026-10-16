import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Box } from "@/components/painel-ui";
import { criarAcessoVendedor } from "@/lib/vendedores.functions";

type M = { id: string; email: string; papel: string; tecnico_nome?: string | null };
const OCULTOS = ["VINICIUS", "DELMIR", "LUIS SANDRO"];

/** Dono cria login para cada técnico ver só o próprio desempenho. */
export function AcessoTecnicos({ lista, onChange }: { lista: M[]; onChange: () => void }) {
  const [nomes, setNomes] = useState<string[]>([]);
  const [tec, setTec] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [msg, setMsg] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [vinc, setVinc] = useState<Record<string, string>>({});
  const criar = useServerFn(criarAcessoVendedor);

  useEffect(() => {
    supabase.from("mech_month").select("nome").then(({ data }) => {
      const s = new Set((data ?? []).map((r) => r.nome.toUpperCase()).filter((n) => !OCULTOS.includes(n)));
      setNomes([...s].sort());
    });
    supabase.from("team_members").select("id,tecnico_nome").eq("papel", "tecnico").then(({ data }) => {
      setVinc(Object.fromEntries((data ?? []).map((r) => [r.id, r.tecnico_nome ?? ""])));
    });
  }, [lista]);

  const tecnicos = lista.filter((m) => m.papel === "tecnico");
  const salvar = async () => {
    setMsg("");
    if (!tec) return setMsg("Escolha o técnico.");
    setSalvando(true);
    try {
      await criar({ data: { tecnicoNome: tec, email, senha } });
      setMsg(`Pronto! Passe para o técnico: e-mail ${email.trim().toLowerCase()} e a senha que você criou.`);
      setTec(""); setEmail(""); setSenha("");
      onChange();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Não foi possível criar o acesso.");
    } finally { setSalvando(false); }
  };

  return (
    <Box title="Acesso dos técnicos (cada um vê só o seu desempenho)">
      <div className="p-5">
        <p className="mb-3 text-sm text-muted-foreground">
          Crie usuário e senha para cada técnico. Ao entrar, ele vê só o próprio faturamento de serviços e peças, passagens, metas, projeção e a posição no grupo (Carro ou Moto), sem os valores dos colegas. Para trocar a senha, crie de novo com o mesmo e-mail.
        </p>
        <div className="flex flex-wrap gap-2">
          <select className="h-9 rounded-md border bg-background px-2 text-sm" value={tec} onChange={(e) => setTec(e.target.value)}>
            <option value="">Técnico…</option>
            {nomes.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <input className="h-9 flex-1 rounded-md border bg-background px-3 text-sm" placeholder="e-mail do técnico" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="h-9 w-40 rounded-md border bg-background px-3 text-sm" type="password" placeholder="senha" value={senha} onChange={(e) => setSenha(e.target.value)} />
          <Button onClick={salvar} disabled={salvando}>{salvando ? "Criando…" : "Criar acesso"}</Button>
        </div>
        {msg && <p className="mt-2 text-sm">{msg}</p>}
        <ul className="mt-4 divide-y text-sm">
          {tecnicos.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-2 py-2">
              <span>{m.email} · <b>{vinc[m.id] || "—"}</b></span>
              <Button size="sm" variant="outline" onClick={async () => { await supabase.from("team_members").delete().eq("id", m.id); onChange(); }}>Remover</Button>
            </li>
          ))}
          {!tecnicos.length && <li className="py-2 text-muted-foreground">Nenhum técnico com acesso ainda.</li>}
        </ul>
      </div>
    </Box>
  );
}
