import { useEffect, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Barra, Box, Kpi, Tabela, brl, div, norm, num, parseNum, pct, tone, uni } from "@/components/painel-ui";
import { CATEGORIAS, GRUPO_NOME, blocoMec, ehRelatorioPassagens, grupoDe, lerPassagens, ocultoDaLista, somarComposicao, type CatKey, type Composicao, type Grupo, type Mec, type MecBloco, type PassReport, lerMecanicos } from "@/lib/mecanicos";
import { registrarUpdate } from "@/lib/update-log";
import { MecanicosIA } from "@/components/MecanicosIA";

const asGrupo = (v: string): Grupo => (v === "carro" || v === "moto" ? v : "outros");

type Previa =
  | { tipo: "fat"; rows: { nome: string; servicos: number; pecas: number }[]; periodo: { ini: string; fim: string } | null }
  | { tipo: "pass"; r: PassReport };
type Filtro = "todos" | "carro" | "moto";
const dataBR = (s: string) => s.split("-").reverse().join("/");

export function Mecanicos({ mes, tot, dec, modo = "ver" }: { mes: string; tot: number; dec: number; modo?: "ver" | "importar" }) {
  const fileFat = useRef<HTMLInputElement>(null);
  const filePass = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Mec[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [ult, setUlt] = useState<{ fat?: { quando: string; nome: string }; pass?: { quando: string; nome: string } }>({});

  const loadUlt = async () => {
    const { data } = await supabase.from("update_log").select("origem,nome,at").eq("mes", mes).order("at", { ascending: false }).limit(200);
    const out: typeof ult = {};
    for (const r of data ?? []) {
      const v = { quando: new Date(r.at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }), nome: String(r.nome ?? "").split("@")[0]! };
      if (!out.pass && /^Passagens/.test(r.origem)) out.pass = v;
      if (!out.fat && /^Técnicos \((importação|colar)\)/.test(r.origem)) out.fat = v;
    }
    setUlt(out);
  };

  const load = async () => {
    const { data, error } = await supabase.from("mech_month").select("id,nome,grupo,servicos,pecas,passagens,meta_servicos,meta_pecas,composicao").eq("mes", mes).order("nome");
    if (error) { setMsg(error.message); return; }
    let lst: Mec[] = (data ?? []).map(r => ({ ...r, grupo: asGrupo(r.grupo), composicao: (r.composicao ?? {}) as Composicao }));
    // quem ainda está sem grupo herda o grupo do mês mais recente em que apareceu
    const sem = lst.filter(r => r.grupo === "outros").map(r => r.nome);
    if (sem.length) {
      const { data: old } = await supabase.from("mech_month").select("nome,grupo,mes").in("nome", sem).neq("mes", mes).neq("grupo", "outros").order("mes", { ascending: false });
      const m = new Map<string, Grupo>();
      for (const o of old ?? []) { const k = norm(o.nome); if (!m.has(k)) m.set(k, asGrupo(o.grupo)); }
      lst = lst.map(r => ({ ...r, grupo: m.get(norm(r.nome)) ?? r.grupo }));
    }
    setRows(lst);
    void loadUlt();
  };
  useEffect(() => { void load(); setPrevia(null); }, [mes]);
  useEffect(() => {
    const f = () => { void load(); };
    window.addEventListener("tecnicos-atualizados", f); window.addEventListener("focus", f);
    return () => { window.removeEventListener("tecnicos-atualizados", f); window.removeEventListener("focus", f); };
  }, [mes]);

  const gravar = async (lst: Mec[], origem: string) => {
    if (!lst.length) return false;
    setBusy(true);
    const { error } = await supabase.from("mech_month").upsert(lst.map(({ id: _i, ...r }) => ({ ...r, mes, updated_at: new Date().toISOString() })), { onConflict: "user_id,mes,nome" });
    setBusy(false);
    if (error) { setMsg("Erro ao salvar: " + error.message); return false; }
    await registrarUpdate(origem, mes); await load(); return true;
  };
  const base = (nome: string): Mec => rows.find(r => norm(r.nome) === norm(nome)) ?? { nome: nome.trim().toUpperCase(), grupo: grupoDe(nome), servicos: 0, pecas: 0, passagens: 0, meta_servicos: 0, meta_pecas: 0 };

  const ler = async (f: File) => {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(await f.arrayBuffer(), { type: "array" });
    return XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0] ?? ""]!, { header: 1, defval: "" });
  };

  const escolher = async (tipo: "fat" | "pass", f?: File) => {
    if (!f) return;
    setMsg(""); setPrevia(null);
    try {
      const raw = await ler(f);
      const ehPass = ehRelatorioPassagens(raw);
      if (tipo === "fat") {
        if (ehPass) throw new Error('Este arquivo é o relatório de Passagens. Use o botão "Importar Passagens".');
        const r = lerMecanicos(raw);
        setPrevia({ tipo: "fat", rows: r.rows, periodo: r.periodo });
      } else {
        if (!ehPass) throw new Error('Este arquivo não é o relatório "Passagem tecnico+consultor" (precisa das colunas ID O.S., Consultor e Produtivo). Para faturamento use "Importar Faturamento".');
        setPrevia({ tipo: "pass", r: lerPassagens(raw) });
      }
    } catch (e) { setMsg((e as Error).message); }
    if (fileFat.current) fileFat.current.value = "";
    if (filePass.current) filePass.current.value = "";
  };

  const confirmar = async () => {
    if (!previa) return;
    if (previa.tipo === "fat") {
      const r = previa;
      if (r.periodo && r.periodo.fim.slice(0, 7) !== mes && !confirm(`O relatório é de ${r.periodo.ini.slice(0, 7)}, mas o mês aberto é ${mes}. Importar mesmo assim neste mês?`)) return;
      const ok = await gravar(r.rows.map(x => ({ ...base(x.nome), servicos: x.servicos, pecas: x.pecas })), "Técnicos (importação)");
      if (ok) {
        const semGrupo = r.rows.filter(x => grupoDe(x.nome) === "outros").length;
        setMsg(`${r.rows.length} técnicos importados. Valores do mês substituídos, sem somar.${semGrupo ? ` ${semGrupo} ficaram em "Sem grupo definido".` : ""}`);
        setPrevia(null);
      }
    } else { await importarPassagens(previa.r); setPrevia(null); }
  };

  const importarPassagens = async (r: PassReport) => {
    setBusy(true);
    const mecs = r.mecanicos.map(x => ({ ...base(x.nome), passagens: x.passagens, composicao: x.composicao ?? {} }));
    const { error: eM } = await supabase.from("mech_month").upsert(mecs.map(({ id: _i, ...m }) => ({ ...m, mes, updated_at: new Date().toISOString() })), { onConflict: "user_id,mes,nome" });
    if (eM) { setBusy(false); setMsg("Erro ao salvar passagens dos técnicos: " + eM.message); return; }
    const { data: cons } = await supabase.from("consultants").select("id,nome");
    const byNome = new Map((cons ?? []).map(c => [norm(c.nome).replace(/\s+/g, " "), c.id]));
    const [y, m] = mes.split("-").map(Number);
    const dia = `${mes}-${String(new Date(y!, m!, 0).getDate()).padStart(2, "0")}`;
    const vRows = r.consultores.filter(x => byNome.has(norm(x.nome).replace(/\s+/g, " ")))
      .map(x => ({ consultant_id: byNome.get(norm(x.nome).replace(/\s+/g, " "))!, dia, passagens: x.passagens }));
    const ignorados = r.consultores.length - vRows.length;
    if (vRows.length) {
      const { error: eV } = await supabase.from("agg_visits").upsert(vRows, { onConflict: "consultant_id,dia" });
      if (eV) { setBusy(false); setMsg("Erro ao salvar passagens dos consultores: " + eV.message); return; }
    }
    setBusy(false);
    await registrarUpdate("Passagens (importação)", mes);
    await load();
    setMsg(`Passagens importadas: ${r.mecanicos.length} técnicos e ${vRows.length} consultores (O.S. repetidas contadas uma única vez).${ignorados ? ` ${ignorados} consultores não cadastrados foram ignorados.` : ""} Totais do mês substituídos, sem somar.`);
  };

  const mudarGrupo = (r: Mec, g: Grupo) => { if (r.grupo !== g) void gravar([{ ...r, grupo: g }], "Técnicos (grupo)"); };
  const remover = async (r: Mec) => { if (r.id && confirm(`Remover ${r.nome} deste mês?`)) { await supabase.from("mech_month").delete().eq("id", r.id); await load(); } };

  const EQUIPE = blocoMec(rows, dec, tot);
  const G: Record<Grupo, MecBloco> = {
    carro: blocoMec(rows.filter(r => r.grupo === "carro"), dec, tot),
    moto: blocoMec(rows.filter(r => r.grupo === "moto"), dec, tot),
    outros: blocoMec(rows.filter(r => r.grupo === "outros"), dec, tot),
  };
  const ver = (g: Grupo) => filtro === "todos" || filtro === g;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        {modo === "ver" && <div className="inline-flex rounded-lg border border-border p-1">
          {(["todos", "carro", "moto"] as const).map(f => (
            <button key={f} onClick={() => setFiltro(f)} className={`rounded-md px-3 py-1.5 text-sm font-medium ${filtro === f ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
              {f === "todos" ? "Todos" : f === "carro" ? "Carro" : "Moto"}
            </button>
          ))}
        </div>}
        <div className="flex flex-wrap gap-2 text-xs">
          <span className={`rounded-md px-2 py-1 ${ult.fat ? "bg-muted" : "bg-destructive/15 text-destructive"}`}>Faturamento: {ult.fat ? `${ult.fat.quando} · ${ult.fat.nome}` : "não importado neste mês"}</span>
          <span className={`rounded-md px-2 py-1 ${ult.pass ? "bg-muted" : "bg-destructive/15 text-destructive"}`}>Passagens: {ult.pass ? `${ult.pass.quando} · ${ult.pass.nome}` : "não importadas neste mês"}</span>
        </div>
      </div>

      {modo === "ver" && <>
      {filtro === "todos" && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi label="Faturado Serviços (equipe toda)" value={brl(EQUIPE.S.real)} sub={`meta ${brl(EQUIPE.S.meta)} · ${pct(EQUIPE.S.perf)}`} cls={tone(EQUIPE.S.perf)} />
        <Kpi label="Faturado Peças (equipe toda)" value={brl(EQUIPE.P.real)} sub={`meta ${brl(EQUIPE.P.meta)} · ${pct(EQUIPE.P.perf)}`} cls={tone(EQUIPE.P.perf)} />
        <Kpi label="Passagens (equipe toda)" value={uni(EQUIPE.pass)} sub={`ticket médio ${brl(div(EQUIPE.T.real, EQUIPE.pass))}`} />
        <Kpi label="Projeção Serviços / Peças" value={brl(EQUIPE.S.proj)} sub={<>peças {brl(EQUIPE.P.proj)} · {pct(EQUIPE.S.projP)} / {pct(EQUIPE.P.projP)}</>} cls={tone(EQUIPE.S.projP)} />
        <Kpi label="Necessidade diária" value={brl(EQUIPE.T.nec) + "/dia"} sub={<>serviços {brl(EQUIPE.S.nec)}/dia · peças {brl(EQUIPE.P.nec)}/dia</>} />
      </div>}

      {ver("carro") && <GrupoSec rotulo="Carro" titulo={GRUPO_NOME.carro} b={G.carro} dec={dec} tot={tot} busy={busy} onGrupo={mudarGrupo} onRem={remover}
        vazio="Nenhum técnico de carro neste mês." />}
      {ver("moto") && <GrupoSec rotulo="Moto" titulo={GRUPO_NOME.moto} b={G.moto} dec={dec} tot={tot} busy={busy} onGrupo={mudarGrupo} onRem={remover}
        vazio="Nenhum técnico de moto neste mês." />}
      {filtro === "todos" && G.outros.n > 0 && <GrupoSec rotulo="" titulo={GRUPO_NOME.outros} b={G.outros} dec={dec} tot={tot} busy={busy} onGrupo={mudarGrupo} onRem={remover}
        vazio="" dica="Troque para Carro ou Moto no seletor abaixo do nome." />}

      <MecanicosIA mes={mes} tot={tot} dec={dec} blocos={[
        { k: "carro", nome: GRUPO_NOME.carro, b: G.carro },
        { k: "moto", nome: GRUPO_NOME.moto, b: G.moto },
        { k: "outros", nome: GRUPO_NOME.outros, b: G.outros },
      ]} />
      <p className="text-xs text-muted-foreground print:hidden">Faturamento e passagens são importados na aba <b>Importações</b>. As metas dos técnicos ficam em <b>Configurar → Técnicos e metas</b>.</p>
      </>}

      {modo === "importar" && <div className="grid gap-4 print:hidden">
        <Box title="Importar planilhas do sistema">
          <div className="space-y-4 p-5 text-sm">
            <div className="space-y-2">
              <p className="text-muted-foreground"><b>1. Faturamento</b> — relatório "Faturamento Líquido dos Produtivos" (Srv Total e Peças).</p>
              <input ref={fileFat} type="file" accept=".xls,.xlsx" hidden onChange={e => escolher("fat", e.target.files?.[0])} />
              <Button onClick={() => fileFat.current?.click()} disabled={busy}><Upload className="mr-2 size-4" />Importar Faturamento</Button>
            </div>
            <div className="space-y-2">
              <p className="text-muted-foreground"><b>2. Passagens</b> — relatório "Passagem tecnico+consultor". Cada O.S. conta uma única vez por técnico e por consultor.</p>
              <input ref={filePass} type="file" accept=".xls,.xlsx" hidden onChange={e => escolher("pass", e.target.files?.[0])} />
              <Button variant="outline" onClick={() => filePass.current?.click()} disabled={busy}><Upload className="mr-2 size-4" />Importar Passagens</Button>
            </div>
            {previa && <div className="space-y-2 rounded-lg border border-primary/40 bg-muted/40 p-3">
              <p className="font-semibold">Conferência antes de salvar</p>
              {previa.tipo === "fat" ? <>
                <p className="text-xs text-muted-foreground">{previa.periodo ? `Período ${dataBR(previa.periodo.ini)} a ${dataBR(previa.periodo.fim)} · ` : ""}{previa.rows.length} técnicos · serviços {brl(previa.rows.reduce((a, r) => a + r.servicos, 0))} · peças {brl(previa.rows.reduce((a, r) => a + r.pecas, 0))}</p>
                <div className="max-h-56 overflow-auto text-xs">
                  {previa.rows.map(r => <div key={r.nome} className="flex justify-between gap-2 border-t border-border py-1"><span>{r.nome}</span><span className="whitespace-nowrap">{brl(r.servicos)} · {brl(r.pecas)}</span></div>)}
                </div>
              </> : <>
                <p className="text-xs text-muted-foreground">{previa.r.mecanicos.length} técnicos ({uni(previa.r.mecanicos.reduce((a, r) => a + r.passagens, 0))} passagens) · {previa.r.consultores.length} consultores</p>
                <div className="max-h-56 overflow-auto text-xs">
                  {previa.r.mecanicos.map(r => <div key={r.nome} className="flex justify-between gap-2 border-t border-border py-1"><span>{r.nome}</span><span>{uni(r.passagens)}</span></div>)}
                </div>
              </>}
              <p className="text-xs text-muted-foreground">Salvar substitui os valores do mês (não soma).</p>
              <div className="flex gap-2">
                <Button onClick={confirmar} disabled={busy}>Confirmar e salvar</Button>
                <Button variant="outline" onClick={() => setPrevia(null)} disabled={busy}>Cancelar</Button>
              </div>
            </div>}
            {msg && <p role="status" className="text-sm">{msg}</p>}
          </div>
        </Box>
      </div>}
    </div>
  );
}

function GrupoSec({ rotulo, titulo, b, dec, tot, busy, onGrupo, onRem, vazio, dica }: {
  rotulo: string; titulo: string; b: MecBloco; dec: number; tot: number; busy: boolean;
  onGrupo: (r: Mec, g: Grupo) => void; onRem: (r: Mec) => void;
  vazio: string; dica?: string;
}) {
  const suf = rotulo ? ` ${rotulo}` : "";
  const visiveis = b.calcs.filter(c => !ocultoDaLista(c.r.nome));
  const ocultos = b.n - visiveis.length;
  const [aberto, setAberto] = useState<string | null>(null);
  const temComp = b.calcs.some(c => CATEGORIAS.some(k => (c.r.composicao?.[k.k]?.length ?? 0) > 0));
  const alvo = aberto === "__total" ? { nome: `Total${suf}`, comp: somarComposicao(b.calcs.map(c => c.r.composicao)) }
    : aberto ? { nome: aberto, comp: somarComposicao([b.calcs.find(c => c.r.nome === aberto)?.r.composicao]) } : null;
  return (
    <div className="space-y-4">
      {temComp && <Box title={`Passagens por tipo${suf}`} right={<span className="text-xs">toque no nome para ver o detalhe</span>}>
        <div className="flex flex-wrap gap-2 p-3">
          {[...visiveis.map(c => c.r.nome), "__total"].map(n => (
            <button key={n} onClick={() => setAberto(aberto === n ? null : n)}
              className={`rounded-full border px-3 py-1 text-xs ${aberto === n ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}>
              {n === "__total" ? "TOTAL" : n}
            </button>
          ))}
        </div>
        {alvo && <ComposicaoDet nome={alvo.nome} comp={alvo.comp} />}
      </Box>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi label={`Faturado Serviços${suf}`} value={brl(b.S.real)} sub={`meta ${brl(b.S.meta)} · ${pct(b.S.perf)}`} cls={tone(b.S.perf)} />
        <Kpi label={`Faturado Peças${suf}`} value={brl(b.P.real)} sub={`meta ${brl(b.P.meta)} · ${pct(b.P.perf)}`} cls={tone(b.P.perf)} />
        <Kpi label="Passagens" value={uni(b.pass)} sub={`ticket médio ${brl(div(b.T.real, b.pass))}`} />
        <Kpi label="Projeção Serviços / Peças" value={brl(b.S.proj)} sub={<>peças {brl(b.P.proj)} · {pct(b.S.projP)} / {pct(b.P.projP)}</>} cls={tone(b.S.projP)} />
        <Kpi label="Necessidade diária" value={brl(b.T.nec) + "/dia"} sub={<>serviços {brl(b.S.nec)}/dia · peças {brl(b.P.nec)}/dia</>} />
      </div>

      <Box title={titulo} right={<span className="text-xs">{visiveis.length} {visiveis.length === 1 ? "técnico" : "técnicos"}{ocultos ? ` + ${ocultos} técnico${ocultos > 1 ? "s" : ""} de diagnóstico (somado nos totais)` : ""} · {dec} de {tot} dias{dica ? ` · ${dica}` : ""}</span>}>
        <div className="space-y-3 p-3 md:hidden print:hidden">
          {visiveis.map(({ r, s, p, t }, i) => (
            <div key={r.nome} className="lux-card p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold leading-tight">{i + 1}. {r.nome}</div>
                  <select value={r.grupo} disabled={busy} onChange={e => onGrupo(r, e.target.value as Grupo)} className="mt-1 rounded border border-input bg-background px-1 py-0.5 text-[11px] text-muted-foreground">
                    <option value="carro">Carro</option><option value="moto">Moto</option><option value="outros">Sem grupo</option>
                  </select>
                </div>
                <div className="text-right text-xs">
                  <div className="text-base font-bold">{brl(t.real)}</div>
                  <div className={tone(t.perf)}>{t.meta ? pct(t.perf) : "sem meta"}</div>
                </div>
              </div>
              {([["Serviços", s], ["Peças", p]] as const).map(([g, x]) => (
                <div key={g} className="mt-3 space-y-1 border-t border-border pt-2 text-xs">
                  <div className="flex items-center justify-between gap-2"><b>{g}</b><Barra p={x.perf} /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="text-muted-foreground">Faturado<div className="font-semibold text-foreground">{brl(x.real)}</div></div>
                    <div className="text-muted-foreground">Meta<div className="font-semibold text-foreground">{x.meta ? brl(x.meta) : "sem meta"}</div></div>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Projeção <b className={x.meta ? tone(x.projP) : ""}>{brl(x.proj)}</b></span>
                    <span>{x.meta ? (x.nec ? `falta ${brl(x.nec)}/dia` : "✔ batida") : "sem meta"}</span>
                  </div>
                </div>
              ))}
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-2 text-xs">
                <span className="text-muted-foreground">Passagens <b className="text-foreground">{uni(r.passagens)}</b></span>
                <span className="text-muted-foreground">ticket {brl(div(t.real, r.passagens))}</span>
                <button onClick={() => onRem(r)} className="text-destructive">remover</button>
              </div>
            </div>
          ))}
          {!visiveis.length && <p className="py-6 text-center text-sm text-muted-foreground">{vazio || "Importe o relatório de faturamento para começar."}</p>}
        </div>
        <div className="hidden md:block print:block">
        <Tabela head={["#", "Técnico", "Linha", "Faturado", "Meta", "Perf.", "Projeção", "Média · Precisa/dia", "Passagens", ""]}>
          {visiveis.map(({ r, s, p, t }, i) => (["Serviços", "Peças", "Total"] as const).map((g, j) => {
            const x = j === 0 ? s : j === 1 ? p : t;
            return (
              <tr key={r.nome + g} className={`border-t border-border ${j === 2 ? "bg-muted/50 font-semibold" : ""}`}>
                {j === 0 && <><td rowSpan={3} className="px-2 py-1.5 align-top text-xs">{i + 1}</td>
                  <td rowSpan={3} className="px-2 py-1.5 align-top font-medium">
                    <div className="max-w-[170px] leading-tight">{r.nome}</div>
                    <select value={r.grupo} disabled={busy} onChange={e => onGrupo(r, e.target.value as Grupo)} title="Grupo"
                      className="mt-1 rounded border border-input bg-background px-1 py-0.5 text-[11px] text-muted-foreground print:hidden">
                      <option value="carro">Carro</option>
                      <option value="moto">Moto</option>
                      <option value="outros">Sem grupo</option>
                    </select>
                  </td></>}
                <td className="whitespace-nowrap px-2 py-1.5">{g}</td>
                <td className="whitespace-nowrap px-2 py-1.5">{brl(x.real)}</td>
                <td className="whitespace-nowrap px-2 py-1.5 text-muted-foreground">{x.meta ? brl(x.meta) : "sem meta"}</td>
                <td className="whitespace-nowrap px-2 py-1.5"><Barra p={x.perf} /></td>
                <td className="whitespace-nowrap px-2 py-1.5">{brl(x.proj)}{x.meta ? <span className={`ml-1 text-xs font-semibold ${tone(x.projP)}`}>{pct(x.projP)}</span> : null}</td>
                <td className="whitespace-nowrap px-2 py-1.5 text-xs">
                  <div className="text-muted-foreground">média {brl(x.dia)}</div>
                  <div>{x.meta ? (x.nec ? `falta ${brl(x.nec)}/dia` : "✔ batida") : "sem meta"}</div>
                </td>
                {j === 0 && <><td rowSpan={3} className="whitespace-nowrap px-2 py-1.5 align-top">
                    <div className="font-medium">{uni(r.passagens)}</div>
                    <div className="mt-1 text-[11px] text-muted-foreground">ticket {brl(div(t.real, r.passagens))}</div>
                  </td>
                  <td rowSpan={3} className="px-2 py-1.5 align-top print:hidden"><button onClick={() => onRem(r)} className="text-xs text-destructive">remover</button></td></>}
              </tr>
            );
          }))}
          {!visiveis.length && <tr><td colSpan={10} className="px-3 py-6 text-center text-muted-foreground">{vazio || "Importe o relatório \"Faturamento Líquido dos Produtivos\" para começar."}</td></tr>}
        </Tabela>
        </div>
      </Box>
      {rotulo && visiveis.length > 0 && <Oficina rotulo={rotulo} b={b} visiveis={visiveis} dec={dec} tot={tot} />}
    </div>
  );
}

