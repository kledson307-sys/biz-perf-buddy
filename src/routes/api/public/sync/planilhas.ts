import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { janela, LISTA_FONTES, type Fonte } from "@/lib/sync-planilhas";

export const Route = createFileRoute("/api/public/sync/planilhas")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        const body = (await request.json().catch(() => ({}))) as { fontes?: string[] };
        const fontes = (body.fontes ?? []).filter((f): f is Fonte => (LISTA_FONTES as string[]).includes(f));
        if (!fontes.length) return new Response("fontes inválidas", { status: 400 });
        const j = janela();
        if (!j.ativa) return Response.json({ pausa: true });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sincronizar, donoDaEquipe } = await import("@/lib/sync-planilhas.server");
        const owner = await donoDaEquipe(supabaseAdmin);
        if (!owner) return new Response("sem equipe", { status: 500 });
        const out: Record<string, boolean> = {};
        for (const f of fontes) out[f] = (await sincronizar(supabaseAdmin, f, owner)).ok;
        return Response.json({ ok: true, fechamento: j.fechamento, out });
      },
    },
  },
});
