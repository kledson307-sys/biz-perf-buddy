import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const n = z.number().finite().min(0).max(1e10);
const inputSchema = z.object({
  nome: z.string().max(120), mes: z.string().max(7), dec: n, tot: n,
  servicos: n, pecas: n, mS: n, mP: n, projS: n, projP: n,
  perfS: n, perfP: n, projPct: n, necS: n, necP: n,
  liderServ: z.string().max(120), liderPerfS: n, liderPec: z.string().max(120), liderPerfP: n,
  passagens: n,
  agregados: z.array(z.object({ item: z.string().max(60), grupo: z.string().max(20), qtd: n, meta: n, proj: n, nec: n, aper: n })).max(20),
});
export type DicaInput = z.infer<typeof inputSchema>;

export type DicaResult = { ok: true; texto: string } | { ok: false; mensagem: string };

const INSTRUCOES = `Você é gerente de pós-venda de uma concessionária BMW e escreve uma mensagem curta de WhatsApp para um consultor sobre o desempenho dele no mês (serviços e peças).
Trate SERVIÇOS, PEÇAS e AGREGADOS separadamente. Agregados: serviços (Limpar, Alinhamento & Balanceamento, Oxi Capacete) e peças (Brazzo, Tunap); aproveitamento = itens ÷ passagens.
Responda em português do Brasil, texto simples (sem Markdown), EXATAMENTE neste formato:
[SERVICOS]
• dica
• dica
[PECAS]
• dica
• dica
[AGREGADOS]
• dica
• dica
• oportunidade (qual item tem mais espaço para crescer, considerando aproveitamento sobre as passagens)
Até 2 dicas curtas e práticas por bloco, citando números enviados (projeção, quanto falta por dia, distância do líder). Em AGREGADOS, aponte a oportunidade: o item com menor aproveitamento ou maior distância da meta, e como oferecê-lo. Não invente dados; se faltar meta, peça para cadastrar. Seja motivador e direto.`;

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
