import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const n = z.number().finite().min(0).max(1e9);
const itemSchema = z.object({
  item: z.string().max(60), grupo: z.string().max(40),
  qtd: n, metaQtd: n, valor: n, metaValor: n, projQtd: n,
});
const consSchema = z.object({
  nome: z.string().max(120), depto: z.string().max(120), passagens: n,
  itens: z.array(itemSchema).max(20),
});
const inputSchema = z.object({
  mes: z.string().regex(/^\d{4}-\d{2}$/),
  diasDecorridos: n, diasTotais: n,
  observacoes: z.string().max(2000),
  lider: z.string().max(120),
  consultores: z.array(consSchema).min(1).max(60),
});

export type RecomendacaoInput = z.infer<typeof inputSchema>;
export type RecomendacaoResult = { ok: true; texto: string } | { ok: false; status: number; mensagem: string };

const INSTRUCOES = `Você é um gerente de pós-venda experiente em concessionárias/oficinas e analisa o acompanhamento de AGREGADOS (itens adicionais vendidos em cada passagem do cliente).
Serviços agregados: Limpar, Alinhamento & Balanceamento, Oxi Capacete. Peças agregadas: Brazzo e Tunap.
Definições: Performance = quantidade vendida ÷ meta de quantidade. Aproveitamento = quantidade de itens ÷ passagens. Projeção = média por dia decorrido × dias totais.
Responda SEMPRE em português do Brasil, em Markdown, de forma objetiva e prática.
Para cada consultor recebido crie uma seção "### Nome" com:
- **Diagnóstico** (1–2 linhas, citando números: performance, aproveitamento, projeção vs. meta).
- **Ações** (2–4 bullets concretos e específicos para os itens mais fracos — abordagem na recepção, checklist, argumentos de venda, oferta combinada, etc.).
- **Meta diária**: quantas unidades por dia ele precisa vender, por item com meta, nos dias restantes para bater a meta (arredonde para cima).
Compare com o consultor líder quando ajudar. Se faltar meta ou passagens, diga isso em uma linha e recomende cadastrar.
Ao final, inclua "### Resumo da equipe" com 3 prioridades para o gestor. Não invente dados que não foram enviados. Seja conciso (no máximo ~120 palavras por consultor).`;

function erro(status: number, mensagem: string): RecomendacaoResult {
  return { ok: false, status, mensagem };
}

export const recomendarAgregados = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => inputSchema.parse(d))
  .handler(async ({ data }): Promise<RecomendacaoResult> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return erro(500, "A IA não está configurada neste projeto.");
    const { gatewayText } = await import("./ai/responses.server.ts");
    const restantes = Math.max(data.diasTotais - data.diasDecorridos, 0);
    const prompt = [
      `Mês: ${data.mes}. Dias decorridos: ${data.diasDecorridos} de ${data.diasTotais} (restam ${restantes}).`,
      `Líder atual em performance de agregados: ${data.lider || "—"}.`,
      data.observacoes.trim() ? `Observações do gestor: ${data.observacoes.trim()}` : "",
      "Dados por consultor (JSON):",
      JSON.stringify(data.consultores),
    ].filter(Boolean).join("\n");
    try {
      const texto = await gatewayText(getRequest(), { apiKey, effort: "low" }, [{ role: "user", content: prompt }], INSTRUCOES);
      if (!texto.trim()) return erro(502, "A IA não retornou recomendações. Tente novamente em instantes.");
      return { ok: true, texto };
    } catch (e) {
      const err = e as { statusCode?: number; name?: string; message?: string };
      if (err.name === "AbortError") return erro(499, "Geração cancelada.");
      const s = err.statusCode ?? 500;
      console.error("[agregados-ia]", s, err.message);
      if (s === 402) return erro(402, "Os créditos de IA acabaram. Adicione créditos em Configurações → Planos e créditos para continuar.");
      if (s === 429) return erro(429, "Muitas solicitações à IA agora. Aguarde um minuto e tente de novo.");
      if (s === 403) return erro(403, "O uso de IA está bloqueado para este espaço de trabalho. Fale com o administrador.");
      return erro(s, "Não foi possível gerar as recomendações agora. Tente novamente em instantes.");
    }
  });
