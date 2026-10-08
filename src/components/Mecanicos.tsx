import { useEffect, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Barra, Box, Kpi, Tabela, brl, div, norm, num, parseNum, pct, tone } from "@/components/painel-ui";
import { lerMecanicos } from "@/lib/mecanicos";
import { registrarUpdate } from "@/lib/update-log";

type M = { id?: string; nome: string; servicos: number; pecas: number; passagens: number; meta_servicos: number; meta_pecas: number };
const CAMPOS = ["servicos", "pecas", "passagens", "meta_servicos", "meta_pecas"] as const;

export function Mecanicos({ mes, tot, dec }: { mes: string; tot: number; dec: number }) {
  const file = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<M[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [cola, setCola] = useState("");
  const [novo, setNovo] = useState("");

  const load = async () => {
    const { data, error } = await supabase.from("mech_month").select("id,nome,servicos,pecas,passagens,meta_servicos,meta_pecas").eq("mes", mes).order("nome");
    if (error) setMsg(error.message); else setRows(data ?? []);
  };
  useEffect(() => { void load(); }, [mes]);

  const gravar = async (lst: M[], origem: string) => {
    if (!lst.length) return;
    setBusy(true);
    const { error } = await supabase.from("mech_month").upsert(lst.map(({ id: _i, ...r }) => ({ ...r, mes, updated_at: new Date().toISOString() })), { onConflict: "user_id,mes,nome" });
    setBusy(false);
    if (error) { setMsg("Erro ao salvar: " + error.message); return false; }
    await registrarUpdate(origem); await load(); return true;
  };
  const base = (nome: string) => rows.find(r => norm(r.nome) === norm(nome)) ?? { nome: nome.trim().toUpperCase(), servicos: 0, pecas: 0, passagens: 0, meta_servicos: 0, meta_pecas: 0 };

  const importar = async (f?: File) => {
    if (!f) return;
    setMsg("");
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await f.arrayBuffer(), { type: "array" });
      const raw = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0] ?? ""]!, { header: 1, defval: "" });
      const r = lerMecanicos(raw);
      if (r.periodo && r.periodo.fim.slice(0, 7) !== mes && !confirm(`O relatório é de ${r.periodo.ini.slice(0, 7)}, mas o mês aberto é ${mes}. Importar mesmo assim neste mês?`)) return;
      const ok = await gravar(r.rows.map(x => ({ ...base(x.nome), servicos: x.servicos, pecas: x.pecas })), "Mecânicos (importação)");
      if (ok) setMsg(`${r.rows.length} mecânicos importados${r.periodo ? ` (período ${r.periodo.ini.split("-").reverse().join("/")} a ${r.periodo.fim.split("-").reverse().join("/")})` : ""}. Valores do mês substituídos, sem somar.`);
    } catch (e) { setMsg((e as Error).message); }
    if (file.current) file.current.value = "";
  };

  const colar = async () => {
    const lst = cola.split("\n").map(l => l.split(/\t|;/).map(s => s.trim())).filter(c => c[0] && c.length >= 2).map(c => {
      const b = base(c[0]!);
      return c.length === 2 ? { ...b, passagens: parseNum(c[1]!) } : { ...b, servicos: parseNum(c[1]!), pecas: parseNum(c[2] ?? ""), ...(c[3] ? { passagens: parseNum(c[3]) } : {}) };
    });
    if (!lst.length) { setMsg("Nada para colar. Use: Nome ⇥ Passagens  ou  Nome ⇥ Serviços ⇥ Peças ⇥ Passagens"); return; }
    if (await gravar(lst, "Mecânicos (colar)")) { setCola(""); setMsg(`${lst.length} linhas salvas.`); }
  };

  const editar = (r: M, k: (typeof CAMPOS)[number], v: number) => { if (r[k] !== v) void gravar([{ ...r, [k]: v }], "Mecânicos (edição)"); };
  const remover = async (r: M) => { if (r.id && confirm(`Remover ${r.nome} deste mês?`)) { await supabase.from("mech_month").delete().eq("id", r.id); await load(); } };

  const rest = Math.max(tot - dec, 1);
  const c = (real: number, meta: number) => { const proj = div(real, dec) * tot; return { real, meta, perf: div(real, meta), proj, projP: div(proj, meta), nec: Math.max(meta - real, 0) / rest, dia: div(real, dec) }; };
  const calcs = rows.map(r => ({ r, s: c(r.servicos, r.meta_servicos), p: c(r.pecas, r.meta_pecas), t: c(r.servicos + r.pecas, r.meta_servicos + r.meta_pecas) })).sort((a, b) => b.t.real - a.t.real);
  const sum = (k: keyof M) => rows.reduce((a, r) => a + Number(r[k]), 0);
  const S = c(sum("servicos"), sum("meta_servicos")), P = c(sum("pecas"), sum("meta_pecas")), T = c(S.real + P.real, S.meta + P.meta);
  const pass = sum("passagens");

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi label="Faturado Serviços" value={brl(S.real)} sub={`meta ${brl(S.meta)} · ${pct(S.perf)}`} cls={tone(S.perf)} />
        <Kpi label="Faturado Peças" value={brl(P.real)} sub={`meta ${brl(P.meta)} · ${pct(P.perf)}`} cls={tone(P.perf)} />
        <Kpi label="Passagens" value={num(pass)} sub={`ticket médio ${brl(div(T.real, pass))}`} />
        <Kpi label="Projeção Serviços / Peças" value={brl(S.proj)} sub={<>peças {brl(P.proj)} · {pct(S.projP)} / {pct(P.projP)}</>} cls={tone(S.projP)} />
        <Kpi label="Necessidade diária" value={brl(T.nec) + "/dia"} sub={<>serviços {brl(S.nec)}/dia · peças {brl(P.nec)}/dia</>} />
      </div>

      <Box title="Mecânicos — serviços e peças" right={<span className="text-xs">{dec} de {tot} dias · {Math.max(tot - dec, 0)} restantes</span>}>
        <Tabela head={["#", "Mecânico", "Grupo", "Faturado", "Meta", "Perf.", "Projeção", "Proj. %", "Média/dia", "Precisa/dia", "Passagens", "Ticket", ""]}>
          {calcs.map(({ r, s, p, t }, i) => (["Serviços", "Peças", "Total"] as const).map((g, j) => {
            const x = j === 0 ? s : j === 1 ? p : t;
            const metaK = j === 0 ? "meta_servicos" : j === 1 ? "meta_pecas" : null;
            return (
              <tr key={r.nome + g} className={`border-t border-border ${j === 2 ? "bg-muted/50 font-semibold" : ""}`}>
                {j === 0 && <><td rowSpan={3} className="px-3 py-2 align-top">{i + 1}</td><td rowSpan={3} className="whitespace-nowrap px-3 py-2 align-top font-medium">{r.nome}</td></>}
                <td className="px-3 py-2">{g}</td>
                <td className="px-3 py-2">{j < 2 ? <In v={j === 0 ? r.servicos : r.pecas} on={v => editar(r, j === 0 ? "servicos" : "pecas", v)} dis={busy} /> : brl(x.real)}</td>
                <td className="px-3 py-2">{metaK ? <In v={r[metaK]} on={v => editar(r, metaK, v)} dis={busy} /> : brl(x.meta)}</td>
                <td className="px-3 py-2"><Barra p={x.perf} /></td>
                <td className="px-3 py-2">{brl(x.proj)}</td>
                <td className={`px-3 py-2 font-semibold ${tone(x.projP)}`}>{x.meta ? pct(x.projP) : "—"}</td>
                <td className="px-3 py-2">{brl(x.dia)}</td>
                <td className="px-3 py-2">{x.meta ? (x.nec ? brl(x.nec) : "✔ batida") : "sem meta"}</td>
                {j === 0 && <><td rowSpan={3} className="px-3 py-2 align-top"><In v={r.passagens} on={v => editar(r, "passagens", v)} dis={busy} money={false} /></td>
                  <td rowSpan={3} className="px-3 py-2 align-top">{brl(div(t.real, r.passagens))}</td>
                  <td rowSpan={3} className="px-3 py-2 align-top print:hidden"><button onClick={() => remover(r)} className="text-xs text-destructive">remover</button></td></>}
              </tr>
            );
          }))}
          {!rows.length && <tr><td colSpan={13} className="px-3 py-6 text-center text-muted-foreground">Importe o relatório "Faturamento Líquido dos Produtivos" para começar.</td></tr>}
        </Tabela>
      </Box>

      <div className="grid gap-4 print:hidden lg:grid-cols-2">
        <Box title="Importar planilha do sistema">
          <div className="space-y-3 p-5 text-sm">
            <p className="text-muted-foreground">Relatório "Faturamento Líquido dos Produtivos". Usa Srv Total como serviços e Peças; ignora "Sem Apontamento(s)". Reimportar substitui os valores do mês (passagens e metas ficam).</p>
            <input ref={file} type="file" accept=".xls,.xlsx" hidden onChange={e => importar(e.target.files?.[0])} />
            <Button onClick={() => file.current?.click()} disabled={busy}><Upload className="mr-2 size-4" />Importar Excel</Button>
            {msg && <p role="status" className="text-sm">{msg}</p>}
          </div>
        </Box>
        <Box title="Colar passagens / valores">
          <div className="space-y-3 p-5 text-sm">
            <p className="text-muted-foreground">Uma linha por mecânico: <b>Nome ⇥ Passagens</b> ou <b>Nome ⇥ Serviços ⇥ Peças ⇥ Passagens</b>. Substitui o valor do mês.</p>
            <textarea value={cola} onChange={e => setCola(e.target.value)} rows={4} className="w-full rounded-lg border border-input bg-background p-2 font-mono text-xs" />
            <div className="flex flex-wrap gap-2">
              <Button onClick={colar} disabled={busy}>Salvar colagem</Button>
              <input value={novo} onChange={e => setNovo(e.target.value)} placeholder="Novo mecânico" className="rounded-lg border border-input bg-background px-3 py-2" />
              <Button variant="outline" disabled={!novo.trim() || busy} onClick={async () => { if (await gravar([base(novo)], "Mecânicos (edição)")) setNovo(""); }}>Adicionar</Button>
            </div>
          </div>
        </Box>
      </div>
    </div>
  );
}

function In({ v, on, dis, money = true }: { v: number; on: (v: number) => void; dis: boolean; money?: boolean }) {
  const [t, setT] = useState(String(v));
  useEffect(() => setT(String(v)), [v]);
  return <input value={t} disabled={dis} onChange={e => setT(e.target.value)} onBlur={() => on(parseNum(t))} title={money ? brl(v) : num(v)}
    className="w-28 rounded border border-input bg-background px-2 py-1 text-right print:border-0" />;
}
