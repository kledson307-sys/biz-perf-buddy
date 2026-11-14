import { useEffect, useMemo, useState } from "react";
import { SyncPlanilhas } from "@/components/SyncPlanilhas";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { pct, uni } from "@/components/painel-ui";
import {
  LOJA_PADRAO, META_PROMOTOR, daLoja, acaoFollowUp, baseNps, classe, filaFollowUp, filtrarPeriodo, historicoDetratores, lerAbaNps, resumir, faltamPromotores, TRATATIVA_LABEL, type TratativaSt,
  type NpsItem, type Segmento,
} from "@/lib/nps";

const hojeISO = () => new Date().toISOString().slice(0, 10);
const dataBR = (s: string) => (s ? s.split("-").reverse().join("/") : "—");
const corProm = (p: number, meta: number) => (p >= meta ? "text-success" : p >= meta - 0.05 ? "text-warning" : "text-destructive");
const corNps = (n: number) => (n >= 0.8 ? "text-success" : n >= 0.7 ? "text-warning" : "text-destructive");
const sNps = (n: number) => (n > 0 ? "+" : "") + (n * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const wa = (tel: string, msg: string) => `https://wa.me/55${tel.replace(/^55/, "")}?text=${encodeURIComponent(msg)}`;

/** Painel NPS & Satisfação (gestão). `itens` vem do último import compartilhado. */
export function NpsPainel({ mes = new Date().toISOString().slice(0, 7) }: { mes?: string }) {
  const [periodo, setPeriodo] = useState<"mes" | "ano">("mes");
  const [todosItens, setItens] = useState<NpsItem[] | null>(null);
  const itens = useMemo(() => todosItens && filtrarPeriodo(todosItens, periodo === "mes" ? mes : mes.slice(0, 4)), [todosItens, periodo, mes]);
  const mesLabel = mes.split("-").reverse().join("/");
  const [info, setInfo] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [seg, setSeg] = useState<"todos" | Segmento>("todos");
  const [filtro, setFiltro] = useState<"todos" | "detrator" | "neutro" | "promotor" | "rac">("detrator");
  const [busca, setBusca] = useState("");

  const [trat, setTrat] = useState<Record<string, { st: TratativaSt; nota: string; at: string; por: string }>>({});
  useEffect(() => { void supabase.from("os_acompanhamento").select("os_n,acoes").like("os_n", "nps:%").then(({ data }) => setTrat(Object.fromEntries((data ?? []).map((x) => [x.os_n, (x.acoes as { __nps?: never })?.__nps ?? { st: "pendente", nota: "", at: "", por: "" }])))); }, []);
  const salvarTrat = async (k: string, v: { st: TratativaSt; nota: string }) => {
    const { data: u } = await supabase.auth.getUser();
    const reg = { ...v, at: new Date().toISOString(), por: u.user?.email?.split("@")[0] ?? "" };
    setTrat((p) => ({ ...p, [k]: reg }));
    const { error } = await supabase.from("os_acompanhamento").upsert({ os_n: k, acoes: { __nps: reg } as never, updated_at: reg.at }, { onConflict: "user_id,os_n" });
    if (error) setMsg("Erro ao salvar tratativa: " + error.message);
  };
  const [tecCh, setTecCh] = useState<Record<string, string>>({});
  useEffect(() => { void supabase.from("oficina_mes").select("mes,diario").like("mes", "tecchassi-%").order("mes").then(({ data }) => setTecCh(Object.assign({}, ...(data ?? []).map((x) => (x.diario as Record<string, string>) ?? {})))); }, []);
  const load = async () => {
    const { data } = await supabase.from("nps_imports").select("itens, at, nome").order("at", { ascending: false }).limit(1).maybeSingle();
    setItens((data?.itens as unknown as NpsItem[]) ?? []);
    setInfo(data ? `Atualizado em ${new Date(data.at).toLocaleString("pt-BR")} por ${data.nome}` : "");
  };
  useEffect(() => { void load(); }, []);

  const importar = async (f?: File) => {
    if (!f) return;
    setBusy(true); setMsg("");
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await f.arrayBuffer(), { type: "array", cellDates: true });
      const lst = wb.SheetNames.flatMap((s) => lerAbaNps(XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[s]!, { header: 1, defval: "" }), s));
      if (!lst.length) { setMsg("Não reconheci a planilha de NPS (faltam as colunas NOTA PSI e CONSULTOR)."); return; }
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("nps_imports").insert({ itens: lst as never, arquivo: f.name, nome: u.user?.email?.split("@")[0] ?? "" });
      if (error) { setMsg("Não foi possível salvar: " + error.message); return; }
      await supabase.from("update_log").insert({ nome: u.user?.email?.split("@")[0] ?? "", origem: "NPS", mes: hojeISO().slice(0, 7) });
      setMsg(`${lst.length} pesquisas importadas (${daLoja(lst).length} de Salvador). A importação anterior foi substituída.`);
      await load();
    } finally { setBusy(false); }
  };

  const loja = useMemo(() => daLoja(itens ?? []), [itens]);
  const vis = seg === "todos" ? loja : loja.filter((x) => x.segmento === seg);
  const r = resumir(vis);
  const metaSeg = seg === "moto" ? META_PROMOTOR.moto : META_PROMOTOR.carro;
  const rc = resumir(loja.filter((x) => x.segmento === "carro")), rm = resumir(loja.filter((x) => x.segmento === "moto"));
  const pjs = loja.filter((x) => x.pj).length;

  const fila = filaFollowUp(vis, hojeISO());
  const detr = historicoDetratores(vis).filter((d) => !busca || (d.item.cliente + d.item.chassi).toUpperCase().includes(busca.toUpperCase()));
  const consultores = [...new Set(baseNps(vis).map((x) => x.consultor))].map((c) => {
    const l = vis.filter((x) => x.consultor === c); const s = resumir(l);
    const segC: Segmento = l.filter((x) => x.segmento === "moto").length > l.length / 2 ? "moto" : "carro";
    return { c, s, meta: META_PROMOTOR[segC] };
  }).filter((x) => x.s.avaliados > 0).sort((a, b) => b.s.nps - a.s.nps);
  const mural = baseNps(vis).filter((x) => x.obs && x.nota !== null && (filtro === "todos" || (filtro === "rac" ? x.rac : classe(x.nota) === filtro))).slice(0, 30);
  const lojas = [...new Set((itens ?? []).map((x) => x.loja))].map((l) => ({ l, s: resumir((itens ?? []).filter((x) => x.loja === l)) })).sort((a, b) => b.s.nps - a.s.nps);
  const motivos = Object.entries(baseNps(vis).filter((x) => x.rac).reduce<Record<string, number>>((a, x) => { const k = x.motivo || "SEM MOTIVO"; a[k] = (a[k] ?? 0) + 1; return a; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 6);

  return (
    <div className="space-y-3">
      <SyncPlanilhas fontes={["nps"]} compacto />
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2">
        <div><h2 className="font-semibold">NPS & Satisfação · {LOJA_PADRAO}</h2><p className="text-xs text-muted-foreground">{info || "Aguardando a primeira importação da planilha de pesquisa da montadora."} {pjs ? `· ${pjs} clientes CNPJ fora da base (não são pesquisados)` : ""}</p></div>
        <div className="flex flex-wrap items-center gap-2">
          {(["mes", "ano"] as const).map((p) => <Button key={p} size="sm" variant={periodo === p ? "default" : "outline"} onClick={() => setPeriodo(p)}>{p === "mes" ? `Acumulado mês (${mesLabel})` : `Acumulado ano (${mes.slice(0, 4)})`}</Button>)}
          <span className="mx-1 h-6 w-px bg-border" />
          {(["todos", "carro", "moto"] as const).map((s) => <Button key={s} size="sm" variant={seg === s ? "default" : "outline"} onClick={() => setSeg(s)}>{s === "todos" ? "Geral" : s === "carro" ? "Carro (meta 85%)" : "Moto (meta 88%)"}</Button>)}
          <label className="cursor-pointer"><span className="inline-flex h-9 items-center rounded-md border border-input px-3 text-sm">{busy ? "Importando…" : "Importar planilha NPS"}</span>
            <input type="file" accept=".xlsx,.xls" className="hidden" disabled={busy} onChange={(e) => { void importar(e.target.files?.[0]); e.target.value = ""; }} /></label>
        </div>
      </div>
      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
      {itens && !loja.length ? <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{todosItens?.length ? "Nenhuma pesquisa recebida neste período." : "Nenhuma pesquisa importada ainda."}</p> : <>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Card l="NPS" v={sNps(r.nps)} cls={corNps(r.nps)} s={`${uni(r.avaliados)} avaliados`} />
          <Card l="% Promotores" v={pct(r.pctProm)} cls={corProm(r.pctProm, metaSeg)} s={seg === "todos" ? `Carro ${pct(rc.pctProm)} · Moto ${pct(rm.pctProm)}` : `meta ${pct(metaSeg)}`} />
          <Card l="Neutros (7-8)" v={uni(r.neu)} s={pct(r.avaliados ? r.neu / r.avaliados : 0)} />
          <Card l="Detratores (1-6)" v={uni(r.det)} cls="text-destructive" s={pct(r.avaliados ? r.det / r.avaliados : 0)} />
          <Card l="RACs abertas" v={uni(r.racs)} s={motivos[0] ? `principal: ${motivos[0][0].toLowerCase()}` : ""} />
        </div>

        <div className="grid gap-2 sm:grid-cols-2">{([["Carro", rc, META_PROMOTOR.carro], ["Moto", rm, META_PROMOTOR.moto]] as const).filter(([, x]) => x.avaliados > 0).map(([n, x, m]) => {
          const f = faltamPromotores(x.prom, x.avaliados, m);
          return <div key={n} className={`rounded-lg border px-3 py-2 text-xs ${f ? "border-warning/50 bg-warning/10" : "border-success/50 bg-success/10"}`}>
            <b>Resgate da trava · {n}</b> — {pct(x.pctProm)} (meta {pct(m)}). {f ? <>Faltam <b className="text-sm">{uni(f)}</b> pesquisas com nota 9/10 seguidas para liberar as premiações.</> : <>Trava liberada: departamento elegível às premiações.</>}
          </div>; })}</div>

        <div className="grid gap-3 lg:grid-cols-2">
          <section className="lux-card px-4 py-3">
            <h3 className="font-semibold">Follow-up D-2 · pesquisa chega em até 2 dias</h3>
            <p className="mb-2 text-xs text-muted-foreground">Ação de conferência e acolhimento: reforce que a nota avalia só o atendimento do consultor.</p>
            {fila.length > 0 && <div className="mb-2 flex flex-wrap gap-1">{[...new Set(fila.map((x) => x.consultor))].map((c) => {
              const l = fila.filter((x) => x.consultor === c);
              const txt = `Bom dia ${c}! Follow-up antes da pesquisa BMW:\n` + l.map((x) => `• ${x.cliente} (${x.veiculo || "veículo"}${x.telefone ? ` · ${x.telefone}` : ""}) — pesquisa ${dataBR(x.recebimento)}`).join("\n") + "\nReforce que a nota avalia o seu atendimento.";
              return <a key={c} target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(txt)}`} className="rounded-full border border-primary px-2 py-0.5 text-[11px] text-primary">Enviar lista a {c} ({l.length})</a>;
            })}</div>}
            <div className="max-h-80 space-y-2 overflow-y-auto xl:max-h-[calc(50vh-250px)]">
              {fila.map((x) => { const a = acaoFollowUp(x.obs); return (
                <div key={x.chassi + x.recebimento} className="rounded-lg border border-border p-2 text-xs">
                  <div className="flex justify-between gap-2"><b>{x.cliente}</b><span className="text-muted-foreground">{x.consultor} · pesquisa {dataBR(x.recebimento)}</span></div>
                  <p className="mt-1">{a}</p>
                  {x.telefone && <a className="mt-1 inline-block text-primary underline" target="_blank" rel="noreferrer" href={wa(x.telefone, `Olá ${x.cliente.split(" ")[0]}, tudo bem? Aqui é da BMW Haus Motors. Passando para saber se ficou tudo certo com seu ${x.veiculo || "veículo"}.`)}>Abrir WhatsApp</a>}
                </div>); })}
              {!fila.length && <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma pesquisa chegando nos próximos 2 dias.</p>}
            </div>
          </section>
          <section className="lux-card px-4 py-3">
            <h3 className="font-semibold">Reversão & encantamento · detratores</h3>
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar cliente ou chassi" className="my-2 h-8 w-full rounded-md border border-input bg-background px-2 text-sm" />
            <div className="max-h-72 space-y-2 overflow-y-auto xl:max-h-[calc(50vh-250px)]">
              {detr.map((d) => (
                <div key={d.item.chassi + d.item.cliente} className="rounded-lg border border-border p-2 text-xs">
                  <div className="flex justify-between gap-2"><b>{d.item.cliente}</b><span className="text-destructive">{d.detr} de {d.passagens} passagens detratadas</span></div>
                  <p className="text-muted-foreground">{d.item.consultor} · {d.item.veiculo} · {d.item.motivo || "sem RAC"}</p>
                  <p className="text-muted-foreground">Técnico: <b className="text-foreground">{tecCh[d.item.chassi.toUpperCase()] ?? "— (importe as Passagens)"}</b></p>
                  <p className="mt-1"><b>Ação:</b> {d.acao}</p>
                  {(() => { const k = `nps:${d.item.chassi || d.item.cliente}`; const t = trat[k] ?? { st: "pendente" as TratativaSt, nota: "", at: "", por: "" }; return <div className="mt-1 flex flex-wrap items-center gap-1">
                    <select aria-label={`Tratativa de ${d.item.cliente}`} value={t.st} onChange={(e) => void salvarTrat(k, { st: e.target.value as TratativaSt, nota: t.nota })} className={`h-6 rounded border border-border bg-background px-1 ${t.st === "resolvido" ? "text-success" : t.st === "contato" ? "text-warning" : "text-destructive"}`}>
                      {(Object.keys(TRATATIVA_LABEL) as TratativaSt[]).map((s2) => <option key={s2} value={s2}>{TRATATIVA_LABEL[s2]}</option>)}
                    </select>
                    <input key={t.nota} defaultValue={t.nota} placeholder="Resumo da ação (quem ligou, o que foi acordado)" aria-label="Resumo da tratativa" onBlur={(e) => { if (e.target.value !== t.nota) void salvarTrat(k, { st: t.st === "pendente" && e.target.value.trim() ? "contato" : t.st, nota: e.target.value }); }} className="h-6 min-w-40 flex-1 rounded border border-border bg-background px-1" />
                    {d.item.telefone && <a className="text-primary underline" target="_blank" rel="noreferrer" href={wa(d.item.telefone, `Olá ${d.item.cliente.split(" ")[0]}, sou Kledson Souza, gestor de pós-vendas da Haus Motors. Recebi sua avaliação sobre a última passagem pela nossa oficina e fiz questão de entrar em contato pessoalmente para entender o ocorrido e garantir que seu ${d.item.veiculo || "veículo"} esteja 100%. Podemos conversar?`)}>Acolher via WhatsApp</a>}
                    {t.at && <span className="w-full text-[10px] text-muted-foreground">{t.por} · {new Date(t.at).toLocaleString("pt-BR")}</span>}
                  </div>; })()}
                </div>
              ))}
              {!detr.length && <p className="py-6 text-center text-sm text-muted-foreground">Nenhum detrator.</p>}
            </div>
          </section>
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          <section className="lux-card px-4 py-3 lg:col-span-1 xl:max-h-[calc(50vh-130px)] xl:overflow-y-auto">
            <h3 className="mb-2 font-semibold">Ranking por consultor</h3>
            <table className="w-full text-xs"><thead className="text-muted-foreground"><tr><th className="text-left">Consultor</th><th>Aval.</th><th>NPS</th><th>% Prom.</th><th>RAC</th></tr></thead>
              <tbody>{consultores.map(({ c, s, meta }) => <tr key={c} className="border-t border-border"><td className="py-1">{c}</td><td className="text-center">{uni(s.avaliados)}</td><td className={`text-center font-semibold ${corNps(s.nps)}`}>{sNps(s.nps)}</td><td className={`text-center ${corProm(s.pctProm, meta)}`}>{pct(s.pctProm)}</td><td className="text-center">{uni(s.racs)}</td></tr>)}</tbody></table>
          </section>
          <section className="lux-card px-4 py-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-1"><h3 className="font-semibold">Verbalizações</h3>
              <select value={filtro} onChange={(e) => setFiltro(e.target.value as typeof filtro)} className="h-7 rounded border border-input bg-background px-1 text-xs">
                <option value="detrator">Detratores</option><option value="neutro">Neutros</option><option value="promotor">Promotores</option><option value="rac">Com RAC</option><option value="todos">Todos</option></select></div>
            <div className="max-h-72 space-y-2 overflow-y-auto xl:max-h-[calc(50vh-185px)] text-xs">
              {mural.map((x, i) => <div key={i} className="rounded border border-border p-2"><b className={x.nota! >= 9 ? "text-success" : x.nota! >= 7 ? "text-warning" : "text-destructive"}>Nota {x.nota}</b> · {x.consultor} · {x.cliente}<p className="mt-1 text-muted-foreground">{x.obs}</p></div>)}
              {!mural.length && <p className="text-muted-foreground">Sem verbalizações neste filtro.</p>}
            </div>
          </section>
          <section className="lux-card px-4 py-3">
            <h3 className="mb-2 font-semibold">Benchmark Grupo Haus</h3>
            {lojas.map(({ l, s }) => <div key={l} className={`flex justify-between border-t border-border py-1 text-sm ${l === LOJA_PADRAO ? "font-bold" : ""}`}><span>{l}</span><span><span className={corNps(s.nps)}>{sNps(s.nps)}</span> · {pct(s.pctProm)} prom. · {uni(s.avaliados)}</span></div>)}
            <h4 className="mt-3 text-xs font-semibold text-muted-foreground">Motivos de RAC</h4>
            {motivos.map(([m, n]) => <div key={m} className="flex justify-between text-xs"><span>{m.toLowerCase()}</span><b>{n}</b></div>)}
          </section>
        </div>
      </>}
    </div>
  );
}

function Card({ l, v, s, cls = "" }: { l: string; v: string; s?: string; cls?: string }) {
  return <div className="lux-card px-3 py-2"><p className="text-xs text-muted-foreground">{l}</p><p className={`text-xl font-bold leading-tight ${cls}`}>{v}</p>{s && <p className="text-[11px] text-muted-foreground">{s}</p>}</div>;
}

/** Bloco compacto de NPS para consultor e chefe de oficina (via RPC restrita). */
export function NpsResumoRestrito({ titulo, meta }: { titulo: string; meta?: number }) {
  const [itens, setItens] = useState<NpsItem[] | null>(null);
  useEffect(() => { void supabase.rpc("meu_nps").then(({ data }) => setItens(((data as { itens?: NpsItem[] } | null)?.itens) ?? [])); }, []);
  if (!itens) return null;
  const r = resumir(itens);
  const m = meta ?? (itens.filter((x) => x.segmento === "moto").length > itens.length / 2 ? META_PROMOTOR.moto : META_PROMOTOR.carro);
  const fila = filaFollowUp(itens, hojeISO());
  const detr = historicoDetratores(itens).slice(0, 5);
  const racTec = baseNps(itens).filter((x) => x.rac && /CONTINUA|QUALIDADE|RETRABALHO/.test(x.motivo));
  return (
    <section className="lux-card space-y-3 p-4">
      <h3 className="font-semibold">{titulo}</h3>
      {!itens.length ? <p className="text-sm text-muted-foreground">Ainda não há pesquisas importadas.</p> : <>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Card l="NPS" v={sNps(r.nps)} cls={corNps(r.nps)} s={`${uni(r.avaliados)} avaliados`} />
          <Card l="% Promotores" v={pct(r.pctProm)} cls={corProm(r.pctProm, m)} s={`meta ${pct(m)}`} />
          <Card l="Detratores" v={uni(r.det)} cls="text-destructive" />
          <Card l={meta ? "RACs técnicas" : "RACs"} v={uni(meta ? racTec.length : r.racs)} />
        </div>
        {fila.length > 0 && <div className="text-xs"><b>Follow-up D-2 ({fila.length})</b>{fila.map((x) => <p key={x.chassi} className="mt-1 border-t border-border pt-1">{x.cliente} · pesquisa {dataBR(x.recebimento)} — {acaoFollowUp(x.obs)}</p>)}</div>}
        {detr.length > 0 && <div className="text-xs"><b>Reversão & encantamento</b>{detr.map((d) => <p key={d.item.chassi} className="mt-1 border-t border-border pt-1">{d.item.cliente} ({d.detr}/{d.passagens} detratadas) — {d.acao}</p>)}</div>}
        {meta && racTec.length > 0 && <div className="text-xs"><b>Verbalizações de qualidade técnica</b>{racTec.slice(0, 5).map((x) => <p key={x.chassi + x.recebimento} className="mt-1 border-t border-border pt-1 text-muted-foreground">{x.veiculo}: {x.obs}</p>)}</div>}
      </>}
    </section>
  );
}
