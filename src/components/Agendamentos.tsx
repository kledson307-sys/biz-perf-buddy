import { useEffect, useMemo, useState } from "react";
import { Ghost, UserX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ImportadorUnificado } from "@/components/ImportadorUnificado";
import { Box, Tabela, uni } from "@/components/painel-ui";
import { carregarAgendamentos, carregarFollowups, aceitarFollowup, confirmarFollowup, contar, separarPassantes, fechamentoDoDia, faltasDoMes, type AgendRow, type Followup } from "@/lib/agendamentos-data";
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

/** Aba Agendamentos: radar D+1, controle de qualidade do testador, agenda do dia, fechamento, penetração e faltas. */
export function Agendamentos({ mes }: { mes: string }) {
  const [rows, setRows] = useState<AgendRow[]>([]);
  const [follows, setFollows] = useState<Followup[]>([]);
  const [msg, setMsg] = useState("");
  const npsMap = useNpsPorCliente();

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
  const d1 = amanha.itens.filter((r) => r.data === amanha.data);
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
  const confirmar = async (id: string, c: "sim" | "nao" | "faltou") => { await confirmarFollowup(id, c, await nome()); await load(); };

  if (!rows.length) return <Box title="Agendamentos"><p className="p-4 text-sm text-muted-foreground">Nenhum agendamento importado em {dBR(mes + "-01").slice(3)}. Arraste as planilhas "Controle de Agendamento" (D+1 e do dia) na aba Importações.</p>{msg && <p className="px-4 pb-3 text-sm text-destructive">{msg}</p>}</Box>;

  return (
    <div className="space-y-3">
      <details className="rounded-xl border border-border bg-card/60 p-2">
        <summary className="cursor-pointer text-sm font-semibold text-primary">📥 Importar agendamento (D+1 ou do dia)</summary>
        <div className="mt-2"><ImportadorUnificado mes={mes} onDone={() => void load()} /></div>
      </details>
      <Box title={`Agenda de amanhã (D+1) · ${amanha.data ? dBR(amanha.data) : "—"}`}
        right={<p className="text-xs text-muted-foreground">Acumulado do mês: {uni(acumD1.carro + acumD1.moto)} agendados · {uni(atendidosMes)} atendidos</p>}>
        <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-5">
          <div className="rounded-lg bg-background/60 p-2 text-center"><p className="text-2xl font-bold text-primary">{uni(radar.carro)}</p><p className="text-[11px] uppercase text-muted-foreground">Carros</p></div>
          <div className="rounded-lg bg-background/60 p-2 text-center"><p className="text-2xl font-bold text-neon">{uni(radar.moto)}</p><p className="text-[11px] uppercase text-muted-foreground">Motos</p></div>
          {(["revisao", "diagnostico", "recall"] as const).map((c) => (
            <div key={c} className="rounded-lg bg-background/60 p-2 text-center"><p className="text-lg font-bold">{uni(radar.porCat[c].carro + radar.porCat[c].moto)}</p><p className="text-[11px] uppercase text-muted-foreground">{CAT_LABEL[c]} · 🚗{uni(radar.porCat[c].carro)} 🏍{uni(radar.porCat[c].moto)}</p></div>
          ))}
        </div>
      </Box>

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

      <Box title={`Agenda do dia · ${d0.length ? dBR(d0[0]!.data) : "—"} · passantes × agendados`}>
        {!d0.length && <p className="p-3 text-sm text-muted-foreground">Planilha do dia ainda não importada.</p>}
        {d0.length > 0 && (
          <div className="p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              {[{ t: "Passantes (Wesley, Renan, Jadna, Andressa, Pedro, Gilberto)", m: mixPass, n: passantes.length }, { t: "Agendados demais consultores", m: mixAg, n: agendados.length }].map((g) => (
                <div key={g.t} className="rounded-lg bg-background/60 p-3">
                  <p className="text-xs text-muted-foreground">{g.t}</p>
                  <p className="text-xl font-bold">{uni(g.n)} <span className="text-sm font-normal text-muted-foreground">🚗{uni(g.m.carro)} 🏍{uni(g.m.moto)}</span></p>
                  <p className="text-xs text-muted-foreground">Rev {uni(g.m.porCat.revisao.carro + g.m.porCat.revisao.moto)} · Diag {uni(g.m.porCat.diagnostico.carro + g.m.porCat.diagnostico.moto)} · Recall {uni(g.m.porCat.recall.carro + g.m.porCat.recall.moto)}</p>
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
            <Tabela head={["Cliente", "Placa", "Faltas", "Datas"]}>
              {faltas.map((f) => (
                <tr key={f.placa + f.cliente} className="border-t border-border">
                  <td className="px-2 py-1.5 font-medium">{f.cliente}</td><td className="px-2 py-1.5">{f.placa}</td>
                  <td className="px-2 py-1.5">{uni(f.faltas)}</td><td className="px-2 py-1.5 text-muted-foreground">{f.datas.map(dBR).join(", ")}</td>
                </tr>
              ))}
            </Tabela>
          ) : <p className="p-3 text-sm text-muted-foreground">Nenhuma falta registrada no mês.</p>}
        </Box>
        <Box title={`Clientes fantasmas (${uni(listaFantasmas.length)})`}>
          <p className="px-3 pt-2 text-xs text-muted-foreground">Agendaram mais de 2 vezes e não compareceram.</p>
          {listaFantasmas.length > 0 ? (
            <ul className="space-y-1 p-3 text-sm">{listaFantasmas.map((f) => <li key={f.placa + f.cliente} className="rounded bg-background/60 px-2 py-1"><b>{f.cliente}</b> · {f.placa} · <span className="text-destructive">{uni(f.faltas)} faltas</span></li>)}</ul>
          ) : <p className="p-3 text-sm text-muted-foreground">Nenhum cliente fantasma no mês.</p>}
        </Box>
      </div>
      {msg && <p className="text-sm text-destructive">{msg}</p>}
    </div>
  );
}