const pc = (v: number) => `${Math.round(v * 100)}%`;
function textoOficina(rotulo: string, b: MecBloco, vis: MecBloco["calcs"], dec: number, tot: number) {
  const tkGrupo = div(b.T.real, b.pass);
  const L: string[] = [`🔧 *Oficina ${rotulo.toUpperCase()} — como estamos* (dia ${dec} de ${tot})`, "",
    `Equipe: serviços ${brl(b.S.real)}${b.S.meta ? ` (${pc(b.S.perf)} da meta)` : ""} · peças ${brl(b.P.real)}${b.P.meta ? ` (${pc(b.P.perf)} da meta)` : ""}`,
    b.T.nec ? `Pra bater a meta falta *${brl(b.T.nec)} por dia* no grupo.` : "", ""];
  vis.forEach(({ r, s, p, t }, i) => {
    const tk = div(t.real, r.passagens);
    const dicas: string[] = [];
    if (!s.meta && !p.meta) dicas.push("ainda sem meta cadastrada");
    if (s.meta && s.perf < 0.85) dicas.push(`serviços abaixo: em todo carro que entrar, faça o checklist completo e avise o consultor do que precisa (falta ${brl(s.nec)}/dia)`);
    else if (s.meta && s.perf < 1) dicas.push(`serviços quase lá: falta ${brl(s.nec)}/dia`);
    if (p.meta && p.perf < 0.85) dicas.push(`peças abaixo: achou desgaste (pastilha, filtro, fluido, pneu), tira foto e manda pro consultor oferecer (falta ${brl(p.nec)}/dia)`);
    else if (p.meta && p.perf < 1) dicas.push(`peças quase lá: falta ${brl(p.nec)}/dia`);
    if (r.passagens && tkGrupo && tk < tkGrupo * 0.8) dicas.push("valor por carro baixo: aproveite cada passagem pra revisar o veículo todo");
    if (!dicas.length) dicas.push("mandou bem, mantém o ritmo 👏");
    L.push(`${i + 1}. *${r.nome}*`, `   Serviços ${brl(r.servicos)}${s.meta ? ` (${pc(s.perf)})` : ""} · Peças ${brl(r.pecas)}${p.meta ? ` (${pc(p.perf)})` : ""} · ${uni(r.passagens)} carros`,
      ...dicas.map(d => `   👉 ${d}`), "");
  });
  L.push("Bora pra cima, time! 💪");
  return L.filter((x, i, a) => !(x === "" && a[i - 1] === "")).join("\n");
}

