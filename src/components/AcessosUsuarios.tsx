import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Box } from "@/components/painel-ui";
import { ACCESS_UPDATED } from "@/hooks/use-access-presence";

type Row = { email: string; dia: string; ultimo_at: string; vezes: number };
const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Frequência de acesso de cada usuário (registrada uma linha por dia ao abrir o painel). */
export function AcessosUsuarios() {
  const [rows, setRows] = useState<Row[]>([]);
  const [membros, setMembros] = useState<{ email: string; papel: string }[]>([]);
  const [erro, setErro] = useState(false);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      if (document.visibilityState !== "visible") return;
      const desde = new Date(); desde.setDate(desde.getDate() - 30);
      try {
        const [a, m] = await Promise.all([
          supabase.from("access_log").select("email,dia,ultimo_at,vezes").gte("dia", iso(desde)),
          supabase.from("team_members").select("email,papel"),
        ]);
        if (!active) return;
        if (a.error || m.error) { setErro(true); return; }
        setErro(false); setRows(a.data ?? []); setMembros(m.data ?? []);
      } catch { if (active) setErro(true); }
    };
    const update = () => { void refresh(); };
    update();
    window.addEventListener("focus", update);
    window.addEventListener(ACCESS_UPDATED, update);
    document.addEventListener("visibilitychange", update);
    const timer = window.setInterval(update, 60_000);
    return () => {
      active = false;
      window.removeEventListener("focus", update);
      window.removeEventListener(ACCESS_UPDATED, update);
      document.removeEventListener("visibilitychange", update);
      window.clearInterval(timer);
    };
  }, []);

  const hoje = new Date();
  const seg = new Date(hoje); seg.setDate(hoje.getDate() - ((hoje.getDay() + 6) % 7));
  const semana = Array.from({ length: 7 }, (_, k) => { const d = new Date(seg); d.setDate(seg.getDate() + k); return iso(d); });
  const emails = [...new Set([...membros.map((m) => m.email.toLowerCase()), ...rows.map((r) => r.email)])];
  const lista = emails.map((e) => {
    const r = rows.filter((x) => x.email === e);
    const dias = semana.filter((d) => r.some((x) => x.dia === d));
    const ultimo = r.map((x) => x.ultimo_at).sort().pop();
    const inativo = !ultimo ? 99 : Math.floor((Date.now() - Date.parse(ultimo)) / 86400e3);
    return { e, papel: membros.find((m) => m.email.toLowerCase() === e)?.papel ?? "gestor", dias, mes: r.length, ultimo, inativo };
  }).sort((a, b) => b.dias.length - a.dias.length || b.mes - a.mes);
  const nome = (e: string) => e.split("@")[0];

  return (
    <Box title="Frequência de acesso dos usuários">
      <div className="space-y-3 p-4 text-sm">
        {erro && <p role="alert" className="text-destructive">Não foi possível atualizar a frequência. Tentaremos novamente.</p>}
        {lista[0] && lista[0].dias.length > 0 && <p>Quem mais acessa nesta semana: <b>{nome(lista[0].e)}</b> ({lista[0].dias.length} dia(s): {lista[0].dias.map((d) => DIAS[new Date(d + "T12:00").getDay()]).join(", ")}).</p>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs uppercase text-muted-foreground">
              <tr><th className="px-2 py-2 text-left">Usuário</th>{semana.map((d) => <th key={d} className="px-1 py-2">{DIAS[new Date(d + "T12:00").getDay()]}</th>)}<th className="px-2 py-2">Semana</th><th className="px-2 py-2">30 dias</th><th className="px-2 py-2 text-left">Último acesso</th></tr>
            </thead>
            <tbody>
              {lista.map((u) => (
                <tr key={u.e} className="border-t border-border">
                  <td className="px-2 py-2"><b>{nome(u.e)}</b> <span className="text-xs text-muted-foreground">{u.papel}</span></td>
                  {semana.map((d) => <td key={d} className="px-1 py-2 text-center">{u.dias.includes(d) ? <span className="text-success">●</span> : <span className="text-muted-foreground">·</span>}</td>)}
                  <td className="px-2 py-2 text-center font-semibold">{u.dias.length}</td>
                  <td className="px-2 py-2 text-center">{u.mes}</td>
                  <td className={`px-2 py-2 ${u.inativo >= 5 ? "text-destructive" : ""}`}>{u.ultimo ? new Date(u.ultimo).toLocaleString("pt-BR") : "nunca acessou"}{u.ultimo && u.inativo >= 5 && ` · ${u.inativo} dias sem entrar`}</td>
                </tr>
              ))}
              {!lista.length && <tr><td colSpan={11} className="px-2 py-4 text-muted-foreground">Nenhum acesso registrado ainda.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">Os acessos começam a ser contados a partir de hoje. Em vermelho: 5 dias ou mais sem entrar.</p>
      </div>
    </Box>
  );
}
