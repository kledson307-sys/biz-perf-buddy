import { useEffect, useState } from "react";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Box, brl } from "@/components/painel-ui";
import { ITENS, naoVende, naoVendeAgregado } from "@/lib/agregados";

type Linha = {
  id: string; nome: string;
  servicos: number; pecas: number; mS: number; mP: number;
};

const num = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

// Ficha de acompanhamento diário para o supervisor: objetivo x realizado por vendedor.
// O texto copiado sai com "Realizado:" em branco para o supervisor preencher e devolver.
export function ResumoSupervisor({ linhas, mes }: { linhas: Linha[]; mes: string }) {
  const [agg, setAgg] = useState<{ s: { consultant_id: string; item: string; qtd: number }[]; g: { consultant_id: string; item: string; meta_qtd: number }[] }>({ s: [], g: [] });
  const [copiado, setCopiado] = useState("");
  const ids = linhas.map((l) => l.id).join(",");

  useEffect(() => {
    const lista = ids ? ids.split(",") : [];
    if (!lista.length) return;
    const [y, m] = mes.split("-").map(Number);
    const fim = `${mes}-${new Date(y!, m!, 0).getDate()}`;
    void Promise.all([
      supabase.from("agg_sales").select("consultant_id,item,qtd").in("consultant_id", lista).gte("dia", `${mes}-01`).lte("dia", fim),
      supabase.from("agg_goals").select("consultant_id,item,meta_qtd").in("consultant_id", lista).eq("mes", mes),
    ]).then(([as, ag]) => setAgg({ s: as.data ?? [], g: ag.data ?? [] }));
  }, [ids, mes]);

  const montar = (l: Linha) => {
    const soPecas = ["MARCELA.S", "GEOVANA.M", "NAILTON/THIERRY"].includes(l.nome.trim().toUpperCase());
    const partes: string[] = [l.nome.toUpperCase(), ""];
    if (!soPecas) partes.push(`Obj. serviço: ${brl(l.mS)} / Realizado: `);
    partes.push(`Obj. peça: ${brl(l.mP)} / Realizado: `);
    if (!naoVendeAgregado(l.nome)) {
      for (const it of ITENS) {
        if (naoVende(it.k, l.nome)) continue;
        const meta = Number(agg.g.find((x) => x.consultant_id === l.id && x.item === it.k)?.meta_qtd ?? 0);
        partes.push(`Obj. ${it.nome}: ${num(meta)} / Realizado: `);
      }
    }
    return partes.join("\n");
  };

  const copiar = async (l: Linha) => {
    await navigator.clipboard.writeText(montar(l));
    setCopiado(l.id);
    setTimeout(() => setCopiado(""), 2000);
  };

  return (
    <Box title="Acompanhamento do supervisor (por vendedor)">
      <p className="mb-4 text-sm text-muted-foreground">
        Copie a ficha de cada vendedor, preencha o "Realizado" com os números do dia e me devolva aqui para eu analisar e dar novas orientações.
      </p>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {linhas.map((l) => (
          <div key={l.id} className="rounded-lg border border-border bg-card p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="font-semibold">{l.nome}</span>
              <Button size="sm" variant="outline" onClick={() => void copiar(l)}>
                <Copy />{copiado === l.id ? "Copiado!" : "Copiar"}
              </Button>
            </div>
            <pre className="whitespace-pre-wrap font-sans text-sm text-muted-foreground">{montar(l)}</pre>
          </div>
        ))}
      </div>
    </Box>
  );
}
