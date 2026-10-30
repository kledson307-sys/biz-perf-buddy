import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { uni } from "@/components/painel-ui";

const SEGMENTOS = [["carro", "🚗 Carros"], ["moto", "🏍 Motos"]] as const;
const CATS = [["revisao", "Revisão"], ["diagnostico", "Diagnóstico"], ["recall", "Recall"]] as const;
type Meta = { segmento: string; categoria: string; qtd_diaria: number };

/** Metas diárias de agendamento por segmento e tipo (alimentam o acompanhamento da aba Agendamentos). */
export function AgendaMetas({ mes }: { mes: string }) {
  const [metas, setMetas] = useState<Meta[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void supabase.from("agenda_metas").select("segmento,categoria,qtd_diaria").eq("mes", mes)
      .then(({ data }) => setMetas((data ?? []) as Meta[]));
  }, [mes]);

  const valor = (s: string, c: string) => metas.find((m) => m.segmento === s && m.categoria === c)?.qtd_diaria ?? 0;

  const salvar = async (s: string, c: string, qtd: number) => {
    setBusy(true); setMsg("");
    const { error } = await supabase.from("agenda_metas").upsert({ mes, segmento: s, categoria: c, qtd_diaria: qtd }, { onConflict: "user_id,mes,segmento,categoria" });
    if (error) setMsg("Erro ao salvar: " + error.message);
    else setMetas((m) => [...m.filter((x) => !(x.segmento === s && x.categoria === c)), { segmento: s, categoria: c, qtd_diaria: qtd }]);
    setBusy(false);
  };

  return (
    <section className="lux-card space-y-2 px-3 py-2">
      <h3 className="text-sm font-semibold">Metas diárias de agendamento</h3>
      <p className="text-xs text-muted-foreground">Quantidade de veículos por dia, por segmento e tipo. Penetração é apenas indicador (sem meta).</p>
      <div className="grid grid-cols-2 gap-2">
        {SEGMENTOS.map(([s, sl]) => (
          <div key={s} className="rounded-lg bg-background/60 p-2">
            <p className="mb-1 text-xs font-semibold">{sl}</p>
            {CATS.map(([c, cl]) => (
              <label key={c} className="flex items-center justify-between gap-2 py-0.5 text-xs">
                <span className="text-muted-foreground">{cl}/dia</span>
                <input type="number" min={0} disabled={busy} defaultValue={uni(valor(s, c))} key={`${mes}-${s}-${c}-${valor(s, c)}`}
                  onBlur={(e) => void salvar(s, c, Math.max(0, Math.round(Number(e.target.value) || 0)))}
                  className="w-16 rounded border border-border bg-background px-1.5 py-0.5 text-right" />
              </label>
            ))}
          </div>
        ))}
      </div>
      {msg && <p className="text-xs text-destructive">{msg}</p>}
    </section>
  );
}
