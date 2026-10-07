import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Box, Tabela, brl, pct, tone } from "@/components/painel-ui";
import { dicaWhatsapp } from "@/lib/whatsapp-ia.functions";

export type LinhaEnvio = {
  c: { id: string; nome: string; telefone: string };
  servicos: number; pecas: number; mS: number; mP: number; projS: number; projP: number;
  perfS: number; perfP: number; perf: number; projPct: number; necS: number; necP: number;
};

const digitos = (t: string) => {
  const d = t.replace(/\D/g, "");
  return d.length === 10 || d.length === 11 ? `55${d}` : d;
};

export function EnvioWhatsapp({ linhas, lider, mes, dec, tot, reload }: {
  linhas: LinhaEnvio[]; lider: LinhaEnvio | undefined; mes: string; dec: number; tot: number; reload: () => void;
}) {
  const gerar = useServerFn(dicaWhatsapp);
  const [tel, setTel] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string>("");
  const [msg, setMsg] = useState("");

  const salvarTel = async (id: string, v: string) => {
    await supabase.from("consultants").update({ telefone: v.trim() }).eq("id", id);
    reload();
  };

  const enviar = async (l: LinhaEnvio) => {
    const fone = digitos(tel[l.c.id] ?? l.c.telefone);
    if (fone.length < 12) { setMsg(`Cadastre o celular de ${l.c.nome} com DDD.`); return; }
    const janela = window.open("", "_blank");
    setBusy(l.c.id); setMsg("");
    const r = await gerar({ data: {
      nome: l.c.nome, mes, dec, tot, servicos: l.servicos, pecas: l.pecas, mS: l.mS, mP: l.mP,
      projS: l.projS, projP: l.projP, perfS: l.perfS, perfP: l.perfP, projPct: l.projPct,
      necS: l.necS, necP: l.necP, lider: lider?.c.nome ?? "", liderPerf: lider?.perf ?? 0,
    } }).catch(() => ({ ok: false as const, mensagem: "Não foi possível gerar as dicas." }));
    setBusy("");
    const texto = [
      `Olá, ${l.c.nome}! Atualização HAUS MOTORS – ${mes.split("-").reverse().join("/")} (dia ${dec} de ${tot})`,
      "",
      `🔧 Serviços: ${brl(l.servicos)} de ${brl(l.mS)} (${pct(l.perfS)})`,
      `   Projeção: ${brl(l.projS)} · precisa ${brl(l.necS)}/dia`,
      `🔩 Peças: ${brl(l.pecas)} de ${brl(l.mP)} (${pct(l.perfP)})`,
      `   Projeção: ${brl(l.projP)} · precisa ${brl(l.necP)}/dia`,
      `📈 Projeção total: ${pct(l.projPct)} da meta`,
      lider && lider.c.id !== l.c.id ? `🏆 Líder: ${lider.c.nome} (${pct(lider.perf)}). Você: ${pct(l.perf)}` : "🏆 Você é o líder do mês!",
      "",
      r.ok ? `Recomendações:\n${r.texto}` : "",
    ].filter((x, i, a) => x !== "" || a[i - 1] !== "").join("\n").trim();
    if (!r.ok) setMsg(`${r.mensagem} A mensagem foi aberta sem as recomendações.`);
    const url = `https://wa.me/${fone}?text=${encodeURIComponent(texto)}`;
    if (janela) janela.location.href = url; else window.open(url, "_blank");
  };

  return (
    <Box title="Enviar atualização por WhatsApp">
      <p className="mb-4 text-sm text-muted-foreground">Cadastre o celular com DDD. Ao clicar em Enviar, a IA escreve as recomendações e o WhatsApp abre com a mensagem pronta — é só apertar enviar.</p>
      <Tabela head={["Consultor", "Celular", "Perf.", "Projeção", ""]}>
        {linhas.map((l) => (
          <tr key={l.c.id} className="border-t border-border">
            <td className="px-3 py-2 font-medium">{l.c.nome}</td>
            <td className="px-3 py-2">
              <input aria-label={`Celular de ${l.c.nome}`} inputMode="tel" placeholder="(71) 99999-9999"
                value={tel[l.c.id] ?? l.c.telefone} onChange={(e) => setTel({ ...tel, [l.c.id]: e.target.value })}
                onBlur={(e) => { if (e.target.value !== l.c.telefone) void salvarTel(l.c.id, e.target.value); }}
                className="w-44 rounded-md border border-input bg-background px-3 py-1.5 text-sm" />
            </td>
            <td className={`px-3 py-2 font-semibold ${tone(l.perf)}`}>{pct(l.perf)}</td>
            <td className={`px-3 py-2 ${tone(l.projPct)}`}>{pct(l.projPct)}</td>
            <td className="px-3 py-2">
              <Button size="sm" disabled={busy !== ""} onClick={() => void enviar(l)}>
                {busy === l.c.id ? <><Sparkles />Gerando…</> : <><MessageCircle />Enviar</>}
              </Button>
            </td>
          </tr>
        ))}
      </Tabela>
      {msg && <p role="status" className="mt-3 text-sm text-muted-foreground">{msg}</p>}
    </Box>
  );
}
