import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { AcessoriosEstetica } from "@/components/AcessoriosEstetica";
import { ExtratoComissao } from "@/components/ExtratoComissao";
import { PERFIS, calcularComissao, dsrComissao, type Metricas } from "@/lib/comissoes";
import type { Depto } from "@/lib/acessorios-estetica";

type Dms = Record<string, { fat: number; margem: number; meta: number }>;

/** Acesso restrito de Geovana (Acessórios) ou Marcela (Estética): só a própria frente. */
export function AcessoDepartamento({ depto }: { depto: Depto }) {
  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7));
  const [dias, setDias] = useState({ tot: 22, dec: 1 });
  const [aba, setAba] = useState<"painel" | "comissao">("painel");
  const [dms, setDms] = useState<Dms>({});
  const [veiculos, setVeiculos] = useState(0);
  useEffect(() => {
    void supabase.rpc("dep_painel", { p_mes: mes }).then(({ data }) => {
      const r = data as { dms?: Dms; params?: { du_totais: number; du_decorridos: number; dc_totais: number; dc_decorridos: number; base: string } | null } | null;
      const p = r?.params;
      const u = (p?.base ?? "uteis") === "uteis";
      const dec = Math.max(1, (u ? p?.du_decorridos : p?.dc_decorridos) ?? 1);
      setDias({ dec, tot: Math.max(dec, (u ? p?.du_totais : p?.dc_totais) ?? 22) });
      setDms(r?.dms ?? {});
    });
    void supabase.from("rvd_volumes_mes").select("veiculos").eq("mes", mes).then(({ data }) => setVeiculos((data ?? []).reduce((s, x) => s + (+x.veiculos || 0), 0)));
  }, [mes]);
  const d = dms[depto] ?? { fat: 0, margem: 0, meta: 0 };
  const pf = PERFIS[depto === "ACESSORIOS" ? "GEOVANA.M" : "MARCELA.S"]!;
  const met = (fat: number): Metricas => ({ volume: fat, margemPct: d.fat ? d.margem / d.fat : null, ticket: veiculos ? fat / veiculos : null });
  const proj = (d.fat / dias.dec) * dias.tot;
  return <div className="min-h-screen bg-background p-3 md:p-6"><div className="mx-auto max-w-[1500px] space-y-3">
    <header className="lux-card flex flex-wrap items-center justify-between gap-2 p-3">
      <div><p className="text-[10px] uppercase tracking-[0.3em] text-primary">HAUS MOTORS · SALVADOR</p><h1 className="text-lg font-bold">{depto === "ACESSORIOS" ? "Acessórios · Geovana" : "Estética · Marcela"}</h1></div>
      <div className="flex items-center gap-2">
        <input type="month" className="h-9 rounded-md border bg-background px-2 text-sm" value={mes} onChange={(e) => setMes(e.target.value)} />
        <ThemeToggle /><Button size="sm" variant="outline" onClick={() => supabase.auth.signOut()}><LogOut className="size-4" /> Sair</Button>
      </div>
    </header>
    <div className="flex gap-2" role="tablist">{([["painel", "Painel"], ["comissao", "Comissão"]] as const).map(([k, r]) => (
      <button key={k} role="tab" aria-selected={aba === k} onClick={() => setAba(k)} className={`rounded-full px-4 py-1.5 text-sm font-medium ${aba === k ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{r}</button>))}</div>
    {aba === "painel" && <AcessoriosEstetica mes={mes} tot={dias.tot} dec={dias.dec} restrito={depto} />}
    {aba === "comissao" && <div className="mx-auto max-w-4xl"><ExtratoComissao atual={calcularComissao(pf, met(d.fat), dsrComissao(mes))} proj={calcularComissao(pf, met(proj), dsrComissao(mes))} /></div>}
  </div></div>;
}
