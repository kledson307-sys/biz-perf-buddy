import { useEffect, useState } from "react";
import { Copy, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Box, Tabela, brl, pct, tone } from "@/components/painel-ui";
import { ITENS, naoVende, naoVendeAgregado } from "@/lib/agregados";

export type LinhaEnvio = {
  c: { id: string; nome: string; telefone: string };
  servicos: number; pecas: number; mS: number; mP: number; projS: number; projP: number;
  perfS: number; perfP: number; perf: number; projPct: number; necS: number; necP: number;
};

const digitos = (t: string) => {
  const d = t.replace(/\D/g, "");
  return d.length === 10 || d.length === 11 ? `55${d}` : d;
};

const num = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

export function EnvioWhatsapp({ linhas, lider, liderServ, liderPec, mes, dec, tot, reload }: {
  linhas: LinhaEnvio[]; lider: LinhaEnvio | undefined; liderServ: LinhaEnvio | null; liderPec: LinhaEnvio | null;
  mes: string; dec: number; tot: number; reload: () => void;
}) {
  const [tel, setTel] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");

  const [agg, setAgg] = useState<{ s: { consultant_id: string; item: string; qtd: number }[]; g: { consultant_id: string; item: string; meta_qtd: number }[]; v: { consultant_id: string; passagens: number }[] }>({ s: [], g: [], v: [] });
  const [copiado, setCopiado] = useState("");
  const ids = linhas.map((l) => l.c.id).join(",");
  useEffect(() => {
    const lista = ids ? ids.split(",") : [];
    if (!lista.length) return;
    const [y, m] = mes.split("-").map(Number);
    const fim = `${mes}-${new Date(y!, m!, 0).getDate()}`;
    void Promise.all([
      supabase.from("agg_sales").select("consultant_id,item,qtd").in("consultant_id", lista).gte("dia", `${mes}-01`).lte("dia", fim),
      supabase.from("agg_goals").select("consultant_id,item,meta_qtd").in("consultant_id", lista).eq("mes", mes),
      supabase.from("agg_visits").select("consultant_id,passagens").in("consultant_id", lista).gte("dia", `${mes}-01`).lte("dia", fim),
    ]).then(([as, ag, av]) => setAgg({ s: as.data ?? [], g: ag.data ?? [], v: av.data ?? [] }));
  }, [ids, mes]);

  const dadosAgg = (id: string, nome = "") => {
    const rest = Math.max(tot - dec, 0);
    const passagens = agg.v.filter((v) => v.consultant_id === id).reduce((n, v) => n + Number(v.passagens), 0);
    const agregados = ITENS.map((it) => {
      if (nome && (naoVendeAgregado(nome) || naoVende(it.k, nome))) return null;
      const qtd = agg.s.filter((x) => x.consultant_id === id && x.item === it.k).reduce((n, x) => n + Number(x.qtd), 0);
      const meta = Number(agg.g.find((x) => x.consultant_id === id && x.item === it.k)?.meta_qtd ?? 0);
      return { item: it.nome, grupo: it.g, qtd, meta, proj: dec ? (qtd / dec) * tot : 0, nec: rest ? Math.max(meta - qtd, 0) / rest : 0, aper: passagens ? qtd / passagens : 0 };
    }).filter((x): x is NonNullable<typeof x> => !!x);
    return { passagens, agregados };
  };

  const perfAgg = (id: string, nome = "") => {
    const a = dadosAgg(id, nome).agregados;
    const qtd = a.reduce((n, x) => n + x.qtd, 0);
    const meta = a.reduce((n, x) => n + x.meta, 0);
    return meta ? qtd / meta : 0;
  };
  const liderItem = (nomeItem: string) =>
    linhas.map((x) => {
      const k = ITENS.find((i) => i.nome === nomeItem)?.k ?? "";
      if (naoVendeAgregado(x.c.nome) || naoVende(k, x.c.nome)) return null;
      const a = dadosAgg(x.c.id, x.c.nome).agregados.find((y) => y.item === nomeItem);
      return a ? { id: x.c.id, nome: x.c.nome, qtd: a.qtd, meta: a.meta } : null;
    }).filter((x): x is { id: string; nome: string; qtd: number; meta: number } => !!x && x.meta > 0)
      .sort((a, b) => b.qtd / b.meta - a.qtd / a.meta)[0] ?? null;
  const liderAgg = linhas.filter((x) => !naoVendeAgregado(x.c.nome) && perfAgg(x.c.id, x.c.nome) > 0).sort((a, b) => perfAgg(b.c.id, b.c.nome) - perfAgg(a.c.id, a.c.nome))[0] ?? null;

  // só vendem peças: mensagem sem bloco de serviços (agregados sai pela regra de naoVendeAgregado)
  const SO_PECAS = ["MARCELA.S", "GEOVANA.M", "NAILTON/THIERRY"];
  const montar = (l: LinhaEnvio) => {
    const { passagens, agregados } = dadosAgg(l.c.id, l.c.nome);
    const semServicos = SO_PECAS.includes(l.c.nome);
    const cmp = (ld: LinhaEnvio | null, minha: number, dele: number) =>
      !ld ? "" : ld.c.id === l.c.id ? "🏆 Você é o líder!" : `🏆 Líder: ${ld.c.nome} (${pct(dele)}) · você está ${num((dele - minha) * 100)} pts atrás`;
    const linhasAgg = agregados.map((a) => {
      const li = liderItem(a.item);
      const liderTxt = li ? (li.id === l.c.id ? "👑 você é o líder" : `👑 líder: ${li.nome} (${pct(li.qtd / li.meta)})`) : "";
      return `• ${a.item}: ${num(a.qtd)}${a.meta ? ` de ${num(a.meta)} (${pct(a.qtd / a.meta)}) · proj. ${num(a.proj)} · precisa ${num(Math.ceil(a.nec))}/dia` : " (sem meta)"}${passagens ? ` · aproveit. ${pct(a.aper)}` : ""}${liderTxt ? ` · ${liderTxt}` : ""}`;
    });
    const totAgg = agregados.reduce((n, a) => n + a.qtd, 0);
    const oport = agregados.filter((a) => a.meta > 0 && a.qtd < a.meta).sort((a, b) => a.qtd / a.meta - b.qtd / b.meta)[0];
    return [
      `Olá, ${l.c.nome}! Atualização HAUS MOTORS – ${mes.split("-").reverse().join("/")} (dia ${dec} de ${tot})`,
      "",
      ...(semServicos ? [] : [
        "🔧 *SERVIÇOS*",
        `Realizado: ${brl(l.servicos)} de ${brl(l.mS)} (${pct(l.perfS)})`,
        `Projeção: ${brl(l.projS)} (${pct(l.mS ? l.projS / l.mS : 0)} da meta)`,
        `Precisa vender: ${brl(l.necS)}/dia`,
        cmp(liderServ, l.perfS, liderServ?.perfS ?? 0),
        "",
      ]),
      "🔩 *PEÇAS*",
      `Realizado: ${brl(l.pecas)} de ${brl(l.mP)} (${pct(l.perfP)})`,
      `Projeção: ${brl(l.projP)} (${pct(l.mP ? l.projP / l.mP : 0)} da meta)`,
      `Precisa vender: ${brl(l.necP)}/dia`,
      cmp(liderPec, l.perfP, liderPec?.perfP ?? 0),
      "",
      ...(naoVendeAgregado(l.c.nome) ? [] : [
        "➕ *AGREGADOS*",
        ...linhasAgg,
        passagens ? `Aproveitamento: ${pct(totAgg / passagens)} (${num(totAgg)} itens em ${num(passagens)} passagens)` : "Passagens ainda não lançadas.",
        cmp(liderAgg, perfAgg(l.c.id, l.c.nome), liderAgg ? perfAgg(liderAgg.c.id, liderAgg.c.nome) : 0),
        oport ? `🎯 Oportunidade: ${oport.item} está mais longe da meta (${pct(oport.qtd / oport.meta)}) — foque nele.` : "",
      ]),
    ].filter((x) => x !== undefined && x !== null).join("\n").replace(/\n{3,}/g, "\n\n").trim();
  };

  const copiar = async (l: LinhaEnvio) => {
    await navigator.clipboard.writeText(montar(l));
    setCopiado(l.c.id); setTimeout(() => setCopiado(""), 2000);
  };

  const salvarTel = async (id: string, v: string) => {
    await supabase.from("consultants").update({ telefone: v.trim() }).eq("id", id);
    reload();
  };

  const enviar = (l: LinhaEnvio) => {
    const fone = digitos(tel[l.c.id] ?? l.c.telefone);
    if (fone.length < 12) { setMsg(`Cadastre o celular de ${l.c.nome} com DDD.`); return; }
    setMsg("");
    window.open(`https://wa.me/${fone}?text=${encodeURIComponent(montar(l))}`, "_blank");
  };

  return (
    <Box title="Enviar atualização por WhatsApp">
      <div className="print:hidden">
        <p className="mb-4 text-sm text-muted-foreground">Cadastre o celular com DDD. Ao clicar em Enviar, o WhatsApp abre com a mensagem pronta — é só apertar enviar. Nenhum crédito é gasto.</p>
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
                <Button size="sm" onClick={() => enviar(l)}><MessageCircle />Enviar</Button>
              </td>
            </tr>
          ))}
        </Tabela>
        {msg && <p role="status" className="mt-3 text-sm text-muted-foreground">{msg}</p>}
      </div>
      <h3 className="mb-3 mt-6 font-semibold">Mensagens prontas</h3>
      <div className="grid gap-4 md:grid-cols-2">
        {linhas.map((l) => (
          <div key={l.c.id} className="rounded-lg border border-border bg-card p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="font-semibold">{l.c.nome}</span>
              <Button size="sm" variant="outline" onClick={() => void copiar(l)}><Copy />{copiado === l.c.id ? "Copiado!" : "Copiar"}</Button>
            </div>
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap font-sans text-sm text-muted-foreground">{montar(l)}</pre>
          </div>
        ))}
      </div>
    </Box>
  );
}
