import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Ghost, UserX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ImportadorUnificado } from "@/components/ImportadorUnificado";
import { Box, Tabela, uni } from "@/components/painel-ui";
import { carregarAgendamentos, carregarFollowups, aceitarFollowup, confirmarFollowup, contar, separarPassantes, fechamentoDoDia, faltasDoMes, situacaoCapacidade, picosPorHora, linkResgate, type AgendRow, type Contagem, type Followup } from "@/lib/agendamentos-data";
import { classe, type NpsItem } from "@/lib/nps";

const CAT_LABEL = { revisao: "Revisão", diagnostico: "Diagnóstico", recall: "Recall" } as const;
const dBR = (iso: string) => iso.split("-").reverse().join("/");
const limpa = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toUpperCase();

/** Última nota NPS por cliente (nome normalizado). */
function useNpsPorCliente() {
  const [mapa, setMapa] = useState<Map<string, NpsItem>>(new Map());
  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from("nps_imports").select("itens").order("at", { ascending: false }).limit(1).maybeSingle();
      const m = new Map<string, NpsItem>();
      for (const it of (data?.itens as NpsItem[] | null) ?? []) {
        if (it.nota !== null) m.set(limpa(it.cliente), it);
      }
      setMapa(m);
    })();
  }, []);
  return mapa;
}

const NPS_COR = { promotor: "bg-success", neutro: "bg-warning", detrator: "bg-destructive" } as const;

