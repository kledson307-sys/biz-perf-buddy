import { CATEGORIAS, somarComposicao, type Composicao } from "@/lib/mecanicos";
import { Box, uni } from "@/components/painel-ui";

const ROTULO: Record<string, string> = { bs: "BSI", rev: "Revisão C7", c4: "C4 - Garantia", pagos: "Reparo (C7)", funilaria: "Funilaria" };
const ORDEM = ["bs", "rev", "c4", "pagos", "funilaria"] as const;

/** Tabela de mix de passagens por técnico (O.S. distintas, cada uma conta uma vez). */
export function MixPassagens({ titulo, linhas, todos }: { titulo: string; linhas: { nome: string; composicao?: Composicao }[]; todos?: { composicao?: Composicao }[] }) {
  const rows = linhas.map((l) => ({ nome: l.nome, c: somarComposicao([l.composicao]) }));
  const tot = somarComposicao((todos ?? linhas).map((l) => l.composicao));
  const soma = (c: ReturnType<typeof somarComposicao>) => ORDEM.reduce((a, k) => a + c[k].length, 0);
  if (!soma(tot)) return null;
  const cols = ORDEM.filter((k) => CATEGORIAS.some((c) => c.k === k));
  return (
    <Box title={titulo}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-xs text-muted-foreground">
            <th className="px-3 py-2 text-left">Técnico</th>
            {cols.map((k) => <th key={k} className="px-2 py-2 text-center">{ROTULO[k]}</th>)}
            <th className="px-3 py-2 text-center">Total</th>
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.nome} className="border-t border-border">
                <td className="px-3 py-1.5">{r.nome}</td>
                {cols.map((k) => <td key={k} className="px-2 py-1.5 text-center tabular-nums">{uni(r.c[k].length)}</td>)}
                <td className="px-3 py-1.5 text-center font-semibold tabular-nums">{uni(soma(r.c))}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-border font-bold">
              <td className="px-3 py-2">TOTAL</td>
              {cols.map((k) => <td key={k} className="px-2 py-2 text-center tabular-nums">{uni(tot[k].length)}</td>)}
              <td className="px-3 py-2 text-center tabular-nums">{uni(soma(tot))}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </Box>
  );
}
