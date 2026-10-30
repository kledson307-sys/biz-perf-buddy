import { useEffect, useState } from "react";
import { uni } from "@/components/painel-ui";
import { carregarAgendamentos, contar, type AgendRow, type Contagem } from "@/lib/agendamentos-data";

const CAT = { revisao: "Revisão", diagnostico: "Diagnóstico", recall: "Recall" } as const;
const SEGMENTOS: readonly [string, string, "carro" | "moto", string][] = [
  ["🚗", "Carros", "carro", "text-primary"],
  ["🏍", "Motos", "moto", "text-neon"],
];

/** Uma linha do cartão: segmento (Carros ou Motos) com Revisão/Diagnóstico/Recall contados à parte. */
function LinhaSegmento({ icone, nome, seg, cor, m }: { icone: string; nome: string; seg: "carro" | "moto"; cor: string; m: Contagem }) {
  return (
    <div className="rounded-lg bg-background/60 p-2">
      <div className="flex items-baseline justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{icone} {nome}</p>
        <p className={`text-xl font-bold ${cor}`}>{uni(m[seg])}</p>
      </div>
      <div className="mt-1 grid grid-cols-3 gap-1 text-center text-[11px]">
        {(["revisao", "diagnostico", "recall"] as const).map((c) => (
          <div key={c} className="rounded bg-card/70 px-1 py-1">
            <p className="text-sm font-bold">{uni(m.porCat[c][seg])}</p>
            <p className="text-muted-foreground">{CAT[c]}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Conteúdo do cartão do Dashboard: radar do agendamento D+1 (amanhã) + acumulado do mês. */
export function CartaoAgendamento({ mes }: { mes: string }) {
  const [rows, setRows] = useState<AgendRow[] | null>(null);
  useEffect(() => { void carregarAgendamentos(mes).then(setRows).catch(() => setRows([])); }, [mes]);

  const hoje = new Date().toISOString().slice(0, 10);
  const d1all = (rows ?? []).filter((r) => r.tipo === "d1");
  const datas = [...new Set(d1all.map((r) => r.data))].sort();
  const dataD1 = datas.find((d) => d >= hoje) ?? datas.at(-1) ?? "";
  const d1 = d1all.filter((r) => r.data === dataD1);
  const radar = contar(d1);
  const acum = contar(d1all);
  const atendidos = (rows ?? []).filter((r) => r.tipo === "d0" && /EFETIVAD|ENCERRAD|FINALIZAD/i.test(r.status)).length;

  if (rows === null) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  if (!d1.length) return <p className="text-sm text-muted-foreground">Sem agenda D+1 importada. Arraste o relatório na aba Importações.</p>;
  return (
    <div className="space-y-2">
      {SEGMENTOS.map(([icone, nome, , cor]) => (
        <LinhaSegmento key={nome} icone={icone} nome={nome} cor={cor} m={radar} />
      ))}
      <p className="text-[11px] text-muted-foreground">Acumulado do mês: 🚗 {uni(acum.carro)} carros · 🏍 {uni(acum.moto)} motos · {uni(atendidos)} atendidos</p>
    </div>
  );
}
