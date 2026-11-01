import { useEffect, useState } from "react";
import { FileText, Download, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { daLoja, resumir, type NpsItem } from "@/lib/nps";
import { STATUS_ATENDIDO, contar, type AgendRow } from "@/lib/agendamentos-data";
import { lerOficinaMes } from "@/lib/oficina-mes";
import { nomeArquivo, type EntradaRel } from "@/lib/relatorio-executivo";
import farois from "@/assets/hero-farois.jpg";

export type BaseRel = Omit<EntradaRel, "geradoEm" | "modo" | "nps" | "npsItens" | "agenda" | "retornos">;

async function imagemBase64(src: string) {
  const blob = await (await fetch(src)).blob();
  return await new Promise<string>((r) => { const f = new FileReader(); f.onload = () => r(String(f.result)); f.readAsDataURL(blob); });
}

/** Botão do Dashboard: consolida os dados já calculados + NPS/agenda/retornos e gera o PDF para conferência e download. */
export function RelatorioExecutivo({ base, mesAtual }: { base: BaseRel; mesAtual: boolean }) {
  const [busy, setBusy] = useState(false);
  const [pdf, setPdf] = useState<{ url: string; blob: Blob } | null>(null);
  const [modo, setModo] = useState<EntradaRel["modo"]>(mesAtual ? "acompanhamento" : "fechamento");
  useEffect(() => setModo(mesAtual ? "acompanhamento" : "fechamento"), [mesAtual]);
  useEffect(() => () => { if (pdf) setTimeout(() => URL.revokeObjectURL(pdf.url), 30000); }, [pdf]);

  const gerar = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const mes = base.mes, [y, m] = mes.split("-").map(Number), fim = `${mes}-${String(new Date(y!, m!, 0).getDate()).padStart(2, "0")}`;
      const [npsQ, agQ, metasQ, of] = await Promise.all([
        supabase.from("nps_imports").select("itens").order("at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("agendamentos").select("*").gte("data", `${mes}-01`).lte("data", fim),
        supabase.from("agenda_metas").select("qtd_diaria").eq("mes", mes),
        lerOficinaMes(mes).catch(() => null),
      ]);
      const npsItens = daLoja(((npsQ.data?.itens as unknown) as NpsItem[]) ?? []);
      const rows = ((agQ.data as unknown) as AgendRow[] | null) ?? [];
      const d0 = rows.filter((r) => r.tipo === "d0"), d1 = rows.filter((r) => r.tipo === "d1");
      const c = contar(d0.length ? d0 : d1);
      const agenda = rows.length ? {
        d1: d1.length, d0: d0.length, d0Atendidos: d0.filter((r) => STATUS_ATENDIDO.test(r.status)).length,
        dias: Math.max(new Set(d0.map((r) => r.data)).size, 1), metaDiaria: (metasQ.data ?? []).reduce((t, x) => t + +x.qtd_diaria, 0),
        carro: c.carro, moto: c.moto, rev: c.porCat.revisao.carro + c.porCat.revisao.moto, diag: c.porCat.diagnostico.carro + c.porCat.diagnostico.moto, recall: c.porCat.recall.carro + c.porCat.recall.moto,
      } : null;
      const entrada: EntradaRel = { ...base, geradoEm: new Date(), modo, nps: npsItens.length ? resumir(npsItens) : null, npsItens, agenda, retornos: of && of.retornos.length ? of.retornos.length : null };
      const [{ gerarPdf }, capa] = await Promise.all([import("@/lib/relatorio-executivo-pdf"), imagemBase64(farois).catch(() => undefined)]);
      const blob = gerarPdf(entrada, capa);
      setPdf({ blob, url: URL.createObjectURL(blob) });
      toast.success("Relatório gerado. Confira antes de compartilhar.");
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível gerar o relatório. Tente novamente.");
    } finally { setBusy(false); }
  };

  const baixar = () => {
    if (!pdf) return;
    const a = document.createElement("a"); a.href = pdf.url; a.download = nomeArquivo(base.mes); document.body.appendChild(a); a.click(); a.remove();
  };

  return <>
    <div className="flex items-center gap-1">
      <select aria-label="Tipo de relatório" value={modo} onChange={(e) => setModo(e.target.value as EntradaRel["modo"])} className="h-8 rounded-md border border-input bg-background px-1.5 text-[11px]">
        <option value="acompanhamento">Acompanhamento</option><option value="fechamento">Fechamento</option>
      </select>
      <Button size="sm" onClick={() => void gerar()} disabled={busy} className="h-8 gap-1.5 text-xs">
        {busy ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}{busy ? "Gerando relatório…" : "Gerar Relatório Executivo PDF"}
      </Button>
    </div>
    {pdf && <div className="fixed inset-0 z-50 flex flex-col bg-background/95 p-2 backdrop-blur sm:p-6" role="dialog" aria-label="Pré-visualização do relatório">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">{nomeArquivo(base.mes)}</p>
        <div className="flex gap-2"><Button size="sm" onClick={baixar} className="gap-1"><Download className="size-4" />Baixar PDF</Button>
          <Button size="sm" variant="outline" onClick={() => setPdf(null)} className="gap-1"><X className="size-4" />Fechar</Button></div>
      </div>
      <iframe title="Relatório Executivo" src={pdf.url} className="min-h-0 w-full flex-1 rounded-lg border border-border bg-card" />
      <p className="mt-1 text-[11px] text-muted-foreground">No celular, se a prévia não aparecer, toque em "Baixar PDF" para abrir o documento.</p>
    </div>}
  </>;
}
