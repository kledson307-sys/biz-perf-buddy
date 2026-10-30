import { useCallback, useEffect, useRef, useState } from "react";
import { useAccessPresence } from "@/hooks/use-access-presence";
import { RetornosVendedor } from "@/components/RetornosVendedor";
import { NpsResumoRestrito } from "@/components/NpsPainel";
import { Notificacoes } from "@/components/Notificacoes";
import { supabase } from "@/integrations/supabase/client";
import { Box, Kpi, brl, div, pct, tone, uni } from "@/components/painel-ui";
import { ITENS } from "@/lib/agregados";
import { Button } from "@/components/ui/button";
import { AcessoTopo } from "@/components/AcessoTopo";
import { Anel } from "@/components/Cockpit";

type Agg = { item: string; qtd: number; valor: number; meta_qtd: number; codigos?: { codigo: string; qtd: number; valor: number }[] };
type Dados = {
  nome: string; departamento: string | null; servicos: number; pecas: number; margem: number;
  meta_servicos: number; meta_pecas: number; posicao: number | null; participantes: number; perf_lider: number | null;
  params: { du_totais: number; du_decorridos: number; dc_totais: number; dc_decorridos: number; base: string } | null;
  passagens: number; agregados: Agg[];
};

const IDEAL: Record<string, number> = { "SG OFICINA": 0.33, "ESTETICA": 0.38, "ACESSORIOS": 0.31, "BALCAO": 0.31, "SC FUNILARIA": 0.24 };
const semAcento = (s: string) => s.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

/** Tela da vendedora: só os números dela, posição no ranking e distância do líder. */
type Agend = { id: string; data: string; hora: string | null; cliente: string | null; placa: string | null; categoria: string; segmento: string; tipo: string; status: string | null; servico: string | null };

