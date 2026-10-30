import { useState } from "react";
import { Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lerAbaNps, daLoja, type NpsItem } from "@/lib/nps";
import { ehFaturamentoPecas, lerItensPecas, type ItemPeca } from "@/lib/pecas-itens";
import { ehRelatorioPassagens, lerPassagens, type PassReport } from "@/lib/mecanicos";
import { salvarPassagens } from "@/lib/passagens-save";
import { mesTravado } from "@/lib/month-lock";
import { pecasPorDia, osDasPassagens, servicosPorDia, retornosPorChassi } from "@/lib/diario-retorno";
import { salvarOficinaMes } from "@/lib/oficina-mes";

type Achado = { arquivo: string; tipo: "nps" | "pecas" | "passagens" | "outro"; resumo: string; nps?: NpsItem[]; pecas?: ItemPeca[]; pass?: PassReport; raw?: unknown[][] };
const ROTULO = { nps: "NPS da montadora", pecas: "Faturamento de Peças", passagens: "Faturamento de Serviços / Passagens", outro: "Não reconhecido" } as const;

/** Esteira única: arraste os arquivos em qualquer ordem; cada um é reconhecido pelos cabeçalhos e conferido antes de salvar. */
export function ImportadorUnificado({ mes, onDone }: { mes: string; onDone?: () => void }) {
  const [achados, setAchados] = useState<Achado[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);

  const ler = async (files: FileList | File[]) => {
    setMsg(""); const XLSX = await import("xlsx"); const out: Achado[] = [];
    for (const f of Array.from(files)) {
      const wb = XLSX.read(await f.arrayBuffer(), { type: "array", cellDates: true });
      const abas = wb.SheetNames.map((s) => ({ s, raw: XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[s]!, { header: 1, defval: "" }) }));
      const nps = abas.flatMap(({ s, raw }) => lerAbaNps(raw, s));
      if (nps.length) { out.push({ arquivo: f.name, tipo: "nps", nps, resumo: `${nps.length} pesquisas · ${daLoja(nps).length} de Salvador` }); continue; }
      const p = abas.find((a) => ehFaturamentoPecas(a.raw));
      if (p) { const it = lerItensPecas(p.raw); out.push({ arquivo: f.name, tipo: "pecas", pecas: it, raw: p.raw, resumo: `${it.length} itens · ${it.reduce((a, i) => a + i.valor, 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} (sem O.S. internas)` }); continue; }
      const pa = abas.find((a) => ehRelatorioPassagens(a.raw));
      if (pa) { const r = lerPassagens(pa.raw); const ret = retornosPorChassi(osDasPassagens(pa.raw)).length; out.push({ arquivo: f.name, tipo: "passagens", pass: r, raw: pa.raw, resumo: `${r.mecanicos.length} técnicos · ${r.consultores.length} consultores · ${r.mecanicos.reduce((n, m) => n + m.passagens, 0)} passagens (O.S. únicas, sem internas) · ${ret} retornos por chassi` }); continue; }
      out.push({ arquivo: f.name, tipo: "outro", resumo: "Cabeçalhos não reconhecidos. Use o bloco específico abaixo." });
    }
    setAchados(out);
  };

  const salvar = async () => {
    if (await mesTravado(mes)) { setMsg("Mês fechado: desbloqueie para importar."); return; }
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser(); const nome = u.user?.email?.split("@")[0] ?? "";
      const feitos: string[] = [];
      for (const a of achados) {
        if (a.tipo === "nps" && a.nps) {
          const { error } = await supabase.from("nps_imports").insert({ itens: a.nps as never, arquivo: a.arquivo, nome });
          if (error) throw error;
          await supabase.from("update_log").insert({ nome, origem: "nps", mes }); feitos.push("NPS");
        }
        if (a.tipo === "pecas" && a.pecas) {
          const { error } = await supabase.from("parts_items").upsert({ mes, itens: a.pecas as never, nome, at: new Date().toISOString() }, { onConflict: "user_id,mes" });
          if (error) throw error; feitos.push("Peças por item");
          if (a.raw) { await salvarOficinaMes(mes, { diario: pecasPorDia(a.raw, mes), fonte: "p" }); feitos.push("Peças por dia"); }
        }
        if (a.tipo === "passagens" && a.pass) { await salvarPassagens(a.pass, mes); feitos.push("Passagens (técnicos, mix e consultores)");
          if (a.raw) { const oss = osDasPassagens(a.raw); await salvarOficinaMes(mes, { diario: servicosPorDia(oss, mes), fonte: "s", retornos: retornosPorChassi(oss) }); feitos.push("Serviços por dia e retornos por chassi"); } }
      }
      setMsg(feitos.length ? `✅ Salvo: ${feitos.join(", ")}. Importações anteriores substituídas.` : "Nada para salvar aqui.");
      setAchados([]); onDone?.();
    } catch (e) { setMsg("Erro: " + (e as Error).message); } finally { setBusy(false); }
  };

  return (
    <section className="lux-card space-y-3 p-4">
      <h3 className="font-semibold">Esteira única · arraste os arquivos</h3>
      <label onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); void ler(e.dataTransfer.files); }}
        className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-6 text-center text-sm ${over ? "border-primary bg-primary/10" : "border-border"}`}>
        <Upload className="size-6 text-primary" />
        <span>Solte aqui Faturamento de Peças, Faturamento de Serviços e NPS — em qualquer ordem</span>
        <input type="file" multiple accept=".xlsx,.xls" className="hidden" onChange={(e) => { if (e.target.files) void ler(e.target.files); e.target.value = ""; }} />
      </label>
      {achados.length > 0 && <>
        <ul className="space-y-1 text-sm">{achados.map((a) => <li key={a.arquivo} className="rounded border border-border p-2">{a.tipo === "outro" ? "❌" : "✅"} <b>{ROTULO[a.tipo]}</b> · {a.arquivo}<p className="text-xs text-muted-foreground">{a.resumo}</p></li>)}</ul>
        <button type="button" disabled={busy} onClick={() => void salvar()} className="h-9 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground">{busy ? "Salvando…" : "Conferido · salvar"}</button>
      </>}
      {msg && <p className="text-sm">{msg}</p>}
    </section>
  );
}
