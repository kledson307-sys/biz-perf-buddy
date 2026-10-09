import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import { Box, Tabela, uni, pct, tone } from "./painel-ui";
import { GRUPO_NOME, ITENS } from "@/lib/agregados";
import { recomendarAgregados, type RecomendacaoInput } from "@/lib/agregados-ia.functions";

type Cons = { id: string; nome: string; department_id: string | null };
type Stat = { qtd: number; valor: number; mq: number; mv: number; pass: number; projQ: number; perfQ: number; aprov: number };

export function AgregadosIA({ mes, cons, tot, dec, stat, deptName }: {
  mes: string; cons: Cons[]; tot: number; dec: number;
  stat: (ids: string[], items: string[]) => Stat; deptName: (id: string | null) => string;
}) {
  const gerar = useServerFn(recomendarAgregados);
  const [alvo, setAlvo] = useState("todos");
  const [obs, setObs] = useState("");
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  useEffect(() => { setTexto(""); setErro(""); }, [mes]);

  const todas = ITENS.map((i) => i.k);
  const linhas = cons.map((c) => ({ c, ...stat([c.id], todas) })).sort((a, b) => b.perfQ - a.perfQ || b.qtd - a.qtd);
  const lider = linhas[0] && linhas[0].qtd > 0 ? linhas[0].c.nome : "";
  const selecionados = alvo === "todos" ? cons : cons.filter((c) => c.id === alvo);

  const executar = async () => {
    if (!selecionados.length) return;
    setCarregando(true); setErro(""); setTexto("");
    const payload: RecomendacaoInput = {
      mes, diasDecorridos: dec, diasTotais: tot, observacoes: obs, lider,
      consultores: selecionados.map((c) => ({
        nome: c.nome, depto: deptName(c.department_id), passagens: stat([c.id], todas).pass,
        itens: ITENS.map((it) => {
          const s = stat([c.id], [it.k]);
          return { item: it.nome, grupo: GRUPO_NOME[it.g], qtd: s.qtd, metaQtd: s.mq, valor: Math.round(s.valor * 100) / 100, metaValor: s.mv, projQtd: Math.round(s.projQ * 10) / 10 };
        }),
      })),
    };
    try {
      const r = await gerar({ data: payload });
      if (r.ok) setTexto(r.texto); else setErro(r.mensagem);
    } catch {
      setErro("Não foi possível gerar as recomendações agora. Tente novamente em instantes.");
    }
    setCarregando(false);
  };

  return (
    <div className="space-y-6">
      <Box title={`Situação dos agregados por consultor — ${mes}`}>
        <Tabela head={["Consultor", "Depto", "Passagens", "Itens vendidos", "Meta qtd", "Performance", "Aproveitamento", "Projeção"]}>
          {linhas.length === 0 && <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">Nenhum consultor cadastrado.</td></tr>}
          {linhas.map((l) => (
            <tr key={l.c.id} className="border-t border-border">
              <td className="px-3 py-2 font-medium">{l.c.nome}</td>
              <td className="px-3 py-2 text-muted-foreground">{deptName(l.c.department_id)}</td>
              <td className="px-3 py-2">{uni(l.pass)}</td>
              <td className="px-3 py-2">{uni(l.qtd)}</td>
              <td className="px-3 py-2 text-muted-foreground">{uni(l.mq)}</td>
              <td className={`px-3 py-2 font-semibold ${tone(l.perfQ)}`}>{pct(l.perfQ)}</td>
              <td className="px-3 py-2">{pct(l.aprov)}</td>
              <td className="px-3 py-2">{uni(l.projQ)}</td>
            </tr>
          ))}
        </Tabela>
        <p className="px-4 py-3 text-xs text-muted-foreground">Resultados e passagens vêm de "Importar Excel" e "Lançar / colar"; as metas, de "Metas". Atualize lá antes de gerar as recomendações.</p>
      </Box>

      <section className="space-y-4 rounded-xl border border-border bg-card p-6 print:hidden">
        <div>
          <h3 className="font-semibold">Recomendações com IA</h3>
          <p className="text-sm text-muted-foreground">A IA analisa resultados, passagens, metas e projeção de cada consultor e sugere ações para melhorar o aproveitamento e bater as metas.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-[240px_1fr]">
          <label className="space-y-1 text-sm">
            <span className="font-medium">Consultor</span>
            <select value={alvo} onChange={(e) => setAlvo(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2">
              <option value="todos">Todos os consultores</option>
              {cons.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Observações do gestor (opcional)</span>
            <textarea value={obs} onChange={(e) => setObs(e.target.value.slice(0, 2000))} rows={2} placeholder="Ex.: campanha de Tunap esta semana; João está em treinamento até dia 15…" className="w-full rounded-lg border border-input bg-background px-3 py-2" />
          </label>
        </div>
        <button disabled={carregando || !selecionados.length} onClick={executar} className="rounded-lg bg-primary px-5 py-2 font-medium text-primary-foreground disabled:opacity-50">
          {carregando ? "Gerando recomendações…" : "Gerar recomendações"}
        </button>
        {erro && <p className="text-sm text-destructive">{erro}</p>}
      </section>

      {texto && (
        <Box title="Recomendações personalizadas" right={<button onClick={() => window.print()} className="rounded-lg border border-input px-3 py-1.5 text-sm print:hidden">Imprimir</button>}>
          <div className="space-y-2 p-6 text-sm leading-relaxed [&_h3]:mt-5 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-primary [&_li]:ml-5 [&_li]:list-disc [&_strong]:font-semibold [&_ul]:space-y-1">
            <ReactMarkdown>{texto}</ReactMarkdown>
          </div>
        </Box>
      )}
    </div>
  );
}