function SeloNps({ item }: { item?: NpsItem | undefined }) {
  if (!item || item.nota === null) return <span className="text-muted-foreground">sem pesquisa</span>;
  const c = classe(item.nota);
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold text-background ${NPS_COR[c]}`}>{item.nota} · {c === "promotor" ? "Promotor" : c === "neutro" ? "Neutro" : "Detrator"}</span>;
}

/** Bloco de um segmento (Carros ou Motos) com Revisão/Diagnóstico/Recall contados à parte. */
function BlocoSegmento({ icone, nome, m, seg, cor }: { icone: string; nome: string; m: Contagem; seg: "carro" | "moto"; cor: string }) {
  return (
    <div className="rounded-lg bg-background/60 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{icone} {nome}</p>
      <p className={`text-3xl font-bold ${cor}`}>{uni(m[seg])}</p>
      <div className="mt-2 grid grid-cols-3 gap-1 text-center">
        {(["revisao", "diagnostico", "recall"] as const).map((c) => (
          <div key={c} className="rounded bg-card/70 px-1 py-1.5">
            <p className="text-lg font-bold">{uni(m.porCat[c][seg])}</p>
            <p className="text-[10px] uppercase text-muted-foreground">{CAT_LABEL[c]}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Linha de um segmento com Revisão/Diagnóstico/Recall contados à parte. */
function LinhaSegmento({ icone, nome, m, seg }: { icone: string; nome: string; m: Contagem; seg: "carro" | "moto" }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded bg-background/70 px-2 py-1">
      <span className="text-xs font-semibold">{icone} {nome} · {uni(m[seg])}</span>
      <span className="text-[11px] text-muted-foreground">Rev {uni(m.porCat.revisao[seg])} · Diag {uni(m.porCat.diagnostico[seg])} · Recall {uni(m.porCat.recall[seg])}</span>
    </div>
  );
}

/** Aba Agendamentos: radar D+1, controle de qualidade do testador, agenda do dia, fechamento, penetração e faltas. */
export function Agendamentos({ mes }: { mes: string }) {
  const [rows, setRows] = useState<AgendRow[]>([]);
  const [follows, setFollows] = useState<Followup[]>([]);
  const [msg, setMsg] = useState("");
  const npsMap = useNpsPorCliente();
  const [filtroCons, setFiltroCons] = useState("");
  const [metas, setMetas] = useState<{ segmento: string; categoria: string; qtd_diaria: number }[]>([]);
  useEffect(() => {
    void supabase.from("agenda_metas").select("segmento,categoria,qtd_diaria").eq("mes", mes).then(({ data }) => setMetas(data ?? []));
  }, [mes]);

  const load = async () => {
    try {
      const r = await carregarAgendamentos(mes);
      setRows(r);
      setFollows(await carregarFollowups(r.map((x) => x.id)));
    } catch (e) { setMsg((e as Error).message); }
  };
  useEffect(() => { void load(); }, [mes]); // eslint-disable-line react-hooks/exhaustive-deps

  const hoje = new Date().toISOString().slice(0, 10);
  const amanha = useMemo(() => {
    const d1 = rows.filter((r) => r.tipo === "d1");
    const datas = [...new Set(d1.map((r) => r.data))].sort();
    return { data: datas.find((d) => d >= hoje) ?? datas.at(-1) ?? "", itens: d1 };
  }, [rows, hoje]);
  const d1Todos = amanha.itens.filter((r) => r.data === amanha.data);
  const consultoresD1 = [...new Set(d1Todos.map((r) => (r.consultor || "").trim().toUpperCase()).filter(Boolean))].sort();
  const d1 = filtroCons ? d1Todos.filter((r) => (r.consultor || "").trim().toUpperCase() === filtroCons) : d1Todos;
  const d0Hoje = rows.filter((r) => r.tipo === "d0" && r.data === hoje);
  const d0UltimaData = [...new Set(rows.filter((r) => r.tipo === "d0").map((r) => r.data))].sort().at(-1) ?? "";
  const d0 = d0Hoje.length ? d0Hoje : rows.filter((r) => r.tipo === "d0" && r.data === d0UltimaData);

  const radar = contar(d1);
  const acumD1 = contar(rows.filter((r) => r.tipo === "d1"));
  const atendidosMes = rows.filter((r) => r.tipo === "d0" && /EFETIVAD|ENCERRAD|FINALIZAD/i.test(r.status)).length;

  const diagnosticos = d1.filter((r) => r.categoria === "diagnostico");
  const followPorAg = new Map(follows.map((f) => [f.agendamento_id, f]));
  const filaTestador = diagnosticos.filter((d) => !followPorAg.get(d.id)?.aceito_em);
  const controleQualidade = diagnosticos.filter((d) => followPorAg.get(d.id)?.aceito_em);

  const { passantes, agendados } = separarPassantes(d0);
  const mixPass = contar(passantes), mixAg = contar(agendados);

  // Fechamento: D+1 × agenda do dia na mesma data, casando por placa
  const fechamento = useMemo(() => {
    const data = d0[0]?.data;
    if (!data) return [];
    return fechamentoDoDia(rows.filter((r) => r.tipo === "d1" && r.data === data), d0);
  }, [rows, d0]);

  const faltas = faltasDoMes(rows);
  const listaFantasmas = faltas.filter((f) => f.faltas > 2);

  const nome = () => supabase.auth.getUser().then(({ data }) => data.user?.email?.split("@")[0] ?? "");
  const aceitar = async (id: string) => { await aceitarFollowup(id, await nome()); await load(); };
  const confirmar = async (id: string, c: "sim" | "nao" | "faltou") => {
    await confirmarFollowup(id, c, await nome());
    const a = rows.find((r) => r.id === id);
    toast.success(`Quadro avisado: ${a?.cliente ?? "cliente"} (${a?.hora ?? ""}) · ${c === "sim" ? "sintoma confirmado" : c === "nao" ? "sintoma não confirmado" : "não compareceu"}`);
    await load();
  };
  const criticos = d1.filter((r) => { const n = npsMap.get(limpa(r.cliente)); return n && n.nota !== null && classe(n.nota) === "detrator"; });
  const metaSeg = (seg: string) => metas.filter((m) => m.segmento === seg).reduce((t, m) => t + m.qtd_diaria, 0);
  const picos = picosPorHora(d1);
  const alertasQuadro = follows.filter((f) => f.confirmacao && f.confirmado_em).sort((a, b) => (b.confirmado_em ?? "").localeCompare(a.confirmado_em ?? "")).slice(0, 8);
  const SIT = { "sem-meta": ["Sem meta", "text-muted-foreground"], ociosa: ["Ociosa · espaço para encaixe", "text-warning"], ok: ["Dentro da capacidade", "text-success"], saturada: ["Saturada · risco de atraso", "text-destructive"] } as const;

  if (!rows.length) return <Box title="Agendamentos"><p className="p-4 text-sm text-muted-foreground">Nenhum agendamento importado em {dBR(mes + "-01").slice(3)}. Arraste as planilhas "Controle de Agendamento" (D+1 e do dia) na aba Importações.</p>{msg && <p className="px-4 pb-3 text-sm text-destructive">{msg}</p>}</Box>;

  return (
    <div className="space-y-3">
      <details className="rounded-xl border border-border bg-card/60 p-2">
        <summary className="cursor-pointer text-sm font-semibold text-primary">📥 Importar agendamento (D+1 ou do dia)</summary>
        <div className="mt-2"><ImportadorUnificado mes={mes} onDone={() => void load()} /></div>
      </details>
      <Box title={`Agenda de amanhã (D+1) · ${amanha.data ? dBR(amanha.data) : "—"}`}
        right={<p className="text-xs text-muted-foreground">Acumulado do mês: 🚗 {uni(acumD1.carro)} carros · 🏍 {uni(acumD1.moto)} motos · {uni(atendidosMes)} atendidos</p>}>
        <div className="flex flex-wrap items-center gap-2 px-3 pt-3 text-xs">
          <span className="text-muted-foreground">Consultor:</span>
          <select value={filtroCons} onChange={(e) => setFiltroCons(e.target.value)} className="rounded-md border border-border bg-background px-2 py-1">
            <option value="">Todos</option>
            {consultoresD1.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="grid gap-2 p-3 sm:grid-cols-2">
          <BlocoSegmento icone="🚗" nome="Carros" m={radar} seg="carro" cor="text-primary" />
          <BlocoSegmento icone="🏍" nome="Motos" m={radar} seg="moto" cor="text-neon" />
        </div>
        <div className="grid gap-2 px-3 pb-3 sm:grid-cols-2">
          {(["carro", "moto"] as const).map((seg) => {
            const meta = metaSeg(seg), real = radar[seg], sit = SIT[situacaoCapacidade(real, meta)];
            return <p key={seg} className="rounded bg-background/60 px-2 py-1 text-xs">{seg === "carro" ? "🚗" : "🏍"} Capacidade: {uni(real)} de {meta ? uni(meta) : "—"} meta/dia · <b className={sit[1]}>{sit[0]}</b></p>;
          })}
        </div>
        {picos.length > 0 && (
          <div className="px-3 pb-3">
            <p className="mb-1 text-[11px] font-semibold uppercase text-muted-foreground">Entradas por horário</p>
            <div className="flex flex-wrap gap-1">
              {picos.map((p) => {
                const max = Math.max(...Object.values(p.porConsultor));
                return <span key={p.hora} title={Object.entries(p.porConsultor).map(([c, n]) => `${c}: ${n}`).join(" · ")} className={`rounded px-2 py-1 text-[11px] ${max >= 4 ? "bg-destructive text-background" : "bg-card/70"}`}>{p.hora}h · {uni(p.total)}</span>;
              })}
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">Vermelho: um consultor com 4+ entradas no mesmo horário.</p>
          </div>
        )}
      </Box>

      {criticos.length > 0 && (
        <Box title={`⚠️ Alerta de recepção · ${uni(criticos.length)} cliente(s) detrator(es) amanhã`}>
          <ul className="space-y-1 p-3 text-sm">
            {criticos.map((r) => <li key={r.id} className="flex flex-wrap items-center gap-2 rounded bg-destructive/10 px-2 py-1"><b>{r.hora}</b> {r.cliente} · {r.placa} · {r.consultor} <SeloNps item={npsMap.get(limpa(r.cliente))} /></li>)}
          </ul>
          <p className="px-3 pb-3 text-xs text-muted-foreground">Recepção acompanhada pelo gestor para reverter a experiência.</p>
        </Box>
      )}

      <Box title={`Follow-up do testador · diagnósticos de amanhã (${uni(filaTestador.length)} pendentes)`} fit="xl:max-h-[36vh]">
        {!diagnosticos.length && <p className="p-3 text-sm text-muted-foreground">Sem diagnósticos agendados para amanhã.</p>}
        {filaTestador.length > 0 && (
          <Tabela head={["Hora", "Cliente", "Placa", "Alegação", "Último NPS", ""]}>
            {filaTestador.map((d) => (
              <tr key={d.id} className="border-t border-border">
                <td className="px-2 py-1.5">{d.hora}</td><td className="px-2 py-1.5 font-medium">{d.cliente}</td><td className="px-2 py-1.5">{d.placa}</td>
                <td className="max-w-[16rem] truncate px-2 py-1.5 text-muted-foreground" title={d.obs}>{d.obs.split("\n")[0] || "—"}</td>
                <td className="px-2 py-1.5"><SeloNps item={npsMap.get(limpa(d.cliente))} /></td>
                <td className="px-2 py-1.5"><button type="button" onClick={() => void aceitar(d.id)} className="rounded-md bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">Aceitar</button></td>
              </tr>
            ))}
          </Tabela>
        )}
        {controleQualidade.length > 0 && (
          <div className="border-t border-border p-3">
            <h4 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Controle de qualidade · confirmação de sintoma</h4>
            <Tabela head={["Hora", "Cliente", "Placa", "Aceito por", "Sintoma confirmado?"]}>
              {controleQualidade.map((d) => {
                const f = followPorAg.get(d.id)!;
                return (
                  <tr key={d.id} className="border-t border-border">
                    <td className="px-2 py-1.5">{d.hora}</td><td className="px-2 py-1.5 font-medium">{d.cliente}</td><td className="px-2 py-1.5">{d.placa}</td>
                    <td className="px-2 py-1.5 text-muted-foreground">{f.aceito_por}</td>
                    <td className="px-2 py-1.5">
                      {f.confirmacao ? (
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${f.confirmacao === "sim" ? "bg-success text-background" : f.confirmacao === "nao" ? "bg-warning text-background" : "bg-destructive text-background"}`}>
                          {f.confirmacao === "sim" ? "Confirmado" : f.confirmacao === "nao" ? "Não confirmado" : "Não compareceu"} {f.confirmado_em ? `· ${new Date(f.confirmado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : ""}
                        </span>
                      ) : (
                        <span className="flex gap-1">
                          <button type="button" onClick={() => void confirmar(d.id, "sim")} className="rounded bg-success px-2 py-1 text-[11px] font-semibold text-background">Sim</button>
                          <button type="button" onClick={() => void confirmar(d.id, "nao")} className="rounded bg-warning px-2 py-1 text-[11px] font-semibold text-background">Não</button>
                          <button type="button" onClick={() => void confirmar(d.id, "faltou")} className="rounded bg-destructive px-2 py-1 text-[11px] font-semibold text-background">Não compareceu</button>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </Tabela>
          </div>
        )}
      </Box>

      {alertasQuadro.length > 0 && (
        <Box title="Alertas para o quadro · confirmação de sintoma">
          <ul className="space-y-1 p-3 text-xs">
            {alertasQuadro.map((f) => { const a = rows.find((r) => r.id === f.agendamento_id); return <li key={f.id} className="rounded bg-background/60 px-2 py-1">{a?.cliente} agendado {a?.hora} · <b className={f.confirmacao === "sim" ? "text-success" : f.confirmacao === "nao" ? "text-warning" : "text-destructive"}>{f.confirmacao === "sim" ? "sintoma confirmado" : f.confirmacao === "nao" ? "não confirmado" : "não compareceu"}</b> às {new Date(f.confirmado_em!).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} · {f.confirmado_por}</li>; })}
          </ul>
        </Box>
      )}

      <Box title={`Agenda do dia · ${d0.length ? dBR(d0[0]!.data) : "—"} · passantes × agendados`}>
        {!d0.length && <p className="p-3 text-sm text-muted-foreground">Planilha do dia ainda não importada.</p>}
        {d0.length > 0 && (
          <div className="p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              {[{ t: "Passantes (Wesley, Renan, Jadna, Andressa, Pedro, Gilberto)", m: mixPass, n: passantes.length }, { t: "Agendados demais consultores", m: mixAg, n: agendados.length }].map((g) => (
                <div key={g.t} className="rounded-lg bg-background/60 p-3">
                  <p className="text-xs text-muted-foreground">{g.t}</p>
                  <p className="text-xl font-bold">{uni(g.n)}</p>
                  <div className="mt-2 space-y-1">
                    <LinhaSegmento icone="🚗" nome="Carros" m={g.m} seg="carro" />
                    <LinhaSegmento icone="🏍" nome="Motos" m={g.m} seg="moto" />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Penetração de agendados: {Math.round((agendados.length / d0.length) * 100)}% do dia ({uni(agendados.length)} de {uni(d0.length)}) · indicador sem meta
            </p>
          </div>
        )}
      </Box>

      {fechamento.length > 0 && (
        <Box title={`Fechamento do dia · D+1 × agenda do dia (${uni(fechamento.filter((f) => f.atendido).length)} atendidos de ${uni(fechamento.length)})`} fit="xl:max-h-[40vh]">
          <Tabela head={["Hora", "Cliente", "Placa", "Tipo", "Confirmação", "Resultado"]}>
            {fechamento.map((f) => (
              <tr key={f.placa + f.hora} className="border-t border-border">
                <td className="px-2 py-1.5">{f.hora}</td><td className="px-2 py-1.5 font-medium">{f.cliente}</td><td className="px-2 py-1.5">{f.placa}</td>
                <td className="px-2 py-1.5">{CAT_LABEL[f.categoria]} · {f.segmento === "carro" ? "🚗" : "🏍"}</td>
                <td className="px-2 py-1.5">{f.confirmacao}</td>
                <td className={`px-2 py-1.5 font-semibold ${f.atendido ? "text-success" : "text-destructive"}`}>{f.atendido ? "Atendido" : `Não atendido (${f.statusD0})`}</td>
              </tr>
            ))}
          </Tabela>
        </Box>
      )}

      <div className="grid items-start gap-3 xl:grid-cols-2">
        <Box title={`Não compareceram no mês (${uni(faltas.length)})`} fit="xl:max-h-[32vh]">
          {faltas.length > 0 ? (
            <Tabela head={["Cliente", "Placa", "Faltas", "Datas", ""]}>
              {faltas.map((f) => (
                <tr key={f.placa + f.cliente} className="border-t border-border">
                  <td className="px-2 py-1.5 font-medium">{f.cliente}</td><td className="px-2 py-1.5">{f.placa}</td>
                  <td className="px-2 py-1.5">{uni(f.faltas)}</td><td className="px-2 py-1.5 text-muted-foreground">{f.datas.map(dBR).join(", ")}</td>
                  <td className="px-2 py-1.5">{(() => { const l = linkResgate(f.celular, f.cliente); return l ? <a href={l} target="_blank" rel="noreferrer" className="rounded bg-success px-2 py-1 text-[11px] font-semibold text-background">WhatsApp</a> : <span className="text-muted-foreground">sem celular</span>; })()}</td>
                </tr>
              ))}
            </Tabela>
          ) : <p className="p-3 text-sm text-muted-foreground">Nenhuma falta registrada no mês.</p>}
        </Box>
        <Box title={`Clientes fantasmas (${uni(listaFantasmas.length)})`}>
          <p className="px-3 pt-2 text-xs text-muted-foreground">Agendaram mais de 2 vezes e não compareceram.</p>
          {listaFantasmas.length > 0 ? (
            <ul className="space-y-1 p-3 text-sm">{listaFantasmas.map((f) => <li key={f.placa + f.cliente} className="rounded bg-background/60 px-2 py-1"><b>{f.cliente}</b> · {f.placa} · <span className="text-destructive">{uni(f.faltas)} faltas</span>{(() => { const l = linkResgate(f.celular, f.cliente); return l ? <> · <a href={l} target="_blank" rel="noreferrer" className="font-semibold text-success underline">WhatsApp</a></> : null; })()}</li>)}</ul>
          ) : <p className="p-3 text-sm text-muted-foreground">Nenhum cliente fantasma no mês.</p>}
        </Box>
      </div>
      {msg && <p className="text-sm text-destructive">{msg}</p>}
    </div>
  );
}
