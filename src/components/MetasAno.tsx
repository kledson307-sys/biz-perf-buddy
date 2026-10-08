import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Box, brl } from "@/components/painel-ui";

type Cons = { id: string; nome: string; department_id: string | null };
type Meta = { servicos: string; pecas: string };

const vazio: Meta = { servicos: "", pecas: "" };
const NOMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const chave = (ano: number, i: number) => `${ano}-${String(i + 1).padStart(2, "0")}`;

export function MetasAno({ cons, irPara }: { cons: Cons[]; irPara: (mes: string) => void }) {
  const anoBase = new Date().getFullYear();
  const [ano, setAno] = useState(anoBase + 1);
  const [val, setVal] = useState<Record<string, Record<string, Meta>>>({});
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [preenS, setPreenS] = useState("");
  const [preenP, setPreenP] = useState("");

  const carregar = useCallback(async () => {
    const { data } = await supabase
      .from("goals")
      .select("consultant_id,mes,servicos,pecas")
      .gte("mes", `${ano}-01`)
      .lte("mes", `${ano}-12`);
    const v: Record<string, Record<string, Meta>> = {};
    (data ?? []).forEach((g) => {
      const s = Number(g.servicos) || 0, p = Number(g.pecas) || 0;
      v[g.consultant_id] = {
        ...(v[g.consultant_id] ?? {}),
        [g.mes]: { servicos: s ? String(s) : "", pecas: p ? String(p) : "" },
      };
    });
    setVal(v);
  }, [ano]);

  useEffect(() => { void carregar(); }, [carregar]);

  const set = (cid: string, mes: string, campo: keyof Meta, texto: string) =>
    setVal((p) => ({
      ...p,
      [cid]: { ...(p[cid] ?? {}), [mes]: { ...(p[cid]?.[mes] ?? vazio), [campo]: texto } },
    }));

  const aplicar = () => {
    const m: Record<string, Meta> = {};
    NOMES.forEach((_, i) => { m[chave(ano, i)] = { servicos: preenS, pecas: preenP }; });
    const n: Record<string, Record<string, Meta>> = {};
    cons.forEach((c) => { n[c.id] = { ...m }; });
    setVal(n);
  };

  const repetir = (cid: string) => {
    const base = val[cid]?.[chave(ano, 0)] ?? vazio;
    const m: Record<string, Meta> = {};
    NOMES.forEach((_, i) => { m[chave(ano, i)] = { ...base }; });
    setVal((p) => ({ ...p, [cid]: m }));
  };

  const total = (cid: string) => NOMES.reduce((s, _n, i) => {
    const m = val[cid]?.[chave(ano, i)] ?? vazio;
    return s + (+m.servicos || 0) + (+m.pecas || 0);
  }, 0);

  const salvar = async () => {
    setSalvando(true); setAviso("");
    const rows = cons.flatMap((c) => NOMES.map((_n, i) => {
      const mes = chave(ano, i);
      const m = val[c.id]?.[mes] ?? vazio;
      return { consultant_id: c.id, mes, servicos: +m.servicos || 0, pecas: +m.pecas || 0 };
    }));
    for (let i = 0; i < rows.length; i += 300) {
      const { error } = await supabase.from("goals").upsert(rows.slice(i, i + 300), { onConflict: "consultant_id,mes" });
      if (error) { setSalvando(false); setAviso(`Não deu para salvar: ${error.message}`); return; }
    }
    await carregar();
    setSalvando(false);
    setAviso(`Metas de ${ano} salvas. Elas valem automaticamente quando cada mês chegar.`);
    setTimeout(() => setAviso(""), 5000);
  };

  const anos = [anoBase, anoBase + 1, anoBase + 2];

  return (
    <Box title={`Metas do ano ${ano}`} right={<span className="text-xs">planejamento antecipado</span>}>
      <div className="flex flex-wrap items-center gap-3 p-4">
        <label className="text-sm">
          <span className="text-muted-foreground">Ano</span>
          <select value={ano} onChange={(e) => setAno(+e.target.value)} className="ml-2 rounded-md border border-input bg-background px-3 py-2 text-sm">
            {anos.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <div className="flex items-center gap-2">
          <input aria-label="Meta de serviços para todos os meses" type="number" value={preenS} onChange={(e) => setPreenS(e.target.value)} placeholder="Serviços" className="w-28 rounded-md border border-input bg-background px-3 py-2 text-sm" />
          <input aria-label="Meta de peças para todos os meses" type="number" value={preenP} onChange={(e) => setPreenP(e.target.value)} placeholder="Peças" className="w-28 rounded-md border border-input bg-background px-3 py-2 text-sm" />
          <Button variant="outline" size="sm" onClick={aplicar}>Aplicar a todos os meses</Button>
        </div>
        <Button size="sm" onClick={() => void salvar()} disabled={salvando}>{salvando ? "Salvando…" : `Salvar metas de ${ano}`}</Button>
        {aviso && <p role="status" className="text-sm text-muted-foreground">{aviso}</p>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="sticky left-0 z-10 bg-muted px-3 py-3">Consultor</th>
              {NOMES.map((n, i) => (
                <th key={n} className="px-1 py-3 text-center font-medium">
                  <button onClick={() => irPara(chave(ano, i))} title={`Abrir ${n} no painel`} className="hover:text-primary">{n}</button>
                </th>
              ))}
              <th className="px-3 py-3 text-right">Total no ano</th>
              <th className="px-2 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {cons.map((c) => (
              <tr key={c.id} className="border-t border-border">
                <td className="sticky left-0 z-10 whitespace-nowrap bg-card px-3 py-1.5 font-medium">{c.nome}</td>
                {NOMES.map((_n, i) => {
                  const mes = chave(ano, i);
                  const m = val[c.id]?.[mes] ?? vazio;
                  return (
                    <td key={mes} className="px-1 py-1">
                      <div className="flex flex-col gap-1">
                        <input aria-label={`Meta de serviços de ${c.nome} em ${mes}`} type="number" value={m.servicos} onChange={(e) => set(c.id, mes, "servicos", e.target.value)} className="w-16 rounded border border-input bg-background px-1 py-1 text-right text-[11px]" />
                        <input aria-label={`Meta de peças de ${c.nome} em ${mes}`} type="number" value={m.pecas} onChange={(e) => set(c.id, mes, "pecas", e.target.value)} className="w-16 rounded border border-input bg-background px-1 py-1 text-right text-[11px]" />
                      </div>
                    </td>
                  );
                })}
                <td className="whitespace-nowrap px-3 py-1.5 text-right font-semibold">{brl(total(c.id))}</td>
                <td className="px-2 py-1.5">
                  <button onClick={() => repetir(c.id)} title="Repetir o valor de janeiro em todos os meses" className="whitespace-nowrap text-xs text-primary hover:underline">repetir</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="px-4 pb-4 text-xs text-muted-foreground">
        Em cada mês há dois campos: o de cima é a meta de serviços, o de baixo é a de peças. Clique no nome do mês para abri-lo no painel.
        As metas ficam guardadas e valem automaticamente quando o mês chegar — não precisa digitar de novo.
      </p>
    </Box>
  );
}
