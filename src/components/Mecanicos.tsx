import { useEffect, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Barra, Box, Kpi, Tabela, brl, div, norm, num, parseNum, pct, tone } from "@/components/painel-ui";
import { GRUPO_NOME, grupoDe, type Grupo, lerMecanicos } from "@/lib/mecanicos";
import { registrarUpdate } from "@/lib/update-log";

type M = { id?: string; nome: string; grupo: Grupo; servicos: number; pecas: number; passagens: number; meta_servicos: number; meta_pecas: number };
const CAMPOS = ["servicos", "pecas", "passagens", "meta_servicos", "meta_pecas"] as const;
type Campo = (typeof CAMPOS)[number];

type X = { real: number; meta: number; perf: number; proj: number; projP: number; nec: number; dia: number };
type Calc = { r: M; s: X; p: X; t: X };
type Bloco = { calcs: Calc[]; S: X; P: X; T: X; pass: number; n: number };

const asGrupo = (v: string): Grupo => (v === "carro" || v === "moto" ? v : "outros");

export function Mecanicos({ mes, tot, dec }: { mes: string; tot: number; dec: number }) {
  const file = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<M[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [cola, setCola] = useState("");
  const [novo, setNovo] = useState("");
  const [grupoNovo, setGrupoNovo] = useState<Grupo>("carro");

  const load = async () => {
    const { data, error } = await supabase.from("mech_month").select("id,nome,grupo,servicos,pecas,passagens,meta_servicos,meta_pecas").eq("mes", mes).order("nome");
    if (error) { setMsg(error.message); return; }
    let lst: M[] = (data ?? []).map(r => ({ ...r, grupo: asGrupo(r.grupo) }));
    // quem ainda está sem grupo herda o grupo do mês mais recente em que apareceu
    const sem = lst.filter(r => r.grupo === "outros").map(r => r.nome);
    if (sem.length) {
      const { data: old } = await supabase.from("mech_month").select("nome,grupo,mes").in("nome", sem).neq("mes", mes).neq("grupo", "outros").order("mes", { ascending: false });
      const m = new Map<string, Grupo>();
      for (const o of old ?? []) { const k = norm(o.nome); if (!m.has(k)) m.set(k, asGrupo(o.grupo)); }
      lst = lst.map(r => ({ ...r, grupo: m.get(norm(r.nome)) ?? r.grupo }));
    }
    setRows(lst);
  };
  useEffect(() => { void load(); }, [mes]);

  const gravar = async (lst: M[], origem: string) => {
    if (!lst.length) return false;
    setBusy(true);
    const { error } = await supabase.from("mech_month").upsert(lst.map(({ id: _i, ...r }) => ({ ...r, mes, updated_at: new Date().toISOString() })), { onConflict: "user_id,mes,nome" });
    setBusy(false);
    if (error) { setMsg("Erro ao salvar: " + error.message); return false; }
    await registrarUpdate(origem); await load(); return true;
  };
  const base = (nome: string): M => rows.find(r => norm(r.nome) === norm(nome)) ?? { nome: nome.trim().toUpperCase(), grupo: grupoDe(nome), servicos: 0, pecas: 0, passagens: 0, meta_servicos: 0, meta_pecas: 0 };

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
      if (ok) {
        const semGrupo = r.rows.filter(x => grupoDe(x.nome) === "outros").length;
        setMsg(`${r.rows.length} mecânicos importados${r.periodo ? ` (período ${r.periodo.ini.split("-").reverse().join("/")} a ${r.periodo.fim.split("-").reverse().join("/")})` : ""}. Valores do mês substituídos, sem somar.${semGrupo ? ` ${semGrupo} não estão na lista de carro nem na de moto e ficaram em "Sem grupo definido".` : ""}`);
      }
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

  const editar = (r: M, k: Campo, v: number) => { if (r[k] !== v) void gravar([{ ...r, [k]: v }], "Mecânicos (edição)"); };
  const mudarGrupo = (r: M, g: Grupo) => { if (r.grupo !== g) void gravar([{ ...r, grupo: g }], "Mecânicos (grupo)"); };
  const remover = async (r: M) => { if (r.id && confirm(`Remover ${r.nome} deste mês?`)) { await supabase.from("mech_month").delete().eq("id", r.id); await load(); } };

  const rest = Math.max(tot - dec, 1);
  const c = (real: number, meta: number): X => { const proj = div(real, dec) * tot; return { real, meta, perf: div(real, meta), proj, projP: div(proj, meta), nec: Math.max(meta - real, 0) / rest, dia: div(real, dec) }; };
  const bloco = (lst: M[]): Bloco => {
    const calcs = lst.map(r => ({ r, s: c(r.servicos, r.meta_servicos), p: c(r.pecas, r.meta_pecas), t: c(r.servicos + r.pecas, r.meta_servicos + r.meta_pecas) })).sort((a, b) => b.t.real - a.t.real);
    const sum = (k: Campo) => lst.reduce((a, r) => a + Number(r[k]), 0);
    const S = c(sum("servicos"), sum("meta_servicos")), P = c(sum("pecas"), sum("meta_pecas")), T = c(S.real + P.real, S.meta + P.meta);
    return { calcs, S, P, T, pass: sum("passagens"), n: lst.length };
  };
  const EQUIPE = bloco(rows);
  const G: Record<Grupo, Bloco> = {
    carro: bloco(rows.filter(r => r.grupo === "carro")),
    moto: bloco(rows.filter(r => r.grupo === "moto")),
    outros: bloco(rows.filter(r => r.grupo === "outros")),
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi label="Faturado Serviços (equipe toda)" value={brl(EQUIPE.S.real)} sub={`meta ${brl(EQUIPE.S.meta)} · ${pct(EQUIPE.S.perf)}`} cls={tone(EQUIPE.S.perf)} />
        <Kpi label="Faturado Peças (equipe toda)" value={brl(EQUIPE.P.real)} sub={`meta ${brl(EQUIPE.P.meta)} · ${pct(EQUIPE.P.perf)}`} cls={tone(EQUIPE.P.perf)} />
        <Kpi label="Passagens (equipe toda)" value={num(EQUIPE.pass)} sub={`ticket médio ${brl(div(EQUIPE.T.real, EQUIPE.pass))}`} />
        <Kpi label="Projeção Serviços / Peças" value={brl(EQUIPE.S.proj)} sub={<>peças {brl(EQUIPE.P.proj)} · {pct(EQUIPE.S.projP)} / {pct(EQUIPE.P.projP)}</>} cls={tone(EQUIPE.S.projP)} />
        <Kpi label="Necessidade diária" value={brl(EQUIPE.T.nec) + "/dia"} sub={<>serviços {brl(EQUIPE.S.nec)}/dia · peças {brl(EQUIPE.P.nec)}/dia</>} />
      </div>

      <GrupoSec titulo={GRUPO_NOME.carro} b={G.carro} dec={dec} tot={tot} busy={busy} onEdit={editar} onGrupo={mudarGrupo} onRem={remover}
        vazio="Nenhum mecânico de carro neste mês." />
      <GrupoSec titulo={GRUPO_NOME.moto} b={G.moto} dec={dec} tot={tot} busy={busy} onEdit={editar} onGrupo={mudarGrupo} onRem={remover}
        vazio="Nenhum mecânico de moto neste mês." />
      {G.outros.n > 0 && <GrupoSec titulo={GRUPO_NOME.outros} b={G.outros} dec={dec} tot={tot} busy={busy} onEdit={editar} onGrupo={mudarGrupo} onRem={remover}
        vazio="" dica="Troque para Carro ou Moto na coluna Grupo." />}

      <div className="grid gap-4 print:hidden lg:grid-cols-2">
        <Box title="Importar planilha do sistema">
          <div className="space-y-3 p-5 text-sm">
            <p className="text-muted-foreground">Relatório "Faturamento Líquido dos Produtivos". Usa Srv Total como serviços e Peças; ignora "Sem Apontamento(s)". Reimportar substitui os valores do mês (passagens, metas e grupo ficam). Quem não está na lista de carro nem na de moto entra em "Sem grupo definido".</p>
            <input ref={file} type="file" accept=".xls,.xlsx" hidden onChange={e => importar(e.target.files?.[0])} />
            <Button onClick={() => file.current?.click()} disabled={busy}><Upload className="mr-2 size-4" />Importar Excel</Button>
            {msg && <p role="status" className="text-sm">{msg}</p>}
          </div>
        </Box>
        <Box title="Colar passagens / valores">
          <div className="space-y-3 p-5 text-sm">
            <p className="text-muted-foreground">Uma linha por mecânico: <b>Nome ⇥ Passagens</b> ou <b>Nome ⇥ Serviços ⇥ Peças ⇥ Passagens</b>. Substitui o valor do mês.</p>
            <textarea value={cola} onChange={e => setCola(e.target.value)} rows={4} className="w-full rounded-lg border border-input bg-background p-2 font-mono text-xs" />
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={colar} disabled={busy}>Salvar colagem</Button>
              <input value={novo} onChange={e => setNovo(e.target.value)} placeholder="Novo mecânico" className="rounded-lg border border-input bg-background px-3 py-2" />
              <select value={grupoNovo} onChange={e => setGrupoNovo(e.target.value as Grupo)} className="rounded-lg border border-input bg-background px-2 py-2">
                <option value="carro">Carro</option>
                <option value="moto">Moto</option>
              </select>
              <Button variant="outline" disabled={!novo.trim() || busy} onClick={async () => { if (await gravar([{ ...base(novo), grupo: grupoNovo }], "Mecânicos (edição)")) setNovo(""); }}>Adicionar</Button>
            </div>
          </div>
        </Box>
      </div>
    </div>
  );
}

function GrupoSec({ titulo, b, dec, tot, busy, onEdit, onGrupo, onRem, vazio, dica }: {
  titulo: string; b: Bloco; dec: number; tot: number; busy: boolean;
  onEdit: (r: M, k: Campo, v: number) => void; onGrupo: (r: M, g: Grupo) => void; onRem: (r: M) => void;
  vazio: string; dica?: string;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi label="Faturado Serviços" value={brl(b.S.real)} sub={`meta ${brl(b.S.meta)} · ${pct(b.S.perf)}`} cls={tone(b.S.perf)} />
        <Kpi label="Faturado Peças" value={brl(b.P.real)} sub={`meta ${brl(b.P.meta)} · ${pct(b.P.perf)}`} cls={tone(b.P.perf)} />
        <Kpi label="Passagens" value={num(b.pass)} sub={`ticket médio ${brl(div(b.T.real, b.pass))}`} />
        <Kpi label="Projeção Serviços / Peças" value={brl(b.S.proj)} sub={<>peças {brl(b.P.proj)} · {pct(b.S.projP)} / {pct(b.P.projP)}</>} cls={tone(b.S.projP)} />
        <Kpi label="Necessidade diária" value={brl(b.T.nec) + "/dia"} sub={<>serviços {brl(b.S.nec)}/dia · peças {brl(b.P.nec)}/dia</>} />
      </div>

      <Box title={titulo} right={<span className="text-xs">{b.n} {b.n === 1 ? "mecânico" : "mecânicos"} · {dec} de {tot} dias{dica ? ` · ${dica}` : ""}</span>}>
        <Tabela head={["#", "Mecânico", "Grupo", "Linha", "Faturado", "Meta", "Perf.", "Projeção", "Proj. %", "Média/dia", "Precisa/dia", "Passagens", "Ticket", ""]}>
          {b.calcs.map(({ r, s, p, t }, i) => (["Serviços", "Peças", "Total"] as const).map((g, j) => {
            const x = j === 0 ? s : j === 1 ? p : t;
            const metaK = j === 0 ? "meta_servicos" : j === 1 ? "meta_pecas" : null;
            return (
              <tr key={r.nome + g} className={`border-t border-border ${j === 2 ? "bg-muted/50 font-semibold" : ""}`}>
                {j === 0 && <><td rowSpan={3} className="px-3 py-2 align-top">{i + 1}</td>
                  <td rowSpan={3} className="whitespace-nowrap px-3 py-2 align-top font-medium">{r.nome}</td>
                  <td rowSpan={3} className="px-3 py-2 align-top">
                    <select value={r.grupo} disabled={busy} onChange={e => onGrupo(r, e.target.value as Grupo)}
                      className="rounded border border-input bg-background px-2 py-1 text-xs print:border-0">
                      <option value="carro">Carro</option>
                      <option value="moto">Moto</option>
                      <option value="outros">Sem grupo</option>
                    </select>
                  </td></>}
                <td className="px-3 py-2">{g}</td>
                <td className="px-3 py-2">{j < 2 ? <In v={j === 0 ? r.servicos : r.pecas} on={v => onEdit(r, j === 0 ? "servicos" : "pecas", v)} dis={busy} /> : brl(x.real)}</td>
                <td className="px-3 py-2">{metaK ? <In v={r[metaK]} on={v => onEdit(r, metaK, v)} dis={busy} /> : brl(x.meta)}</td>
                <td className="px-3 py-2"><Barra p={x.perf} /></td>
                <td className="px-3 py-2">{brl(x.proj)}</td>
                <td className={`px-3 py-2 font-semibold ${tone(x.projP)}`}>{x.meta ? pct(x.projP) : "—"}</td>
                <td className="px-3 py-2">{brl(x.dia)}</td>
                <td className="px-3 py-2">{x.meta ? (x.nec ? brl(x.nec) : "✔ batida") : "sem meta"}</td>
                {j === 0 && <><td rowSpan={3} className="px-3 py-2 align-top"><In v={r.passagens} on={v => onEdit(r, "passagens", v)} dis={busy} money={false} /></td>
                  <td rowSpan={3} className="px-3 py-2 align-top">{brl(div(t.real, r.passagens))}</td>
                  <td rowSpan={3} className="px-3 py-2 align-top print:hidden"><button onClick={() => onRem(r)} className="text-xs text-destructive">remover</button></td></>}
              </tr>
            );
          }))}
          {!b.calcs.length && <tr><td colSpan={14} className="px-3 py-6 text-center text-muted-foreground">{vazio || "Importe o relatório \"Faturamento Líquido dos Produtivos\" para começar."}</td></tr>}
        </Tabela>
      </Box>
    </div>
  );
}

function In({ v, on, dis, money = true }: { v: number; on: (v: number) => void; dis: boolean; money?: boolean }) {
  const [t, setT] = useState(String(v));
  useEffect(() => setT(String(v)), [v]);
  return <input value={t} disabled={dis} onChange={e => setT(e.target.value)} onBlur={() => on(parseNum(t))} title={money ? brl(v) : num(v)}
    className="w-28 rounded border border-input bg-background px-2 py-1 text-right print:border-0" />;
}
