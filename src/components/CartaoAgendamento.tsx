import { useEffect, useState } from "react";
import { CalendarCheck } from "lucide-react";
import { Bloco } from "@/components/Cockpit";
import { uni } from "@/components/painel-ui";
import { carregarAgendamentos, contar, type AgendRow } from "@/lib/agendamentos-data";

/** Cartão do Dashboard: radar do agendamento D+1 (amanhã) + acumulado do mês. */
export function CartaoAgendamento({ mes, ir }: { mes: string; ir: () => void }) {
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

  return (
    <Bloco titulo="Agendamentos de amanhã (D+1)" icon={<CalendarCheck className="size-4 text-primary" />} ir={ir} className="lg:col-span-3">
      {rows === null && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {rows !== null && !d1.length && <p className="text-sm text-muted-foreground">Sem agenda D+1 importada. Arraste o relatório na aba Importações.</p>}
      {d1.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-end justify-between">
            <div><p className="text-2xl font-bold text-primary">{uni(radar.carro)} <span className="text-sm font-normal text-muted-foreground">carros</span></p></div>
            <div className="text-right"><p className="text-2xl font-bold text-neon">{uni(radar.moto)} <span className="text-sm font-normal text-muted-foreground">motos</span></p></div>
          </div>
          <div className="grid grid-cols-3 gap-1 text-center text-[11px]">
            {([["Revisão", radar.porCat.revisao], ["Diagnóstico", radar.porCat.diagnostico], ["Recall", radar.porCat.recall]] as const).map(([l, c]) => (
              <div key={l} className="rounded bg-background/60 px-1 py-1"><p className="text-sm font-bold">{uni(c.carro + c.moto)}</p><p className="text-muted-foreground">{l}</p></div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">Acumulado do mês: {uni(acum.carro + acum.moto)} agendados · {uni(atendidos)} atendidos</p>
        </div>
      )}
    </Bloco>
  );
}
