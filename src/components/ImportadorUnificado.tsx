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
import { lerAgendamento, salvarAgendamento, resumoAgenda, type AgendReport } from "@/lib/agendamento";
import { ehOsAbertas, lerOsTabela, lerOsSistema, consolidarOs } from "@/lib/os-abertas";
import { saveOpenOrders } from "@/lib/open-orders.functions";
import { ehFatServicos, ehFatPecas, lerFatServicos, lerFatPecas, consolidarFat, type FatHistorico } from "@/lib/faturamento-historico";
import { mesSeguinte } from "@/lib/agendamentos-data";
import { mesSeguinte } from "@/lib/agendamentos-data";
import { registrarUpdate } from "@/lib/update-log";

type Achado = {
  arquivo: string; resumo: string; raw?: unknown[][];
  tipo: "nps" | "pecas" | "passagens" | "d1" | "d0" | "os" | "outro";
  agenda?: AgendReport; nps?: NpsItem[]; pecas?: ItemPeca[]; pass?: PassReport;
  fat?: FatHistorico | undefined; osLinhas?: { nome: string; servicos: number; pecas: number }[];
};
const ROTULO = { nps: "NPS da montadora", pecas: "Faturamento de Peças", passagens: "Faturamento de Serviços / Passagens", d1: "Agendamento D+1", d0: "Agendamento do dia", os: "O.S. Abertas", outro: "Não reconhecido" } as const;
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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
      const ag = abas.map((a) => lerAgendamento(a.raw)).find(Boolean);
      if (ag) { out.push({ arquivo: f.name, tipo: ag.tipo, agenda: ag, resumo: `Agenda de ${ag.data.split("-").reverse().join("/")} · ${resumoAgenda(ag)}` }); continue; }
      const nps = abas.flatMap(({ s, raw }) => lerAbaNps(raw, s));
      if (nps.length) { out.push({ arquivo: f.name, tipo: "nps", nps, resumo: `${nps.length} pesquisas · ${daLoja(nps).length} de Salvador` }); continue; }
      const osAb = abas.find((a) => ehOsAbertas(a.raw));
      if (osAb) {
        const linhas = lerOsTabela(osAb.raw) ?? lerOsSistema(osAb.raw);
        if (linhas) { out.push({ arquivo: f.name, tipo: "os", osLinhas: linhas, resumo: `${linhas.length} O.S. dos consultores do painel · ${brl(linhas.reduce((a, l) => a + l.servicos + l.pecas, 0))}` }); continue; }
      }
      const p = abas.find((a) => ehFaturamentoPecas(a.raw));
      if (p) {
        const it = lerItensPecas(p.raw);
        const fat = ehFatPecas(p.raw) ? lerFatPecas(p.raw) : null;
        out.push({ arquivo: f.name, tipo: "pecas", pecas: it, fat: fat ?? undefined, raw: p.raw, resumo: `${it.length} itens · ${brl(it.reduce((a, i) => a + i.valor, 0))} (sem O.S. internas)${fat ? ` · histórico diário de ${fat.meses.length} mês(es)` : ""}` }); continue;
      }
      const pa = abas.find((a) => ehRelatorioPassagens(a.raw));
      if (pa) {
        const r = lerPassagens(pa.raw); const ret = retornosPorChassi(osDasPassagens(pa.raw)).length;
        const fat = ehFatServicos(pa.raw) ? lerFatServicos(pa.raw) : null;
        out.push({ arquivo: f.name, tipo: "passagens", pass: r, fat: fat ?? undefined, raw: pa.raw, resumo: `${r.mecanicos.length} técnicos · ${r.consultores.length} consultores · ${r.mecanicos.reduce((n, m) => n + m.passagens, 0)} passagens (O.S. únicas, sem internas) · ${ret} retornos por chassi${fat ? ` · histórico diário de ${fat.meses.length} mês(es)` : ""}` }); continue;
      }
      out.push({ arquivo: f.name, tipo: "outro", resumo: "Cabeçalhos não reconhecidos. Use o bloco específico abaixo." });
    }
    setAchados(out);
  };

  const salvarFat = async (fat: FatHistorico) => {
    const { data: cons, error } = await supabase.from("consultants").select("id,nome");
    if (error) throw error;
    const { rows, ignorados } = consolidarFat(fat, cons ?? []);
    if (!rows.length) return `Faturamento: nenhum consultor do painel encontrado (${ignorados.join(", ") || "sem linhas"}).`;
    const meses = [...new Set(rows.map((r) => r.dia.slice(0, 7)))];
    for (const m of meses) {
      if (await mesTravado(m)) throw new Error(`Mês ${m} fechado: desbloqueie para importar.`);
      const doMes = rows.filter((r) => r.dia.startsWith(m));
      const { error: e1 } = await supabase.from("daily_sales").delete().gte("dia", `${m}-01`).lt("dia", mesSeguinte(m));
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("daily_sales").insert(doMes);
      if (e2) throw e2;
      await registrarUpdate("Faturamento (histórico diário)", m);
    }
    return `Faturamento diário salvo em ${meses.length} mês(es) (${rows.length} dias de consultores)${ignorados.length ? ` · fora da equipe: ${ignorados.join(", ")}` : ""}`;
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
          await supabase.from("update_log").insert({ nome, origem: "NPS", mes }); feitos.push("NPS");
        }
        if (a.agenda) { await salvarAgendamento(a.agenda, a.arquivo, nome); feitos.push(ROTULO[a.agenda.tipo]); }
        if (a.tipo === "os" && a.osLinhas) {
          const { data: cons, error } = await supabase.from("consultants").select("id,nome");
          if (error) throw error;
          const { valores, fora } = consolidarOs(a.osLinhas, (cons ?? []).map((c) => ({ c })));
          if (!Object.keys(valores).length) throw new Error("Nenhuma O.S. dos consultores permitidos foi encontrada.");
          await saveOpenOrders({ data: { mes, valores } });
          await registrarUpdate("O.S. abertas (importação/edição)", mes);
          feitos.push(`O.S. abertas (${Object.keys(valores).length} consultores)${fora.length ? ` · ignorados: ${[...new Set(fora)].join(", ")}` : ""}`);
        }
        if (a.tipo === "pecas" && a.pecas) {
          const { error } = await supabase.from("parts_items").upsert({ mes, itens: a.pecas as never, nome, at: new Date().toISOString() }, { onConflict: "user_id,mes" });
          if (error) throw error; feitos.push("Peças por item");
          if (a.raw) { await salvarOficinaMes(mes, { diario: pecasPorDia(a.raw, mes), fonte: "p" }); feitos.push("Peças por dia"); }
        }
        if (a.tipo === "passagens" && a.pass) { await salvarPassagens(a.pass, mes); feitos.push("Passagens (técnicos, mix e consultores)");
          if (a.raw) { const oss = osDasPassagens(a.raw); await salvarOficinaMes(mes, { diario: servicosPorDia(oss, mes), fonte: "s", retornos: retornosPorChassi(oss) }); feitos.push("Serviços por dia e retornos por chassi"); } }
        if (a.fat) feitos.push(await salvarFat(a.fat));
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
        <span>Solte aqui Faturamento de Peças, Faturamento de Serviços, O.S. Abertas, NPS e Agendamentos (D+1 e do dia) — em qualquer ordem</span>
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
