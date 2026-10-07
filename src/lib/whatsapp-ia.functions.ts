import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const n = z.number().finite().min(0).max(1e10);
const inputSchema = z.object({
  nome: z.string().max(120), mes: z.string().max(7), dec: n, tot: n,
  servicos: n, pecas: n, mS: n, mP: n, projS: n, projP: n,
  perfS: n, perfP: n, projPct: n, necS: n, necP: n,
  lider: z.string().max(120), liderPerf: n,
});

export type DicaResult = { ok: true; texto: string } | { ok: false; mensagem: string };

const INSTRUCOES = `Você é gerente de pós-venda de uma concessionária BMW e escreve uma mensagem curta de WhatsApp para um consultor sobre o desempenho dele no mês (serviços e peças).
Responda em português do Brasil, texto simples (sem Markdown, sem títulos, sem emojis em excesso), no máximo 3 dicas curtas e práticas, uma por linha começando com "• ".
Seja motivador e direto, cite números enviados, não invente dados. No máximo 70 palavras.`;

export const dicaWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => inputSchema.parse(d))
  .handler(async ({ data }): Promise<DicaResult> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { ok: false, mensagem: "A IA não está configurada." };
    const { gatewayText } = await import("./ai/responses.server.ts");
    try {
      const texto = await gatewayText(getRequest(), { apiKey, effort: "low" }, [{ role: "user", content: JSON.stringify(data) }], INSTRUCOES);
      return texto.trim() ? { ok: true, texto: texto.trim() } : { ok: false, mensagem: "A IA não retornou dicas." };
    } catch (e) {
      const s = (e as { statusCode?: number }).statusCode ?? 500;
      console.error("[whatsapp-ia]", s, (e as Error).message);
      if (s === 402) return { ok: false, mensagem: "Os créditos de IA acabaram." };
      if (s === 429) return { ok: false, mensagem: "Muitas solicitações à IA. Aguarde um minuto." };
      return { ok: false, mensagem: "Não foi possível gerar as dicas agora." };
    }
  });
