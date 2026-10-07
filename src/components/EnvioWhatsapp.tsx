import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Box, Tabela, brl, pct, tone } from "@/components/painel-ui";
import { dicaWhatsapp } from "@/lib/whatsapp-ia.functions";
import { ITENS } from "@/lib/agregados";

export type LinhaEnvio = {
  c: { id: string; nome: string; telefone: string };
  servicos: number; pecas: number; mS: number; mP: number; projS: number; projP: number;
  perfS: number; perfP: number; perf: number; projPct: number; necS: number; necP: number;
};

const digitos = (t: string) => {
  const d = t.replace(/\D/g, "");
  return d.length === 10 || d.length === 11 ? `55${d}` : d;
};

const bloco = (txt: string, tag: string) => txt.match(new RegExp(`\\[${tag}\\]([\\s\\S]*?)(?=\\n?\\[[A-Z]+\\]|$)`))?.[1]?.trim() ?? "";
const num = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

export function EnvioWhatsapp({ linhas, lider, liderServ, liderPec, mes, dec, tot, reload }: {
  linhas: LinhaEnvio[]; lider: LinhaEnvio | undefined; liderServ: LinhaEnvio | null; liderPec: LinhaEnvio | null;
  mes: string; dec: number; tot: number; reload: () => void;
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
    const [y, m] = mes.split("-").map(Number);
    const fim = `${mes}-${new Date(y!, m!, 0).getDate()}`;
    const [as, ag, av] = await Promise.all([
      supabase.from("agg_sales").select("item,qtd").eq("consultant_id", l.c.id).gte("dia", `${mes}-01`).lte("dia", fim),
      supabase.from("agg_goals").select("item,meta_qtd").eq("consultant_id", l.c.id).eq("mes", mes),
      supabase.from("agg_visits").select("passagens").eq("consultant_id", l.c.id).gte("dia", `${mes}-01`).lte("dia", fim),
    ]);
    const rest = Math.max(tot - dec, 0);
    const passagens = (av.data ?? []).reduce((n, v) => n + Number(v.passagens), 0);
    const agregados = ITENS.map((it) => {
      const qtd = (as.data ?? []).filter((x) => x.item === it.k).reduce((n, x) => n + Number(x.qtd), 0);
      const meta = Number((ag.data ?? []).find((x) => x.item === it.k)?.meta_qtd ?? 0);
      return { item: it.nome, grupo: it.g, qtd, meta, proj: dec ? (qtd / dec) * tot : 0, nec: rest ? Math.max(meta - qtd, 0) / rest : 0, aper: passagens ? qtd / passagens : 0 };
    });
    const r = await gerar({ data: {
      nome: l.c.nome, mes, dec, tot, servicos: l.servicos, pecas: l.pecas, mS: l.mS, mP: l.mP,
      projS: l.projS, projP: l.projP, perfS: l.perfS, perfP: l.perfP, projPct: l.projPct,
      necS: l.necS, necP: l.necP, liderServ: liderServ?.c.nome ?? "", liderPerfS: liderServ?.perfS ?? 0,
      liderPec: liderPec?.c.nome ?? "", liderPerfP: liderPec?.perfP ?? 0, passagens, agregados,
    } }).catch(() => ({ ok: false as const, mensagem: "Não foi possível gerar as dicas." }));
    setBusy("");
    const ia = r.ok ? r.texto : "";
    const cmp = (ld: LinhaEnvio | null, minha: number, dele: number) =>
      !ld ? "" : ld.c.id === l.c.id ? "🏆 Você é o líder!" : `🏆 Líder: ${ld.c.nome} (${pct(dele)}) · você está ${num((dele - minha) * 100)} pts atrás`;
    const dicas = (tag: string) => { const t = bloco(ia, tag); return t ? ["💡 Sugestões:", t] : []; };
    const linhasAgg = agregados.map((a) =>
      `• ${a.item}: ${num(a.qtd)}${a.meta ? ` de ${num(a.meta)} (${pct(a.qtd / a.meta)}) · proj. ${num(a.proj)} · precisa ${num(Math.ceil(a.nec))}/dia` : " (sem meta)"}${passagens ? ` · aproveit. ${pct(a.aper)}` : ""}`);
    const totAgg = agregados.reduce((n, a) => n + a.qtd, 0);
    const oport = agregados.filter((a) => a.meta > 0 && a.qtd < a.meta).sort((a, b) => a.qtd / a.meta - b.qtd / b.meta)[0];
    const texto = [
      `Olá, ${l.c.nome}! Atualização HAUS MOTORS – ${mes.split("-").reverse().join("/")} (dia ${dec} de ${tot})`,
      "",
      "🔧 *SERVIÇOS*",
      `Realizado: ${brl(l.servicos)} de ${brl(l.mS)} (${pct(l.perfS)})`,
      `Projeção: ${brl(l.projS)} (${pct(l.mS ? l.projS / l.mS : 0)} da meta)`,
      `Precisa vender: ${brl(l.necS)}/dia`,
      cmp(liderServ, l.perfS, liderServ?.perfS ?? 0),
      ...dicas("SERVICOS"),
      "",
      "🔩 *PEÇAS*",
      `Realizado: ${brl(l.pecas)} de ${brl(l.mP)} (${pct(l.perfP)})`,
      `Projeção: ${brl(l.projP)} (${pct(l.mP ? l.projP / l.mP : 0)} da meta)`,
      `Precisa vender: ${brl(l.necP)}/dia`,
      cmp(liderPec, l.perfP, liderPec?.perfP ?? 0),
      ...dicas("PECAS"),
      "",
      "➕ *AGREGADOS*",
      ...linhasAgg,
      passagens ? `Aproveitamento: ${pct(totAgg / passagens)} (${num(totAgg)} itens em ${num(passagens)} passagens)` : "Passagens ainda não lançadas.",
      oport ? `🎯 Oportunidade: ${oport.item} está mais longe da meta (${pct(oport.qtd / oport.meta)}) — foque nele.` : "",
      ...dicas("AGREGADOS"),
    ].filter((x) => x !== undefined && x !== null).join("\n").replace(/\n{3,}/g, "\n\n").trim();
    if (!r.ok) setMsg(`${r.mensagem} A mensagem foi aberta sem as sugestões.`);
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
