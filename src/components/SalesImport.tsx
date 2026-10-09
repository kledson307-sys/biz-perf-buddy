import { useRef, useState } from "react";
import { FileSpreadsheet, Save, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { brl, norm, Tabela } from "@/components/painel-ui";
import { readSalesReport, type SalesReport } from "@/lib/sales-report";
import { registrarUpdate } from "@/lib/update-log";

type Cons = { id: string; nome: string; department_id: string | null };
type Dept = { id: string; nome: string };
const key = (value: string) => norm(value.trim());
const dateLabel = (value: string) => value.split("-").reverse().join("/");
const currency = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function SalesImport({ cons, depts, onDone, onPeriod }: {
  cons: Cons[]; depts: Dept[]; onDone: () => void; onPeriod: (month: string) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [dia, setDia] = useState(() => new Date().toISOString().slice(0, 10));
  const [txt, setTxt] = useState("");
  const [report, setReport] = useState<SalesReport | null>(null);
  const [arquivo, setArquivo] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const period = report?.periodo ?? { ini: dia, fim: dia };
  const match = (r: SalesReport["rows"][number]) => cons.find(c => key(c.nome) === key(r.nome)) ?? (r.completo ? cons.find(c => key(c.nome) === key(r.completo)) : undefined);
  const read = (rows: unknown[][], filename: string) => {
    setReport(readSalesReport(rows)); setArquivo(filename); setMsg("");
  };
  const open = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true); setReport(null); setMsg("");
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error("O arquivo deve ter até 20 MB.");
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const name = wb.SheetNames[0];
      const sheet = name ? wb.Sheets[name] : undefined;
      if (!sheet) throw new Error("A planilha não contém uma página de dados.");
      read(XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: "" }), file.name);
    } catch (error) { setMsg((error as Error).message); }
    finally { setBusy(false); }
  };
  const paste = () => {
    try {
      const first = txt.split(/\r?\n/).find(l => l.trim());
      if (!first) throw new Error("Cole o cabeçalho e ao menos uma linha.");
      const sep = txt.includes("\t") ? "\t" : ";";
      read(txt.split(/\r?\n/).map(l => l.split(sep)), "Dados colados");
    } catch (error) { setReport(null); setMsg((error as Error).message); }
  };
  const save = async () => {
    if (!report || busy || !period.ini || !period.fim) return;
    setBusy(true); setMsg("");
    try {
      const departments = new Map(depts.map(d => [key(d.nome), d.id]));
      const consultants = new Map(cons.map(c => [key(c.nome), c.id]));
      const rows: { consultant_id: string; servicos: number; pecas: number; margem_pecas: number }[] = [];
      for (const r of report.rows) {
        let id = match(r)?.id ?? consultants.get(key(r.nome));
        if (!id) {
          let deptId = departments.get(key(r.departamento)) ?? null;
          if (r.departamento && !deptId) {
            const { data, error } = await supabase.from("departments").insert({ nome: r.departamento }).select("id").single();
            if (error || !data) throw new Error(error?.message ?? "Não consegui cadastrar o departamento.");
            deptId = data.id; departments.set(key(r.departamento), data.id);
          }
          const { data, error } = await supabase.from("consultants").insert({ nome: r.nome, department_id: deptId }).select("id").single();
          if (error || !data) throw new Error(error?.message ?? `Não consegui cadastrar ${r.nome}.`);
          id = data.id; consultants.set(key(r.nome), data.id);
        }
        const existing = rows.find(row => row.consultant_id === id);
        if (existing) { existing.servicos += r.servicos; existing.pecas += r.pecas; existing.margem_pecas += r.margem; }
        else rows.push({ consultant_id: id, servicos: r.servicos, pecas: r.pecas, margem_pecas: r.margem });
      }
      const { error } = report.periodo
        ? await supabase.rpc("import_sales_period", { p_ini: period.ini, p_fim: period.fim, p_rows: rows })
        : await supabase.from("daily_sales").upsert(rows.map(r => ({ ...r, dia })), { onConflict: "consultant_id,dia" });
      if (error) throw error;
      await registrarUpdate("Faturamento (Excel/colar)");
      setMsg(`${rows.length} consultores salvos: ${dateLabel(period.ini)} a ${dateLabel(period.fim)}. Serviços: ${currency(rows.reduce((n, r) => n + r.servicos, 0))}. Peças: ${currency(rows.reduce((n, r) => n + r.pecas, 0))}.`);
      setReport(null); setTxt(""); setArquivo("");
      onPeriod(period.fim.slice(0, 7)); onDone();
    } catch (error) { setMsg("Erro ao salvar: " + (error as Error).message); }
    finally { setBusy(false); }
  };
  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-semibold">Vendas de serviços e peças</h2>
        <Button variant="outline" onClick={() => fileInput.current?.click()} disabled={busy}><Upload />{busy ? "Aguarde…" : "Importar Excel"}</Button>
        <input ref={fileInput} type="file" aria-label="Arquivo Excel de vendas" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => { void open(e.target.files?.[0]); e.target.value = ""; }} />
      </div>
      <label className="block text-sm"><span className="text-muted-foreground">Data das vendas sem período no relatório</span>
        <input type="date" value={dia} disabled={busy || Boolean(report?.periodo)} onChange={e => setDia(e.target.value)} className="mt-2 block rounded-md border border-input bg-background px-3 py-2" />
      </label>
      <div className="space-y-3">
        <textarea aria-label="Dados de vendas" value={txt} disabled={busy} onChange={e => { setTxt(e.target.value); setReport(null); }} rows={8} placeholder={"Consultor\tDepartamento\tServiços\tPeças\nJoão\tOficina\t1.250,00\t830,00"} className="w-full rounded-md border border-input bg-card p-4 font-mono text-xs" />
        <Button variant="secondary" onClick={paste} disabled={busy || !txt.trim()}><FileSpreadsheet />Conferir dados colados</Button>
      </div>
      {report && <div className="space-y-4 border-t border-border pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h3 className="font-semibold">Prévia · {dateLabel(period.ini)} a {dateLabel(period.fim)}</h3><p className="text-sm text-muted-foreground">{arquivo} · {report.rows.length} consultores</p></div>
          <Button variant="ghost" size="icon" aria-label="Cancelar importação" title="Cancelar importação" disabled={busy} onClick={() => setReport(null)}><X /></Button>
        </div>
        {report.periodo && <p role="note" className="border-l-2 border-primary bg-accent px-4 py-3 text-sm text-accent-foreground">Este relatório é acumulado. Os lançamentos dos consultores presentes, de {dateLabel(period.ini)} a {dateLabel(period.fim)}, serão substituídos. O total ficará em {dateLabel(period.fim)}; este arquivo não informa a divisão diária. Para manter o histórico diário, importe relatórios de um único dia.</p>}
        <Tabela head={["Vendedor", "Nome completo", "Consultor no painel", "Serviços", "Peças", "Margem peças", "Total"]}>
          {report.rows.map(r => <tr key={r.nome} className="border-t border-border">
            <td className="px-3 py-3 font-medium">{r.nome}</td><td className="px-3 py-3 text-muted-foreground">{r.completo || "—"}</td>
            <td className="px-3 py-3">{match(r)?.nome ?? `${r.nome} (novo)`}</td>
            <td className="whitespace-nowrap px-3 py-3">{currency(r.servicos)}</td><td className="whitespace-nowrap px-3 py-3">{currency(r.pecas)}</td><td className="whitespace-nowrap px-3 py-3">{r.margem && r.pecas ? `${(r.margem / r.pecas * 100).toFixed(1).replace(".", ",")}%` : "—"}</td><td className="whitespace-nowrap px-3 py-3 font-semibold">{currency(r.servicos + r.pecas)}</td>
          </tr>)}
          <tr className="border-t border-border bg-muted font-semibold"><td className="px-3 py-3" colSpan={3}>Total</td><td className="whitespace-nowrap px-3 py-3">{currency(report.rows.reduce((n,r)=>n+r.servicos,0))}</td><td className="whitespace-nowrap px-3 py-3">{currency(report.rows.reduce((n,r)=>n+r.pecas,0))}</td><td className="whitespace-nowrap px-3 py-3">{(() => { const p = report.rows.reduce((n,r)=>n+r.pecas,0), m = report.rows.reduce((n,r)=>n+r.margem,0); return m && p ? `${(m / p * 100).toFixed(1).replace(".", ",")}%` : "—"; })()}</td><td className="whitespace-nowrap px-3 py-3">{currency(report.rows.reduce((n,r)=>n+r.servicos+r.pecas,0))}</td></tr>
        </Tabela>
        <Button onClick={() => void save()} disabled={busy || !dia}><Save />{busy ? "Salvando…" : "Confirmar importação"}</Button>
      </div>}
      {msg && <p role="status" className="text-sm text-muted-foreground">{msg}</p>}
    </section>
  );
}