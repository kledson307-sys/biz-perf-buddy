import { useEffect, useMemo, useState } from "react";
import { Copy, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Box, brl } from "@/components/painel-ui";
import { toast } from "sonner";

type Linha = {
  id: string; nome: string;
  servicos: number; pecas: number; mS: number; mP: number;
  necS: number; necP: number;
};

type DiaRow = {
  consultant_id: string;
  obj_servicos: number; obj_pecas: number;
  real_servicos: number; real_pecas: number;
  obs: string;
};

const num = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const hoje = () => new Date().toISOString().slice(0, 10);

// Missão do dia por vendedor: o gestor define (ou aceita a sugestão automática),
// o supervisor executa e devolve o realizado; a análise compara planejado x entregue.
// Os valores ficam em supervisor_day e NUNCA entram no faturamento do painel.
export function ResumoSupervisor({ linhas, mes }: { linhas: Linha[]; mes: string }) {
  const [dia, setDia] = useState(hoje());
  const [rows, setRows] = useState<Record<string, DiaRow>>({});
  const [copiado, setCopiado] = useState("");
  const [salvando, setSalvando] = useState(false);
  const ids = linhas.map((l) => l.id).join(",");

  useEffect(() => {
    const lista = ids ? ids.split(",") : [];
    if (!lista.length) return;
    void supabase.from("supervisor_day").select("consultant_id,obj_servicos,obj_pecas,real_servicos,real_pecas,obs")
      .in("consultant_id", lista).eq("dia", dia)
      .then(({ data }) => {
        const map: Record<string, DiaRow> = {};
        for (const r of data ?? []) map[r.consultant_id] = r as DiaRow;
        setRows(map);
      });
  }, [ids, dia]);

  const get = (l: Linha): DiaRow =>
    rows[l.id] ?? { consultant_id: l.id, obj_servicos: l.necS, obj_pecas: l.necP, real_servicos: 0, real_pecas: 0, obs: "" };

  const set = (id: string, patch: Partial<DiaRow>) =>
    setRows((prev) => {
      const base = prev[id] ?? { consultant_id: id, obj_servicos: 0, obj_pecas: 0, real_servicos: 0, real_pecas: 0, obs: "" };
      return { ...prev, [id]: { ...base, ...patch } };
    });

  const salvar = async () => {
    setSalvando(true);
    const payload = linhas.map((l) => {
      const r = get(l);
      return { consultant_id: l.id, dia, obj_servicos: r.obj_servicos, obj_pecas: r.obj_pecas, real_servicos: r.real_servicos, real_pecas: r.real_pecas, obs: r.obs };
    });
    const { error } = await supabase.from("supervisor_day").upsert(payload, { onConflict: "user_id,consultant_id,dia" });
    setSalvando(false);
    if (error) toast.error("Não consegui salvar. Tente de novo.");
    else toast.success("Missões do dia salvas!");
  };

  const analise = (l: Linha): string | null => {
    const r = get(l);
    const temReal = r.real_servicos > 0 || r.real_pecas > 0;
    if (!temReal) return null;
    const soPecas = ["MARCELA.S", "GEOVANA.M", "NAILTON/THIERRY"].includes(l.nome.trim().toUpperCase());
    const partes: string[] = [];
    if (!soPecas && r.obj_servicos > 0) {
      const p = (r.real_servicos / r.obj_servicos) * 100;
      partes.push(p >= 100 ? `Serviços: bateu a missão (${num(p)}%). Parabéns!` : p >= 70 ? `Serviços: chegou perto (${num(p)}%). Amanhã reforçar oferta nos primeiros atendimentos.` : `Serviços: ficou em ${num(p)}% da missão. Conversar para entender o que travou e revisar abordagem.`);
    }
    if (r.obj_pecas > 0) {
      const p = (r.real_pecas / r.obj_pecas) * 100;
      partes.push(p >= 100 ? `Peças: bateu a missão (${num(p)}%). Parabéns!` : p >= 70 ? `Peças: chegou perto (${num(p)}%). Focar em peças de manutenção junto com os serviços.` : `Peças: ficou em ${num(p)}% da missão. Verificar se está oferecendo peças em toda ordem de serviço.`);
    }
    return partes.join(" ");
  };

  const montar = (l: Linha) => {
    const r = get(l);
    const soPecas = ["MARCELA.S", "GEOVANA.M", "NAILTON/THIERRY"].includes(l.nome.trim().toUpperCase());
    const partes: string[] = [`${l.nome.toUpperCase()} — missão de ${dia.split("-").reverse().join("/")}`, ""];
    if (!soPecas) partes.push(`Obj. serviço: ${brl(r.obj_servicos)} / Realizado: `);
    partes.push(`Obj. peça: ${brl(r.obj_pecas)} / Realizado: `);
    return partes.join("\n");
  };

  const copiar = async (l: Linha) => {
    await navigator.clipboard.writeText(montar(l));
    setCopiado(l.id);
    setTimeout(() => setCopiado(""), 2000);
  };

  const resumoDia = useMemo(() => {
    let ok = 0, perto = 0, longe = 0, lancados = 0;
    for (const l of linhas) {
      const r = get(l);
      if (r.real_servicos <= 0 && r.real_pecas <= 0) continue;
      lancados++;
      const ps = r.obj_servicos > 0 ? (r.real_servicos / r.obj_servicos) * 100 : 100;
      const pp = r.obj_pecas > 0 ? (r.real_pecas / r.obj_pecas) * 100 : 100;
      const menor = Math.min(ps, pp);
      if (menor >= 100) ok++; else if (menor >= 70) perto++; else longe++;
    }
    if (!lancados) return null;
    return `Do dia ${dia.split("-").reverse().join("/")}: ${lancados} vendedor(es) com realizado lançado — ${ok} bateram a missão, ${perto} chegaram perto, ${longe} ficaram abaixo de 70%.`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, linhas, dia]);

  return (
    <Box title="Missão do dia — acompanhamento do supervisor">
      <p className="mb-3 text-sm text-muted-foreground">
        Defina a missão de cada vendedor para o dia (já vem sugerida pelo que falta para a meta), copie e envie ao supervisor.
        No fim do dia, lance o realizado aqui e veja a análise de cada um. Esses valores são só de acompanhamento e não entram no faturamento.
      </p>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="text-sm text-muted-foreground">Dia:</label>
        <Input type="date" value={dia} onChange={(e) => setDia(e.target.value)} className="w-40" />
        <Button size="sm" onClick={() => void salvar()} disabled={salvando}>
          <Save />{salvando ? "Salvando..." : "Salvar missões do dia"}
        </Button>
      </div>
      {resumoDia && <p className="mb-4 rounded-md border border-border bg-muted/40 p-3 text-sm">{resumoDia}</p>}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {linhas.map((l) => {
          const r = get(l);
          const soPecas = ["MARCELA.S", "GEOVANA.M", "NAILTON/THIERRY"].includes(l.nome.trim().toUpperCase());
          const fb = analise(l);
          return (
            <div key={l.id} className="rounded-lg border border-border bg-card p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="font-semibold">{l.nome}</span>
                <Button size="sm" variant="outline" onClick={() => void copiar(l)}>
                  <Copy />{copiado === l.id ? "Copiado!" : "Copiar missão"}
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {!soPecas && (
                  <>
                    <label className="text-muted-foreground">Obj. serviço</label>
                    <Input type="number" value={r.obj_servicos || ""} onChange={(e) => set(l.id, { obj_servicos: Number(e.target.value) })} placeholder={num(l.necS)} />
                    <label className="text-muted-foreground">Realizado serviço</label>
                    <Input type="number" value={r.real_servicos || ""} onChange={(e) => set(l.id, { real_servicos: Number(e.target.value) })} />
                  </>
                )}
                <label className="text-muted-foreground">Obj. peça</label>
                <Input type="number" value={r.obj_pecas || ""} onChange={(e) => set(l.id, { obj_pecas: Number(e.target.value) })} placeholder={num(l.necP)} />
                <label className="text-muted-foreground">Realizado peça</label>
                <Input type="number" value={r.real_pecas || ""} onChange={(e) => set(l.id, { real_pecas: Number(e.target.value) })} />
                <label className="text-muted-foreground">Obs.</label>
                <Input value={r.obs} onChange={(e) => set(l.id, { obs: e.target.value })} placeholder="opcional" />
              </div>
              {fb && <p className="mt-3 rounded-md border border-border bg-muted/40 p-2 text-sm">{fb}</p>}
            </div>
          );
        })}
      </div>
    </Box>
  );
}