export function MinhaPerformance() {
  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7));
  const [d, setD] = useState<Dados | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [aba, setAba] = useState<"dash" | "detalhes">("dash");
  const [agenda, setAgenda] = useState<Agend[]>([]);
  const latestMonth = useRef(mes);
  latestMonth.current = mes;
  const load = useCallback(async () => {
    const month = latestMonth.current;
    setErro("");
    try {
      const [{ data, error }, ag] = await Promise.all([
        supabase.rpc("minha_performance", { p_mes: month }),
        supabase.rpc("meus_agendamentos", { p_mes: month }),
      ]);
      if (month !== latestMonth.current) return;
      if (error) setErro("Não foi possível carregar seus dados.");
      else setD(data as unknown as Dados);
      setAgenda((ag.data ?? []) as unknown as Agend[]);
    } catch {
      setErro("Não foi possível carregar seus dados.");
    }
  }, []);
  const { status: presenceStatus, confirmedAt, register } = useAccessPresence(true, load);
  useEffect(() => { void register(); }, [mes, register]);

  const p = d?.params;
  const uteis = (p?.base ?? "uteis") === "uteis";
  const dec = Math.max(1, uteis ? p?.du_decorridos ?? 1 : p?.dc_decorridos ?? 1);
  const tot = Math.max(dec, uteis ? p?.du_totais ?? 22 : p?.dc_totais ?? 30);
  const rest = Math.max(1, tot - dec);
  const proj = (v: number) => (v / dec) * tot;
  const sv = +(d?.servicos ?? 0), pc = +(d?.pecas ?? 0), ms = +(d?.meta_servicos ?? 0), mp = +(d?.meta_pecas ?? 0);
  const perf = div(sv + pc, ms + mp);
  const ideal = IDEAL[semAcento(d?.departamento ?? "")] ?? 0.31;
  const margem = div(+(d?.margem ?? 0), pc);

  const rosa = (d?.nome ?? "").toUpperCase().startsWith("ANDRESSA");
  const hoje = new Date().toISOString().slice(0, 10);
  const amanha = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
  const agendaD1 = agenda.filter((a) => a.tipo === "d1" && a.data >= hoje);
  const agendaDia = agenda.filter((a) => a.tipo === "d0" && a.data === hoje);

  return (
    <div className={`min-h-screen bg-background p-4 md:p-8${rosa ? " tema-rosa" : ""}`}>
      <div className="mx-auto max-w-5xl space-y-4">
        <AcessoTopo titulo="Minha performance" sub={`${d?.nome ?? ""}${d?.departamento ? ` · ${d.departamento}` : ""}`} mes={mes} setMes={setMes}
          extra={<Notificacoes vendedor abrir={() => document.getElementById("retornos-vendedor")?.scrollIntoView({ behavior: "smooth", block: "start" })} />} />
        <div className="flex gap-2" role="tablist" aria-label="Visões">
          {([["dash", "Dashboard"], ["detalhes", "Detalhes"]] as const).map(([k, rot]) => (
            <button key={k} role="tab" aria-selected={aba === k} onClick={() => setAba(k)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${aba === k ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>{rot}</button>
          ))}
        </div>
        {aba === "dash" && d && (
          <section className="lux-card flex flex-wrap items-center justify-around gap-4 p-4">
            <Anel p={perf} rot="Performance" />
            {ms > 0 && <Anel p={div(proj(sv), ms)} rot="Projeção serviços" />}
            {mp > 0 && <Anel p={div(proj(pc), mp)} rot="Projeção peças" />}
            <div className="text-sm">
              <p className="text-muted-foreground">Faturado no mês</p><p className="text-2xl font-bold">{brl(sv + pc)}</p>
              <p className="text-xs text-muted-foreground">Dia {uni(dec)} de {uni(tot)} · {uni(rest)} restantes</p>
            </div>
          </section>
        )}
        <div role="status" aria-live="polite" className="flex flex-wrap items-center gap-2 text-xs">
          {presenceStatus === "confirmed" && confirmedAt ? <span className="text-success">✅ Presença confirmada · {confirmedAt.toLocaleString("pt-BR")}</span> : null}
          {presenceStatus === "pending" && <span className="text-muted-foreground">Confirmando presença…</span>}
          {presenceStatus === "error" && <><span className="text-destructive">Presença não confirmada. Tentaremos novamente.</span><Button size="sm" variant="outline" onClick={() => { void register(); }}>Tentar novamente</Button></>}
        </div>
        {aba === "detalhes" && <RetornosVendedor />}
        {aba === "detalhes" && <NpsResumoRestrito titulo="Meu NPS & clientes para encantar" />}
        {erro && <p className="text-sm text-destructive">{erro}</p>}
        {aba === "dash" && d && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              {ms > 0 || sv > 0 ? (
                <Kpi label="Serviços" value={brl(sv)} sub={<span>Meta {brl(ms)} · <b className={tone(div(sv, ms))}>{pct(div(sv, ms))}</b><br />Projeção {brl(proj(sv))} ({pct(div(proj(sv), ms))})<br />Precisa por dia {brl(Math.max(0, ms - sv) / rest)}</span>} />
              ) : null}
              <Kpi label="Peças" value={brl(pc)} sub={<span>Meta {brl(mp)} · <b className={tone(div(pc, mp))}>{pct(div(pc, mp))}</b><br />Projeção {brl(proj(pc))} ({pct(div(proj(pc), mp))})<br />Precisa por dia {brl(Math.max(0, mp - pc) / rest)}</span>} />
              <Kpi label="Margem de peças" value={pc ? pct(margem) : "—"} sub={<span>Ideal do departamento {pct(ideal)}{pc ? <> · <b className={tone(div(margem, ideal))}>{margem >= ideal ? "na média ou acima" : "abaixo do ideal"}</b></> : null}</span>} />
              <Kpi label="Posição no ranking" value={d.posicao ? `${d.posicao}º de ${d.participantes}` : "—"} sub={<span>Sua performance <b className={tone(perf)}>{pct(perf)}</b>{d.perf_lider ? <> · líder {pct(+d.perf_lider)}{d.posicao !== 1 ? ` (faltam ${pct(Math.max(0, +d.perf_lider - perf))})` : " — você é a líder!"}</> : null}</span>} />
            </div>
            {aba === "dash" && (
              <Box title="Meus agendamentos">
                <div className="divide-y text-sm">
                  <p className="px-5 py-2 text-xs text-muted-foreground">Clientes agendados com você — agenda de amanhã (D+1) e de hoje.</p>
                  {agendaD1.length === 0 && agendaDia.length === 0 && <p className="px-5 py-3 text-muted-foreground">Nenhum agendamento seu neste mês. A agenda é alimentada na aba Importações.</p>}
                  {agendaD1.length > 0 && <p className="bg-muted/40 px-5 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Amanhã · {uni(agendaD1.length)}</p>}
                  {agendaD1.map((a) => (
                    <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5">
                      <span><b>{a.hora ?? "—"}</b> · {a.cliente ?? "Cliente"} <span className="text-muted-foreground">· {a.placa ?? "sem placa"}</span></span>
                      <span className="text-xs text-muted-foreground">{a.categoria} · {a.segmento}</span>
                    </div>
                  ))}
                  {agendaDia.length > 0 && <p className="bg-muted/40 px-5 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Hoje · {uni(agendaDia.length)}</p>}
                  {agendaDia.map((a) => (
                    <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5">
                      <span><b>{a.hora ?? "—"}</b> · {a.cliente ?? "Cliente"} <span className="text-muted-foreground">· {a.placa ?? "sem placa"}</span></span>
                      <span className="text-xs text-muted-foreground">{a.categoria} · {a.status ?? "—"}</span>
                    </div>
                  ))}
                </div>
              </Box>
            )}
          </>
        )}
        {aba === "detalhes" && d && (
          <>
            {d.agregados.length > 0 && (
              <Box title="Agregados">
                <div className="divide-y text-sm">
                  {d.agregados.map((a) => {
                    const nome = ITENS.find((i) => i.k === a.item)?.nome ?? a.item;
                    const pf = div(+a.qtd, +a.meta_qtd);
                    return (
                      <div key={a.item} className="px-5 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <button type="button" onClick={() => setAberto(aberto === a.item ? null : a.item)} className="font-medium underline decoration-dotted underline-offset-2" aria-expanded={aberto === a.item}>{nome} {aberto === a.item ? "▴" : "▾"}</button>
                          <span>{uni(+a.qtd)} / meta {uni(+a.meta_qtd)} · <b className={tone(pf)}>{pct(pf)}</b> · {brl(+a.valor)} · aproveitamento {div(+a.qtd, +d.passagens).toFixed(1).replace(".", ",")} un./passagem</span>
                        </div>
                        {aberto === a.item && (
                          <ul className="mt-2 space-y-1 rounded-md bg-muted/50 p-3 text-xs">
                            {(a.codigos ?? []).length === 0 && <li className="text-muted-foreground">Nenhuma venda neste mês.</li>}
                            {(a.codigos ?? []).map((k) => (
                              <li key={k.codigo} className="flex justify-between gap-2"><span className="font-mono">{k.codigo}</span><span>{uni(+k.qtd)} un. · {brl(+k.valor)}</span></li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                  <p className="px-5 py-2 text-xs text-muted-foreground">Passagens no mês: {uni(+d.passagens)}</p>
                </div>
              </Box>
            )}
            {aba === "detalhes" && (
              <Box title="Resumo das necessidades diárias">
                <div className="divide-y text-sm">
                  <p className="px-5 py-2 text-xs text-muted-foreground">Quanto vender por dia nos {uni(rest)} dias restantes para bater 100% das metas.</p>
                  {ms > 0 && (
                    <div className="flex justify-between gap-2 px-5 py-3"><span className="font-medium">Mão de obra (serviços)</span><b>{ms - sv > 0 ? `${brl((ms - sv) / rest)} / dia` : "Meta batida ✅"}</b></div>
                  )}
                  {mp > 0 && (
                    <div className="flex justify-between gap-2 px-5 py-3"><span className="font-medium">Peças</span><b>{mp - pc > 0 ? `${brl((mp - pc) / rest)} / dia` : "Meta batida ✅"}</b></div>
                  )}
                  {d.agregados.filter((a) => +a.meta_qtd > 0).map((a) => {
                    const nome = ITENS.find((i) => i.k === a.item)?.nome ?? a.item;
                    const falta = +a.meta_qtd - +a.qtd;
                    return (
                      <div key={a.item} className="flex justify-between gap-2 px-5 py-3"><span className="font-medium">{nome}</span><b>{falta > 0 ? `${uni(Math.ceil(falta / rest))} / dia` : "Meta batida ✅"}</b></div>
                    );
                  })}
                </div>
              </Box>
            )}
          </>
        )}
      </div>
    </div>
  );
}
