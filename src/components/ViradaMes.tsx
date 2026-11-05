import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Circle, Copy, FileSpreadsheet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { mesTravado, msgTravado } from "@/lib/month-lock";
import { metasParaCopiar, mesAnterior } from "@/lib/virada-mes";
import { mesSeguinte } from "@/lib/agendamentos-data";

type Item = { ok: boolean; t: string };

/** Checklist da virada de mês, cópia de metas do mês anterior e exportação consolidada em Excel. */
export function ViradaMes({ mes, onChanged }: { mes: string; onChanged?: () => void }) {
  const [itens, setItens] = useState<Item[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const ini = `${mes}-01`, fim = mesSeguinte(mes);
    const [p, g, ag, mm, ds, ul, cons] = await Promise.all([
      supabase.from("month_params").select("du_totais_dec,du_totais").eq("mes", mes).maybeSingle(),
      supabase.from("goals").select("id", { count: "exact", head: true }).eq("mes", mes),
      supabase.from("agg_goals").select("id", { count: "exact", head: true }).eq("mes", mes),
      supabase.from("mech_month").select("meta_servicos").eq("mes", mes),
      supabase.from("daily_sales").select("id", { count: "exact", head: true }).gte("dia", ini).lt("dia", fim),
      supabase.from("update_log").select("origem").eq("mes", mes),
      supabase.from("consultants").select("id,department_id"),
    ]);
    const origens = (ul.data ?? []).map((u) => u.origem);
    const tem = (re: RegExp) => origens.some((o) => re.test(o));
    const semDept = (cons.data ?? []).filter((c) => !c.department_id).length;
    setItens([
      { ok: !!(p.data && (p.data.du_totais_dec ?? p.data.du_totais)), t: "Dias úteis do mês salvos" },
      { ok: (g.count ?? 0) > 0, t: `Metas dos consultores (${g.count ?? 0})` },
      { ok: (ag.count ?? 0) > 0, t: `Metas de agregados (${ag.count ?? 0})` },
      { ok: (mm.data ?? []).some((x) => Number(x.meta_servicos) > 0), t: `Técnicos e metas (${mm.data?.length ?? 0} técnicos)` },
      { ok: (ds.count ?? 0) > 0, t: "Faturamento importado no mês" },
      { ok: tem(/^Passagens/), t: "Passagens importadas" },
      { ok: tem(/^O\.S\. abertas/), t: "O.S. abertas importadas" },
      { ok: tem(/^Agendamento/), t: "Agendamentos importados" },
      { ok: semDept === 0, t: semDept ? `${semDept} consultor(es) sem departamento — cadastre em Configurações` : "Todos os consultores com departamento" },
    ]);
  }, [mes]);
  useEffect(() => { void load(); }, [load]);

  const copiar = async () => {
    setBusy(true); setMsg("");
    try {
      if (await mesTravado(mes)) throw new Error(msgTravado(mes));
      const ant = mesAnterior(mes);
      const [ga, gb, aa, ab] = await Promise.all([
        supabase.from("goals").select("consultant_id,servicos,pecas").eq("mes", ant),
        supabase.from("goals").select("consultant_id").eq("mes", mes),
        supabase.from("agg_goals").select("consultant_id,item,meta_qtd,meta_valor").eq("mes", ant),
        supabase.from("agg_goals").select("consultant_id,item").eq("mes", mes),
      ]);
      const err = ga.error ?? gb.error ?? aa.error ?? ab.error; if (err) throw err;
      const g = metasParaCopiar(ga.data ?? [], gb.data ?? []).map((x) => ({ ...x, mes }));
      const a = metasParaCopiar(aa.data ?? [], ab.data ?? []).map((x) => ({ ...x, mes }));
      if (g.length) { const { error } = await supabase.from("goals").insert(g); if (error) throw error; }
      if (a.length) { const { error } = await supabase.from("agg_goals").insert(a); if (error) throw error; }
      setMsg(g.length || a.length ? `✅ Copiadas ${g.length} metas de consultores e ${a.length} de agregados de ${ant}. Metas já lançadas não foram alteradas.` : "Nada a copiar: as metas deste mês já estão lançadas.");
      await load(); onChanged?.();
    } catch (e) { setMsg("Erro: " + (e instanceof Error ? e.message : String(e))); } finally { setBusy(false); }
  };

  const exportar = async () => {
    setBusy(true); setMsg("");
    try {
      const ini = `${mes}-01`, fim = mesSeguinte(mes);
      const [cons, deps, ds, gl, mm, as, ag] = await Promise.all([
        supabase.from("consultants").select("id,nome,department_id"), supabase.from("departments").select("id,nome"),
        supabase.from("daily_sales").select("consultant_id,dia,servicos,pecas,margem_pecas").gte("dia", ini).lt("dia", fim),
        supabase.from("goals").select("consultant_id,servicos,pecas").eq("mes", mes),
        supabase.from("mech_month").select("nome,grupo,servicos,pecas,passagens,meta_servicos,meta_pecas").eq("mes", mes).order("nome"),
        supabase.from("agg_sales").select("consultant_id,dia,item,codigo,qtd,valor").gte("dia", ini).lt("dia", fim),
        supabase.from("agendamentos").select("data,tipo,hora,cliente,placa,segmento,categoria,consultor,status").gte("data", ini).lt("data", fim).order("data"),
      ]);
      const nome = new Map((cons.data ?? []).map((c) => [c.id, c.nome]));
      const dep = new Map((deps.data ?? []).map((d) => [d.id, d.nome]));
      const depDe = new Map((cons.data ?? []).map((c) => [c.id, dep.get(c.department_id ?? "") ?? ""]));
      const tot = new Map<string, { s: number; p: number; m: number }>();
      for (const d of ds.data ?? []) { const t = tot.get(d.consultant_id) ?? { s: 0, p: 0, m: 0 }; t.s += Number(d.servicos); t.p += Number(d.pecas); t.m += Number(d.margem_pecas); tot.set(d.consultant_id, t); }
      const meta = new Map((gl.data ?? []).map((g) => [g.consultant_id, g]));
      const ids = [...new Set([...tot.keys(), ...meta.keys()])];
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();
      const add = (n: string, rows: object[]) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{ "Sem dados": "" }]), n);
      add("Consultores", ids.map((id) => { const t = tot.get(id) ?? { s: 0, p: 0, m: 0 }; const g = meta.get(id); return { Consultor: nome.get(id) ?? id, Departamento: depDe.get(id), Serviços: t.s, "Meta serviços": Number(g?.servicos ?? 0), Peças: t.p, "Meta peças": Number(g?.pecas ?? 0), "Margem peças": t.m, "Margem %": t.p ? t.m / t.p : 0 }; }));
      add("Faturamento diário", (ds.data ?? []).map((d) => ({ Dia: d.dia, Consultor: nome.get(d.consultant_id), Serviços: Number(d.servicos), Peças: Number(d.pecas), "Margem peças": Number(d.margem_pecas) })));
      add("Técnicos", (mm.data ?? []).map((t) => ({ Técnico: t.nome, Segmento: t.grupo, Serviços: Number(t.servicos), "Meta serviços": Number(t.meta_servicos), Peças: Number(t.pecas), "Meta peças": Number(t.meta_pecas), Passagens: Number(t.passagens) })));
      add("Agregados", (as.data ?? []).map((a) => ({ Dia: a.dia, Consultor: nome.get(a.consultant_id), Item: a.item, Código: a.codigo, Qtd: Number(a.qtd), Valor: Number(a.valor) })));
      add("Agendamentos", (ag.data ?? []).map((a) => ({ Data: a.data, Relatório: a.tipo === "d1" ? "D+1" : "Do dia", Hora: a.hora, Cliente: a.cliente, Placa: a.placa, Segmento: a.segmento, Tipo: a.categoria, Consultor: a.consultor, Status: a.status })));
      XLSX.writeFile(wb, `pos-venda-${mes}.xlsx`);
      setMsg("✅ Planilha do mês gerada.");
    } catch (e) { setMsg("Erro: " + (e instanceof Error ? e.message : String(e))); } finally { setBusy(false); }
  };

  const pend = itens.filter((i) => !i.ok).length;
  return (
    <section className="lux-card space-y-2 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Virada de mês {pend ? <span className="text-warning">· {pend} pendência(s)</span> : <span className="text-success">· tudo pronto</span>}</h3>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void copiar()}><Copy className="mr-1 size-4" />Copiar metas do mês anterior</Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void exportar()}><FileSpreadsheet className="mr-1 size-4" />Exportar mês em Excel</Button>
        </div>
      </div>
      <ul className="grid gap-1 text-xs sm:grid-cols-2 xl:grid-cols-3">
        {itens.map((i) => <li key={i.t} className="flex items-center gap-1.5">{i.ok ? <CheckCircle2 className="size-3.5 text-success" /> : <Circle className="size-3.5 text-warning" />}{i.t}</li>)}
      </ul>
      {msg && <p className="text-xs">{msg}</p>}
    </section>
  );
}
