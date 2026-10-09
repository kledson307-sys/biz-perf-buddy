import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Box, Kpi, Tabela, brl, div, uni, pct, tone } from "./painel-ui";
import { type Grupo, type MecBloco } from "@/lib/mecanicos";
import { analisarMecanicos, type MecanicosAnaliseInput } from "@/lib/mecanicos-ia.functions";

type Bloco = { k: Grupo; nome: string; b: MecBloco };

const r2 = (v: number) => Math.round(v * 100) / 100;
const r3 = (v: number) => Math.round(v * 1000) / 1000;

const MD = "space-y-2 p-6 text-sm leading-relaxed [&_h2]:mt-5 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-primary [&_h3]:mt-4 [&_h3]:text-sm [&_h3]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p]:mt-2 [&_strong]:font-semibold [&_ul]:space-y-1 [&_table]:mt-3 [&_table]:w-full [&_table]:border-collapse [&_table]:text-xs [&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1";

export function MecanicosIA({ mes, tot, dec, blocos }: { mes: string; tot: number; dec: number; blocos: Bloco[] }) {
  const gerar = useServerFn(analisarMecanicos);
  const [obs, setObs] = useState("");
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  useEffect(() => { setTexto(""); setErro(""); }, [mes]);

  const ativos = blocos.filter(x => x.b.n > 0);
  const comMeta = (b: MecBloco) => [...b.calcs].filter(x => x.t.meta > 0).sort((a, c) => c.t.perf - a.t.perf);
  const liderDe = (b: MecBloco) => comMeta(b)[0]?.r.nome ?? "";

  const pontos = (b: MecBloco): string[] => {
    const out: string[] = [];
    const cm = comMeta(b);
    out.push(cm.length
      ? `Líder: ${cm[0]!.r.nome} com ${pct(cm[0]!.t.perf)} da meta${cm[1] ? `; o 2º é ${cm[1]!.r.nome} com ${pct(cm[1]!.t.perf)}` : ""}.`
      : "Nenhum técnico deste grupo tem meta cadastrada — sem meta não é possível medir performance.");
    const baixo = cm.filter(x => x.t.perf < 0.85);
    out.push(baixo.length
      ? `Abaixo de 85%: ${baixo.slice(0, 6).map(x => `${x.r.nome} (${pct(x.t.perf)})`).join(", ")} — juntos precisam de ${brl(baixo.reduce((a, x) => a + x.t.nec, 0))}/dia.`
      : "Nenhum técnico deste grupo está abaixo de 85% da meta.");
    const semMeta = b.calcs.filter(x => x.t.meta === 0).map(x => x.r.nome);
    if (semMeta.length) out.push(`Sem meta cadastrada: ${semMeta.join(", ")}.`);
    out.push(`Mix do faturado: serviços ${brl(b.S.real)} (${pct(div(b.S.real, b.T.real))}) e peças ${brl(b.P.real)} (${pct(div(b.P.real, b.T.real))}).`);
    out.push(`Projeção do mês: serviços ${brl(b.S.proj)} (${b.S.meta ? pct(b.S.projP) : "sem meta"}) e peças ${brl(b.P.proj)} (${b.P.meta ? pct(b.P.projP) : "sem meta"}).`);
    if (!b.pass) out.push("Passagens não lançadas neste mês — o ticket médio e o aproveitamento por passagem ficam zerados.");
    return out;
  };

  const executar = async () => {
    if (!ativos.length) return;
    setCarregando(true); setErro(""); setTexto("");
    const payload: MecanicosAnaliseInput = {
      mes, diasDecorridos: dec, diasTotais: tot, observacoes: obs,
      grupos: ativos.map(({ nome, b }) => ({
        nome, lider: liderDe(b),
        servicos: r2(b.S.real), pecas: r2(b.P.real), metaServicos: r2(b.S.meta), metaPecas: r2(b.P.meta),
        projServicos: r2(b.S.proj), projPecas: r2(b.P.proj), perfServicos: r3(b.S.perf), perfPecas: r3(b.P.perf),
        passagens: b.pass, mecanicos: b.calcs.map(x => x.r.nome),
      })),
      mecanicos: ativos.flatMap(({ k, b }) => b.calcs.map(x => ({
        nome: x.r.nome, grupo: k,
        servicos: r2(x.r.servicos), pecas: r2(x.r.pecas),
        metaServicos: r2(x.r.meta_servicos), metaPecas: r2(x.r.meta_pecas),
        projServicos: r2(x.s.proj), projPecas: r2(x.p.proj),
        perfServicos: r3(x.s.perf), perfPecas: r3(x.p.perf), perfTotal: r3(x.t.perf),
        necServicos: r2(x.s.nec), necPecas: r2(x.p.nec),
        passagens: x.r.passagens, ticket: r2(div(x.t.real, x.r.passagens)),
      }))),
    };
    try {
      const res = await gerar({ data: payload });
      if (res.ok) setTexto(res.texto); else setErro(res.mensagem);
    } catch {
      setErro("Não foi possível gerar a análise agora. Tente novamente em instantes.");
    }
    setCarregando(false);
  };

  if (!ativos.length) return null;

  return (
    <div className="space-y-6">
      <Box title="Comparativo carro x moto" right={<span className="text-xs">{dec} de {tot} dias · {Math.max(tot - dec, 0)} restantes</span>}>
        <Tabela head={["Grupo", "Faturado", "Meta", "Perf.", "Projeção", "Precisa/dia", "Passagens"]}>
          {ativos.map(({ k, nome, b }) => (
            <tr key={k} className="border-t border-border">
              <td className="whitespace-nowrap px-2 py-2 font-medium">{nome} <span className="text-xs font-normal text-muted-foreground">({b.n})</span></td>
              <td className="whitespace-nowrap px-2 py-2">{brl(b.T.real)}</td>
              <td className="whitespace-nowrap px-2 py-2 text-muted-foreground">{b.T.meta ? brl(b.T.meta) : "sem meta"}</td>
              <td className={`whitespace-nowrap px-2 py-2 font-semibold ${b.T.meta ? tone(b.T.perf) : "text-muted-foreground"}`}>{b.T.meta ? pct(b.T.perf) : "—"}</td>
              <td className="whitespace-nowrap px-2 py-2">{brl(b.T.proj)}{b.T.meta ? <span className={`ml-1 text-xs font-semibold ${tone(b.T.projP)}`}>{pct(b.T.projP)}</span> : null}</td>
              <td className="whitespace-nowrap px-2 py-2">{b.T.meta ? (b.T.nec ? `${brl(b.T.nec)}/dia` : "✔ batida") : "—"}</td>
              <td className="whitespace-nowrap px-2 py-2">{num(b.pass)} <span className="text-xs text-muted-foreground">· ticket {brl(div(b.T.real, b.pass))}</span></td>
            </tr>
          ))}
        </Tabela>
      </Box>

      <div className="grid gap-4 lg:grid-cols-2">
        {ativos.map(({ k, nome, b }) => (
          <Box key={k} title={`Análise — ${nome}`} right={<span className="text-xs">{liderDe(b) ? `líder: ${liderDe(b)}` : "sem meta"}</span>}>
            <ul className="space-y-2 p-5 text-sm leading-relaxed">
              {pontos(b).map((p, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </Box>
        ))}
      </div>

      <section className="space-y-4 rounded-xl border border-border bg-card p-6 print:hidden">
        <div>
          <h3 className="font-semibold">Análise completa com IA</h3>
          <p className="text-sm text-muted-foreground">
            A IA lê os números de carro e de moto e escreve o diagnóstico de cada técnico, o ritmo diário para bater a meta e as prioridades do mês.
            Cada análise gasta créditos de IA (cerca de 0,3 crédito).
          </p>
        </div>
        <label className="block space-y-1 text-sm">
          <span className="font-medium">Observações do gestor (opcional)</span>
          <textarea value={obs} onChange={e => setObs(e.target.value.slice(0, 2000))} rows={2}
            placeholder="Ex.: carro com fila de O.S. parada até dia 12; moto sem peças de giro…"
            className="w-full rounded-lg border border-input bg-background px-3 py-2" />
        </label>
        <button disabled={carregando} onClick={executar} className="rounded-lg bg-primary px-5 py-2 font-medium text-primary-foreground disabled:opacity-50">
          {carregando ? "Gerando análise…" : "Gerar análise com IA"}
        </button>
        {erro && <p className="text-sm text-destructive">{erro}</p>}
      </section>

      {texto && (
        <Box title="Análise de performance" right={<button onClick={() => window.print()} className="rounded-lg border border-input px-3 py-1.5 text-sm print:hidden">Imprimir</button>}>
          <div className={MD}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{texto}</ReactMarkdown>
          </div>
        </Box>
      )}
    </div>
  );
}
