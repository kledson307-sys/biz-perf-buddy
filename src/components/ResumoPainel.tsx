import { useState } from "react";
import { Box, brl } from "@/components/painel-ui";
import { Button } from "@/components/ui/button";

export type LinhaResumo = {
  nome: string;
  servicos: number; pecas: number; mS: number; mP: number;
  perfS: number; perfP: number; perf: number; projPct: number;
  mediaDia: number; necS: number; necP: number; nec: number;
};

const pc = (v: number) => `${Math.round(v * 100)}%`;

function textoResumo(linhas: LinhaResumo[], liderNome: string | null, dec: number, tot: number, mes: string) {
  const L: string[] = [`📊 *Como estamos — ${mes}* (dia ${dec} de ${tot})`, ""];
  const comMeta = linhas.filter((l) => l.mS + l.mP > 0);
  if (!comMeta.length) return "Cadastre as metas do mês para gerar o resumo.";
  linhas.forEach((l, i) => {
    const dicas: string[] = [];
    if (!l.mS && !l.mP) dicas.push("ainda sem meta cadastrada");
    else {
      if (l.projPct >= 1) dicas.push("vai bater a meta nesse ritmo, mantém! 👏");
      else dicas.push(`pra bater a meta precisa vender *${brl(l.nec)} por dia* (hoje faz ${brl(l.mediaDia)}/dia)`);
      if (l.mS && l.projPct !== undefined && l.perfS < 0.85) dicas.push(`serviços abaixo: falta ${brl(l.necS)}/dia — retomar orçamentos parados e confirmar agendamentos`);
      else if (l.mS && l.perfS < 1) dicas.push(`serviços quase lá: falta ${brl(l.necS)}/dia`);
      if (l.mP && l.perfP < 0.85) dicas.push(`peças abaixo: falta ${brl(l.necP)}/dia — oferecer item complementar em todo atendimento`);
      else if (l.mP && l.perfP < 1) dicas.push(`peças quase lá: falta ${brl(l.necP)}/dia`);
      if (liderNome && liderNome !== l.nome && l.mediaDia > 0) {
        const lid = linhas.find((x) => x.nome === liderNome);
        if (lid && lid.mediaDia > l.mediaDia) dicas.push(`${liderNome} fatura ${brl(lid.mediaDia - l.mediaDia)}/dia a mais — vale observar como ele atende`);
      }
    }
    L.push(`${i + 1}. *${l.nome}*`,
      `   Serviços ${brl(l.servicos)}${l.mS ? ` (${pc(l.perfS)} da meta)` : ""} · Peças ${brl(l.pecas)}${l.mP ? ` (${pc(l.perfP)} da meta)` : ""}`,
      ...dicas.map((d) => `   👉 ${d}`), "");
  });
  L.push("Bora pra cima, time! 💪");
  return L.filter((x, i, a) => !(x === "" && a[i - 1] === "")).join("\n");
}

export function ResumoPainel({ linhas, liderNome, dec, tot, mes }: { linhas: LinhaResumo[]; liderNome: string | null; dec: number; tot: number; mes: string }) {
  const txt = textoResumo(linhas, liderNome, dec, tot, mes);
  const [ok, setOk] = useState(false);
  const pdf = () => {
    const w = window.open("", "_blank"); if (!w) return;
    const esc = (x: string) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\*/g, "");
    w.document.write(`<html><head><title>Resumo ${mes}</title></head><body style="font-family:sans-serif;font-size:15px;white-space:pre-wrap;padding:24px">${esc(txt)}</body></html>`);
    w.document.close(); w.focus(); w.print();
  };
  return (
    <Box title="Resumo rápido em linguagem simples" right={<span className="text-xs">sem custo</span>}>
      <div className="space-y-3 print:hidden">
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, "_blank")}>Enviar no WhatsApp</Button>
          <Button variant="outline" onClick={async () => { await navigator.clipboard.writeText(txt); setOk(true); setTimeout(() => setOk(false), 2000); }}>{ok ? "Copiado!" : "Copiar"}</Button>
          <Button variant="outline" onClick={pdf}>Imprimir / PDF</Button>
        </div>
        <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-3 text-xs">{txt}</pre>
      </div>
    </Box>
  );
}
