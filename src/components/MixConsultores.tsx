import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Box, uni } from "@/components/painel-ui";
import { consultorMoto, type MixCons } from "@/lib/mecanicos";

/** Qualidade e mix de passagens por consultor (Carro: BSI/Revisão C7/C4 Garantia/C7 Reparo; Moto: Revisões/Garantia/Reparo). */
export function MixConsultores({ mes }: { mes: string }) {
  const [rows, setRows] = useState<{ nome: string; m: MixCons }[] | null>(null);
  useEffect(() => {
    void supabase.from("cons_mix").select("nome,composicao").eq("mes", mes).then(({ data }) =>
      setRows((data ?? []).map((r) => ({ nome: r.nome, m: r.composicao as unknown as MixCons })).sort((a, b) => a.nome.localeCompare(b.nome))));
  }, [mes]);
  if (!rows) return null;
  const n = (a?: string[]) => a?.length ?? 0;
  const tot = (m: MixCons) => n(m.bsi) + n(m.rev) + n(m.gar) + n(m.rep);
  const T = rows.reduce((a, r) => ({ bsi: a.bsi + n(r.m.bsi), rev: a.rev + n(r.m.rev), gar: a.gar + n(r.m.gar), rep: a.rep + n(r.m.rep) }), { bsi: 0, rev: 0, gar: 0, rep: 0 });
  return (
    <Box title="Qualidade & mix de passagens" right={<span className="text-xs">Moto (Pedro/Gilberto): sem BSI</span>}>
      {!rows.length ? <p className="p-4 text-sm text-muted-foreground">Mix por consultor ainda não gravado neste mês: arraste o Faturamento de Serviços (Passagens) na esteira única de Importações para preencher.</p> :
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="text-xs text-muted-foreground"><th className="px-3 py-2 text-left">Consultor</th><th className="px-2">BSI</th><th className="px-2">Revisões</th><th className="px-2">Garantia</th><th className="px-2">Reparo</th><th className="px-3">Total</th></tr></thead>
          <tbody>
            {rows.map(({ nome, m }) => (
              <tr key={nome} className="border-t border-border text-center tabular-nums">
                <td className="px-3 py-1.5 text-left">{nome}{consultorMoto(nome) && <span className="ml-1 text-[10px] text-muted-foreground">MOTO</span>}</td>
                <td className="px-2">{consultorMoto(nome) ? "—" : uni(n(m.bsi))}</td><td className="px-2">{uni(n(m.rev))}</td><td className="px-2">{uni(n(m.gar))}</td><td className="px-2">{uni(n(m.rep))}</td>
                <td className="px-3 font-semibold">{uni(tot(m))}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-border text-center font-bold tabular-nums"><td className="px-3 py-2 text-left">TOTAL</td><td>{uni(T.bsi)}</td><td>{uni(T.rev)}</td><td>{uni(T.gar)}</td><td>{uni(T.rep)}</td><td>{uni(T.bsi + T.rev + T.gar + T.rep)}</td></tr>
          </tbody>
        </table></div>}
    </Box>
  );
}
