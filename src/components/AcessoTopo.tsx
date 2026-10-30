import type { ReactNode } from "react";
import bmwLogo from "@/assets/bmw-logo.asset.json";
import farois from "@/assets/hero-farois.jpg";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/** Cabeçalho BMW Dark dos acessos restritos (consultor/técnico). */
export function AcessoTopo({ titulo, sub, mes, setMes, extra }: { titulo: string; sub: string; mes: string; setMes: (m: string) => void; extra?: ReactNode }) {
  return (
    <header className="lux-card relative overflow-hidden p-4">
      <img src={farois} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-25" />
      <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/30" />
      <div className="relative flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <img src={bmwLogo.url} alt="BMW" className="size-10" />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">HAUS MOTORS · SALVADOR</p>
            <h1 className="text-xl font-bold">{titulo}</h1>
            <p className="text-sm text-muted-foreground">{sub}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input type="month" className="h-9 rounded-md border bg-background px-2 text-sm" value={mes} onChange={(e) => setMes(e.target.value)} />
          <ThemeToggle />
          {extra}
          <Button size="sm" variant="outline" onClick={() => supabase.auth.signOut()}><LogOut className="size-4" /> Sair</Button>
        </div>
      </div>
    </header>
  );
}