function Oficina({ rotulo, b, visiveis, dec, tot }: { rotulo: string; b: MecBloco; visiveis: MecBloco["calcs"]; dec: number; tot: number }) {
  const txt = textoOficina(rotulo, b, visiveis, dec, tot);
  const [ok, setOk] = useState(false);
  const pdf = () => {
    const w = window.open("", "_blank"); if (!w) return;
    const esc = (x: string) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\*/g, "");
    w.document.write(`<html><head><title>Oficina ${rotulo}</title></head><body style="font-family:sans-serif;font-size:15px;white-space:pre-wrap;padding:24px">${esc(txt)}</body></html>`);
    w.document.close(); w.focus(); w.print();
  };
  return (
    <Box title={`Resumo para o grupo da oficina — ${rotulo}`} right={<span className="text-xs">linguagem simples · sem custo</span>}>
      <div className="space-y-3 print:hidden">
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, "_blank")}>Enviar no WhatsApp ({rotulo})</Button>
          <Button variant="outline" onClick={async () => { await navigator.clipboard.writeText(txt); setOk(true); setTimeout(() => setOk(false), 2000); }}>{ok ? "Copiado!" : "Copiar"}</Button>
          <Button variant="outline" onClick={pdf}>Imprimir / PDF</Button>
        </div>
        <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-3 text-xs">{txt}</pre>
      </div>
    </Box>
  );
}


