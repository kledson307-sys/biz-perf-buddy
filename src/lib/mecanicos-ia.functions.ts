import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const n = z.number().finite().min(0).max(1e9);
const mecSchema = z.object({
  nome: z.string().max(120),
  grupo: z.string().max(20),
  servicos: n, pecas: n, metaServicos: n, metaPecas: n,
  projServicos: n, projPecas: n,
  perfServicos: n, perfPecas: n, perfTotal: n,
  necServicos: n, necPecas: n,
  passagens: n, ticket: n,
});
const grupoSchema = z.object({
  nome: z.string().max(40),
  lider: z.string().max(120),
  servicos: n, pecas: n, metaServicos: n, metaPecas: n,
  projServicos: n, projPecas: n, perfServicos: n, perfPecas: n,
  passagens: n,
  mecanicos: z.array(z.string().max(120)).max(80),
});
const inputSchema = z.object({
  mes: z.string().regex(/^\d{4}-\d{2}$/),
  diasDecorridos: n, diasTotais: n,
  observacoes: z.string().max(2000),
  grupos: z.array(grupoSchema).max(5),
  mecanicos: z.array(mecSchema).min(1).max(80),
});

export type MecanicosAnaliseInput = z.infer<typeof inputSchema>;
export type MecanicosAnaliseResult = { ok: true; texto: string } | { ok: false; status: number; mensagem: string };

const INSTRUCOES = `Você é o gerente de oficina de uma concessionária e analisa a performance dos MECÂNICOS (produtivos), separados em MECÂNICOS DE CARRO e MECÂNICOS DE MOTO.
Definições: Performance = faturado ÷ meta. Projeção = média por dia decorrido × dias totais. Necessidade diária = (meta − faturado) ÷ dias restantes. Ticket médio = faturado total ÷ passagens.
Responda SEMPRE em português do Brasil, em Markdown, de forma objetiva e prática.
Estruture assim:
"## Carro" e "## Moto" — um bloco por grupo, com:
- **Grupo** (1–2 linhas: faturado, meta, projeção vs. meta e o que falta no mês).
- Para cada mecânico do grupo, "### Nome": **Diagnóstico** (1 linha, citando números), **Ações** (2–3 bullets práticos: agenda e fila de O.S., reemissão e conclusão de serviços, venda de peças no box, captação de passagens, treinamento) e **Ritmo diário** (quanto precisa faturar por dia em serviços e em peças para bater a meta; se não houver meta, diga para cadastrar).
- **Líder do grupo** e a distância dos demais.
Ao final, "## Resumo para o gestor" com 3 prioridades e um comparativo carro x moto mostrando onde há mais espaço para crescer.
Não invente dados que não foram enviados. Seja conciso (no máximo ~110 palavras por mecânico).`;

function erro(status: number, mensagem: string): MecanicosAnaliseResult {
  return { ok: false, status, mensagem };
}

export const analisarMecanicos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => inputSchema.parse(d))
  .handler(async ({ data }): Promise<MecanicosAnaliseResult> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return erro(500, "A IA não está configurada neste projeto.");
    const { gatewayText } = await import("./ai/responses.server.ts");
    const restantes = Math.max(data.diasTotais - data.diasDecorridos, 0);
    const prompt = [
      `Mês: ${data.mes}. Dias decorridos: ${data.diasDecorridos} de ${data.diasTotais} (restam ${restantes}).`,
      data.observacoes.trim() ? `Observações do gestor: ${data.observacoes.trim()}` : "",
      "Grupos (JSON):",
      JSON.stringify(data.grupos),
      "Mecânicos (JSON):",
      JSON.stringify(data.mecanicos),
    ].filter(Boolean).join("\n");
    try {
      const texto = await gatewayText(getRequest(), { apiKey, effort: "low" }, [{ role: "user", content: prompt }], INSTRUCOES);
      if (!texto.trim()) return erro(502, "A IA não retornou a análise. Tente novamente em instantes.");
      return { ok: true, texto };
    } catch (e) {
      const err = e as { statusCode?: number; name?: string; message?: string };
      if (err.name === "AbortError") return erro(499, "Geração cancelada.");
      const s = err.statusCode ?? 500;
      console.error("[mecanicos-ia]", s, err.message);
      if (s === 402) return erro(402, "Os créditos de IA acabaram. Adicione créditos em Configurações → Planos e créditos para continuar.");
      if (s === 429) return erro(429, "Muitas solicitações à IA agora. Aguarde um minuto e tente de novo.");
      if (s === 403) return erro(403, "O uso de IA está bloqueado para este espaço de trabalho. Fale com o administrador.");
      return erro(s, "Não foi possível gerar a análise agora. Tente novamente em instantes.");
    }
  });
