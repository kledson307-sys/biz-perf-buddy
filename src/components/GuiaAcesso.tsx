import { useEffect, useState } from "react";
import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GUIA, NOVIDADES, VERSAO_ATUAL, oQueMostrar, perfilGuia } from "@/lib/guia";

/** Guia de primeiro acesso por perfil e novidades após cada atualização; lembrado por usuário neste aparelho. */
export function GuiaAcesso({ email, papel }: { email: string; papel: string | null | undefined }) {
  const k = email.toLowerCase();
  const passos = GUIA[perfilGuia(papel)];
  const [modo, setModo] = useState<"guia" | "novidades" | null>(null);
  const [i, setI] = useState(0);
  useEffect(() => {
    const guiaVisto = localStorage.getItem(`guia-visto:${k}`) === "1";
    const versao = Number(localStorage.getItem(`novidades-vistas:${k}`) ?? 0);
    const m = oQueMostrar(guiaVisto, versao);
    if (!guiaVisto) localStorage.setItem(`novidades-vistas:${k}`, String(VERSAO_ATUAL)); // novato não precisa das novidades
    setModo(m);
  }, [k]);
  const fechar = () => {
    if (modo === "guia") localStorage.setItem(`guia-visto:${k}`, "1");
    if (modo === "novidades") localStorage.setItem(`novidades-vistas:${k}`, String(VERSAO_ATUAL));
    setModo(null); setI(0);
  };
  const nov = NOVIDADES[0];
  const p = passos[i];
  return (
    <>
      <Button size="icon" variant="outline" aria-label="Guia da tela" title="Guia da tela" onClick={() => { setI(0); setModo("guia"); }}
        className="fixed bottom-4 left-4 z-40 rounded-full shadow-lg print:hidden"><HelpCircle /></Button>
      <Dialog open={modo !== null} onOpenChange={(v) => { if (!v) fechar(); }}>
        <DialogContent className="max-w-md">
          {modo === "guia" && p && <>
            <DialogHeader>
              <DialogTitle>{i === 0 ? "Bem-vindo! " : ""}{p.titulo}</DialogTitle>
              <DialogDescription>Passo {i + 1} de {passos.length}</DialogDescription>
            </DialogHeader>
            <p className="text-sm leading-relaxed">{p.texto}</p>
            <div className="flex justify-between gap-2">
              <Button variant="ghost" onClick={fechar}>Pular</Button>
              <div className="flex gap-2">
                {i > 0 && <Button variant="outline" onClick={() => setI(i - 1)}>Voltar</Button>}
                {i < passos.length - 1 ? <Button onClick={() => setI(i + 1)}>Próximo</Button> : <Button onClick={fechar}>Concluir</Button>}
              </div>
            </div>
          </>}
          {modo === "novidades" && <>
            <DialogHeader>
              <DialogTitle>O que há de novo na HAUS MOTORS</DialogTitle>
              <DialogDescription>Atualização de {nov.data}</DialogDescription>
            </DialogHeader>
            <ul className="max-h-[60vh] space-y-3 overflow-y-auto text-sm">
              {nov.itens.map((n) => <li key={n.titulo} className="rounded-md border border-border p-3">
                <b className="block">{n.titulo}</b>
                <span className="block text-muted-foreground">{n.oque}</span>
                <span className="mt-1 block"><b>Como usar:</b> {n.como}</span>
              </li>)}
            </ul>
            <Button onClick={fechar}>Entendido, vamos lá!</Button>
          </>}
        </DialogContent>
      </Dialog>
    </>
  );
}