function ComposicaoDet({ nome, comp }: { nome: string; comp: Required<Composicao> }) {
  const [cat, setCat] = useState<CatKey | "todas">("todas");
  const total = CATEGORIAS.reduce((a, c) => a + comp[c.k].length, 0);
  const lista = cat === "todas" ? [] : comp[cat];
  return (
    <div className="space-y-3 border-t border-border p-3">
      <div className="text-sm font-semibold">{nome} · {uni(total)} O.S. únicas</div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {CATEGORIAS.map(c => (
          <button key={c.k} onClick={() => setCat(cat === c.k ? "todas" : c.k)} title={c.desc}
            className={`rounded-lg border p-2 text-left ${cat === c.k ? "border-primary bg-primary/10" : "border-border bg-card"}`}>
            <div className="text-[11px] text-muted-foreground">{c.nome}</div>
            <div className="text-lg font-bold">{uni(comp[c.k].length)}</div>
          </button>
        ))}
      </div>
      {cat !== "todas" && <div className="text-xs">
        <div className="mb-1 text-muted-foreground">{CATEGORIAS.find(c => c.k === cat)?.desc} — O.S.:</div>
        <div className="flex flex-wrap gap-1">{lista.length ? lista.map(o => <span key={o} className="rounded bg-muted px-1.5 py-0.5">{o}</span>) : <span className="text-muted-foreground">nenhuma</span>}</div>
      </div>}
    </div>
  );
}
