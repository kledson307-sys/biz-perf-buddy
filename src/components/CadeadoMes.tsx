import { useEffect, useState } from "react";
import { Lock, LockOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { MASTER_EMAIL, destravarMes, mesTravado, travarMes } from "@/lib/month-lock";

/** Cadeado de fechamento do mês: mês fechado não aceita novas importações de vendas nem de agregados. */
export function CadeadoMes({ mes }: { mes: string }) {
  const [travado, setTravado] = useState(false);
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const master = email.toLowerCase() === MASTER_EMAIL;
  const ref = mes.split("-").reverse().join("/");
  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
    void mesTravado(mes).then(setTravado);
  }, [mes]);
  const alternar = async () => {
    if (!window.confirm(travado ? `Reabrir o mês ${ref}? Importações voltarão a ser aceitas.` : `Fechar o mês ${ref} com cadeado? Nenhuma importação poderá alterar os números.`)) return;
    const { error } = travado ? await destravarMes(mes) : await travarMes(mes, email);
    if (error) setMsg("Erro: " + error.message); else { setTravado(!travado); setMsg(""); }
  };
  return (
    <section className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 ${travado ? "border-warning/60 bg-warning/10" : "border-border bg-card"}`}>
      <div className="flex items-center gap-3">
        {travado ? <Lock className="text-warning" /> : <LockOpen className="text-muted-foreground" />}
        <div>
          <p className="font-semibold">{travado ? `Mês ${ref} fechado` : `Mês ${ref} aberto`}</p>
          <p className="text-xs text-muted-foreground">{travado ? "Importações de vendas e agregados estão bloqueadas." : "Ao fechar, os números do mês ficam protegidos contra importações acidentais."}</p>
          {msg && <p className="text-xs text-destructive">{msg}</p>}
        </div>
      </div>
      {master ? <Button variant={travado ? "outline" : "default"} onClick={() => void alternar()}>{travado ? "Reabrir mês" : "Fechar mês"}</Button>
        : <span className="text-xs text-muted-foreground">Só o gestor master pode fechar ou reabrir.</span>}
    </section>
  );
}
