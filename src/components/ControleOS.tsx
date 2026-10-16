import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Bell, ChevronDown, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { brl, Box, Pizza, Tabela } from "@/components/painel-ui";
import { analisar, comJudicial, ehJudicial, JUDICIAL_KEY, fmt, hoje, retornoDevido, lerRelatorio, STATUS, type Analise, type OsImport, type OsItem, type Status } from "@/lib/os-controle";
import { registrarUpdate } from "@/lib/update-log";
import { NOTIFICATIONS_EVENT } from "@/components/Notificacoes";

const cor = { alto: "text-destructive", medio: "text-warning", info: "text-muted-foreground" } as const;
type Retorno = { id: string; os_n: string; consultor: string; data_ref: string; nota: string; feito_por: string; feito_at: string; visto: boolean };
type Acomp = { acoes: Record<string, { feito: boolean; nota: string; at?: string }>; prev_manual: string | null };

export function ControleOS() {
  const file = useRef<HTMLInputElement>(null);
  const [imps, setImps] = useState<OsImport[]>([]);
  const [sel, setSel] = useState(0);
  const [aba, setAba] = useState<Status>("pronto");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [aberto, setAberto] = useState<string | null>(null);

  const [acomp, setAcomp] = useState<Record<string, Acomp>>({});
  const [rets, setRets] = useState<Retorno[]>([]);
  const load = async () => {
    const { data, error } = await supabase.from("os_imports").select("id,at,nome,arquivo,itens").order("at", { ascending: false }).limit(60);
    if (error) { setMsg(error.message); return; }
    setImps((data ?? []).map(d => ({ ...d, itens: d.itens as unknown as OsItem[] })));
    const r = await supabase.from("os_acompanhamento").select("os_n,acoes,prev_manual");
    if (!r.error) setAcomp(Object.fromEntries((r.data ?? []).map(x => [x.os_n, { acoes: (x.acoes ?? {}) as Acomp["acoes"], prev_manual: x.prev_manual }])));
    const rr = await supabase.from("os_retornos").select("*").order("feito_at", { ascending: false });
    if (!rr.error) setRets((rr.data ?? []) as Retorno[]);
  };
  useEffect(() => { void load(); }, []);
  const ciente = async (ids: string[]) => {
    const { error } = await supabase.from("os_retornos").update({ visto: true }).in("id", ids);
    if (error) setMsg(error.message); else { setRets(p => p.map(r => ids.includes(r.id) ? { ...r, visto: true } : r)); window.dispatchEvent(new Event(NOTIFICATIONS_EVENT)); }
  };
  const salvarAcomp = async (n: string, v: Acomp) => {
    setAcomp(p => ({ ...p, [n]: v }));
    const { error } = await supabase.from("os_acompanhamento").upsert({ os_n: n, acoes: v.acoes as never, prev_manual: v.prev_manual || null, updated_at: new Date().toISOString() }, { onConflict: "user_id,os_n" });
    if (error) setMsg("Erro ao salvar: " + error.message);
  };

  const atual = imps[sel];
  const anterior = imps[sel + 1];
  const ref = atual ? (sel === 0 ? hoje() : atual.at.slice(0, 10)) : hoje();
  const lista = useMemo<Analise[]>(() => (atual?.itens ?? []).map(i => analisar(comJudicial(i, ehJudicial(acomp[i.n]?.acoes)), anterior, ref, acomp[i.n]?.prev_manual)), [atual, anterior, ref, acomp]);
  const lembretes = lista.filter(a => (a.item.st === "diag" && a.diasStatus >= 7) || a.contatoHoje || (a.semMudanca && (a.item.st === "pronto" || a.item.st === "faturar")) || (a.item.st === "pecas" && a.diasStatus > 30));
  const novos = rets.filter(r => !r.visto);
  const atrasados = sel === 0 ? lista.map(a => ({ a, due: retornoDevido(a.item, ref) })).filter(x => x.due && !rets.some(r => r.os_n === x.a.item.n && r.data_ref >= x.due!)) : [];
  const saidas = anterior ? anterior.itens.filter(i => !atual?.itens.some(x => x.n === i.n)) : [];

  const importar = async (f?: File) => {
    if (!f) return;
    setBusy(true); setMsg("");
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await f.arrayBuffer(), { type: "array" });
      const sh = wb.Sheets[wb.SheetNames[0] ?? ""];
      if (!sh) throw new Error("Planilha vazia.");
      const itens = lerRelatorio(XLSX.utils.sheet_to_json<unknown[]>(sh, { header: 1, raw: true, defval: "" }), imps[0], hoje());
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("os_imports").insert({ arquivo: f.name, nome: u.user?.email ?? "", itens: itens as never });
      if (error) throw error;
      await registrarUpdate("Controle de O.S.");
      window.dispatchEvent(new Event(NOTIFICATIONS_EVENT));
      setMsg(`${itens.length} O.S. importadas.`); setSel(0); await load();
    } catch (e) { setMsg("Erro: " + (e as Error).message); }
    finally { setBusy(false); }
  };
  const apagar = async (id: string) => {
    if (!confirm("Apagar esta atualização do histórico?")) return;
    const { error } = await supabase.from("os_imports").delete().eq("id", id);
    if (error) setMsg(error.message); else { setSel(0); await load(); }
  };

  const doStatus = lista.filter(a => a.item.st === aba);
  const porCons = [...new Set(doStatus.map(a => a.item.cons))].sort().map(c => ({ c, l: doStatus.filter(a => a.item.cons === c).sort((x, y) => y.diasStatus - x.diasStatus) }));
  const ranking = useMemo(() => STATUS.map(s => {
    const l = lista.filter(a => a.item.st === s.k);
    const cons = [...new Set(l.map(a => a.item.cons))].map(c => {
      const g = l.filter(a => a.item.cons === c);
      return { c, qtd: g.length, valor: g.reduce((n, a) => n + a.item.valor, 0) };
    }).sort((x, y) => y.qtd - x.qtd || y.valor - x.valor);
    return { s, total: l.length, cons };
  }), [lista]);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Controle de Ordens de Serviço</h2>
          <p className="text-sm text-muted-foreground">{atual ? `Atualização de ${new Date(atual.at).toLocaleString("pt-BR")} · ${atual.itens.length} O.S.${anterior ? ` · comparada com ${new Date(anterior.at).toLocaleDateString("pt-BR")}` : " · primeira atualização"}` : "Importe o relatório geral de O.S. uma vez por semana."}</p>
        </div>
        <Button onClick={() => file.current?.click()} disabled={busy} className="print:hidden"><Upload />{busy ? "Importando…" : "Importar planilha da semana"}</Button>
        <input ref={file} type="file" accept=".xlsx,.xls" className="hidden" aria-label="Planilha de O.S." onChange={e => { void importar(e.target.files?.[0]); e.target.value = ""; }} />
      </div>
      {msg && <p role="status" className="text-sm text-muted-foreground">{msg}</p>}

      {atual && <>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
          {STATUS.map(s => {
            const l = lista.filter(a => a.item.st === s.k);
            const al = l.filter(a => a.alertas.some(x => x.nivel === "alto")).length;
            return <button key={s.k} onClick={() => setAba(s.k)} className={`rounded-lg border p-3 text-left shadow-sm transition ${aba === s.k ? "border-primary bg-accent" : "border-border bg-card hover:bg-muted"}`}>
              <div className="text-xs uppercase text-muted-foreground">{s.nome}</div>
              <div className="text-2xl font-bold">{l.length}</div>
              <div className="text-xs text-muted-foreground">{brl(l.reduce((n, a) => n + a.item.valor, 0))}</div>
              {al > 0 && <div className="mt-1 text-xs font-semibold text-destructive">⚠ {al} alerta{al > 1 ? "s" : ""}</div>}
            </button>;
          })}
        </div>

        <Box title="Ranking por status — gráficos de pizza">
          <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4">
            <CartaoPizza titulo="O.S. por status" sub="distribuição geral" fmt={n => `${n} O.S.`}
              dados={STATUS.map(s => ({ label: s.nome, valor: lista.filter(a => a.item.st === s.k).length }))} />
            {ranking.filter(r => r.total > 0).map(({ s, total, cons }) => (
              <CartaoPizza key={s.k} titulo={s.nome} sub={`${total} O.S. · ${brl(cons.reduce((n, c) => n + c.valor, 0))}`}
                fmt={n => `${n} O.S.`} onClick={() => setAba(s.k)}
                dados={cons.map(c => ({ label: c.c, valor: c.qtd, extra: brl(c.valor) }))} />
            ))}
          </div>
        </Box>

        {novos.length > 0 && <Box title={`Retornos feitos pelos vendedores (${novos.length})`} right={<Button size="sm" variant="outline" onClick={() => void ciente(novos.map(r => r.id))}>Ciente de todos</Button>}>
          <ul className="divide-y divide-border text-sm">
            {novos.map(r => <li key={r.id} className="flex flex-wrap items-center gap-x-3 px-5 py-2">
              <span className="font-semibold">O.S. {r.os_n}</span><span>{r.consultor}</span>
              <span className="text-muted-foreground">{new Date(r.feito_at).toLocaleString("pt-BR")}</span>
              <span className="flex-1">{r.nota}</span>
              <Button size="sm" variant="ghost" onClick={() => void ciente([r.id])}>Ciente</Button>
            </li>)}
          </ul>
        </Box>}
        {atrasados.length > 0 && <Box title={`Retornos ao cliente pendentes dos vendedores (${atrasados.length})`} right={<Bell className="size-4 text-destructive" />}>
          <ul className="divide-y divide-border text-sm">
            {atrasados.map(({ a, due }) => <li key={a.item.n} className="flex flex-wrap gap-x-3 px-5 py-2">
              <span className="font-semibold">O.S. {a.item.n}</span><span>{a.item.cons}</span>
              <span className="text-destructive">retorno devido desde {fmt(due!)} — aguardando o vendedor marcar como feito</span>
            </li>)}
          </ul>
        </Box>}

        {lembretes.length > 0 && <Box title={`Lembretes de hoje (${lembretes.length})`} right={<Bell className="size-4" />}>
          <ul className="divide-y divide-border text-sm">
            {lembretes.map(a => <li key={a.item.n} className="flex flex-wrap gap-x-3 px-5 py-2">
              <span className="font-semibold">O.S. {a.item.n}</span><span>{a.item.cons}</span><span className="text-muted-foreground">{STATUS.find(s => s.k === a.item.st)?.nome}</span>
              <span className={cor[a.alertas[a.alertas.length - 1]?.nivel ?? "info"]}>{a.alertas.filter(x => x.nivel !== "info").map(x => x.texto).join(" ")}</span>
            </li>)}
          </ul>
        </Box>}

        <Box title={`${STATUS.find(s => s.k === aba)?.nome} — por consultor`}>
          {porCons.length === 0 && <p className="p-5 text-sm text-muted-foreground">Nenhuma O.S. neste status.</p>}
          {porCons.map(({ c, l }) => <div key={c} className="border-t border-border first:border-t-0">
            <div className="flex flex-wrap justify-between gap-2 bg-muted px-5 py-2 text-sm font-semibold">
              <span>{c} · {l.length} O.S.</span>
              <span>{aba === "pronto" || aba === "faturar" ? "A faturar: " : "Valor: "}{brl(l.reduce((n, a) => n + a.item.valor, 0))}</span>
            </div>
            <Tabela head={["O.S.", "Cliente / Modelo", "Valor", "Na oficina", "No status", aba === "pecas" ? "Previsão / contato" : "Situação", "Alertas", ""]}>
              {l.map(a => <FragmentRow key={a.item.n} a={a} aba={aba} aberto={aberto === a.item.n} toggle={() => setAberto(aberto === a.item.n ? null : a.item.n)}
                ac={acomp[a.item.n] ?? { acoes: {}, prev_manual: null }} hist={rets.filter(r => r.os_n === a.item.n)} salvar={v => void salvarAcomp(a.item.n, v)} />)}
            </Tabela>
          </div>)}
        </Box>

        {saidas.length > 0 && <Box title={`Saíram desde a atualização anterior (${saidas.length})`}>
          <p className="px-5 py-3 text-sm text-muted-foreground">{saidas.map(i => `${i.n} (${i.cons})`).join(" · ")}</p>
        </Box>}
      </>}

      <Box title="Histórico de atualizações">
        <Tabela head={["Data", "Por", "Arquivo", "O.S.", "Valor total", ""]}>
          {imps.map((i, k) => <tr key={i.id} className={`border-t border-border ${k === sel ? "bg-accent" : ""}`}>
            <td className="px-3 py-2"><button className="font-medium underline-offset-2 hover:underline" onClick={() => setSel(k)}>{new Date(i.at).toLocaleString("pt-BR")}</button></td>
            <td className="px-3 py-2">{i.nome}</td><td className="px-3 py-2 text-muted-foreground">{i.arquivo}</td>
            <td className="px-3 py-2">{i.itens.length}</td><td className="px-3 py-2">{brl(i.itens.reduce((n, x) => n + x.valor, 0))}</td>
            <td className="px-3 py-2 print:hidden"><Button size="icon" variant="ghost" aria-label="Apagar atualização" onClick={() => void apagar(i.id)}><Trash2 /></Button></td>
          </tr>)}
          {!imps.length && <tr><td colSpan={6} className="px-3 py-4 text-muted-foreground">Nenhuma atualização ainda.</td></tr>}
        </Tabela>
      </Box>
    </section>
  );
}

function CartaoPizza({ titulo, sub, dados, fmt, onClick }: {
  titulo: string; sub: string; dados: { label: string; valor: number; extra?: string }[];
  fmt: (n: number) => string; onClick?: () => void;
}) {
  const total = dados.reduce((n, d) => n + d.valor, 0);
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <button className="mb-3 w-full text-left disabled:cursor-default" onClick={() => onClick?.()} disabled={!onClick}>
        <span className={`block text-sm font-semibold ${onClick ? "hover:text-primary" : ""}`}>{titulo}</span>
        <span className="block text-xs text-muted-foreground">{sub}</span>
      </button>
      {total === 0
        ? <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma O.S.</p>
        : <Pizza dados={dados} fmt={fmt} centro={<><span className="text-2xl font-bold">{total}</span><span className="text-[10px] uppercase text-muted-foreground">O.S.</span></>} />}
    </div>
  );
}

function FragmentRow({ a, aba, aberto, toggle, ac, salvar, hist }: { hist: Retorno[]; a: Analise; aba: Status; aberto: boolean; toggle: () => void; ac: Acomp; salvar: (v: Acomp) => void }) {
  const feitas = a.acoes.filter(x => ac.acoes[x]?.feito).length;
  const alto = a.alertas.some(x => x.nivel === "alto");
  return <>
    <tr className="border-t border-border align-top">
      <td className="px-3 py-2 font-semibold">{a.item.n}{a.semMudanca && <div className="text-xs font-normal text-warning">sem mudança</div>}</td>
      <td className="px-3 py-2">{a.item.cli}<div className="text-xs text-muted-foreground">{a.item.mod} {a.item.placa}</div></td>
      <td className="whitespace-nowrap px-3 py-2">{brl(a.item.valor)}</td>
      <td className="px-3 py-2">{a.item.dias} d</td>
      <td className="px-3 py-2">{a.diasStatus} d</td>
      <td className="max-w-xs px-3 py-2 text-xs">{aba === "pecas" ? <>
        <label className="block text-muted-foreground">Previsão de chegada
          <input type="date" aria-label={`Previsão de chegada O.S. ${a.item.n}`} value={ac.prev_manual ?? a.prev ?? ""} onChange={e => salvar({ ...ac, prev_manual: e.target.value || null })}
            className="mt-1 block w-full rounded border border-input bg-background px-2 py-1 text-xs text-foreground" />
        </label>
        {ac.prev_manual && <div className="text-muted-foreground">alterada manualmente</div>}
        {a.proxContato && <div className={a.contatoHoje ? "font-semibold text-destructive" : "text-muted-foreground"}>Contato: {a.contatoHoje ? "HOJE" : fmt(a.proxContato)}</div>}</> : a.item.obs}</td>
      <td className="max-w-sm px-3 py-2 text-xs">{a.alertas.map((x, i) => <div key={i} className={cor[x.nivel]}>{x.nivel === "alto" && <AlertTriangle className="mr-1 inline size-3" />}{x.texto}</div>)}</td>
      <td className="px-3 py-2"><Button size="sm" variant={alto ? "default" : "ghost"} onClick={toggle}>Ações{feitas > 0 && ` (${feitas}/${a.acoes.length})`}<ChevronDown className={aberto ? "rotate-180" : ""} /></Button></td>
    </tr>
    {aberto && <tr className="bg-muted/40"><td colSpan={8} className="px-5 py-3 text-sm">
      <label className="mb-3 flex items-start gap-2 rounded border border-destructive/40 bg-destructive/5 p-2 text-xs"><input type="checkbox" className="mt-0.5" checked={ehJudicial(ac.acoes)} onChange={e => salvar({ ...ac, acoes: { ...ac.acoes, [JUDICIAL_KEY]: { feito: e.target.checked, nota: "", at: new Date().toISOString() } } })} />
        <span><b>Processo judicial — pausar alertas.</b> A O.S. vai para "Processos judiciais", sai do aviso do Painel e do sino, e o vendedor deixa de receber cobrança de retorno. Cuidados: veículo coberto e protegido, bateria no mantenedor, fotos mensais do estado do carro, nada de desmontar sem autorização e alinhar cada passo com o jurídico.</span></label>
      {aba === "pecas" && <p className="mb-2 text-xs text-muted-foreground">Cronograma de contato semanal: {Array.from({ length: 4 }, (_, k) => fmt(new Date(Date.parse(a.proxContato ?? a.item.desde) + k * 7 * 86400e3).toISOString().slice(0, 10))).join(" · ")}</p>}
      <ul className="space-y-3">{a.acoes.filter(x => x !== JUDICIAL_KEY).map(x => {
        const r = ac.acoes[x] ?? { feito: false, nota: "" };
        const set = (v: Partial<typeof r>) => salvar({ ...ac, acoes: { ...ac.acoes, [x]: { ...r, ...v, at: new Date().toISOString() } } });
        return <li key={x} className="space-y-1">
          <label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={r.feito} onChange={e => set({ feito: e.target.checked })} />
            <span className={r.feito ? "text-muted-foreground line-through" : ""}>{x}</span></label>
          <textarea key={r.nota} defaultValue={r.nota} rows={1} placeholder="Ação tomada (o que foi feito, quando, com quem)…" aria-label={`Ação tomada: ${x}`}
            onBlur={e => { if (e.target.value !== r.nota) set({ nota: e.target.value, feito: r.feito || !!e.target.value.trim() }); }}
            className="ml-6 block w-[calc(100%-1.5rem)] rounded border border-input bg-background px-2 py-1 text-xs" />
          {r.at && (r.feito || r.nota) && <div className="ml-6 text-[11px] text-muted-foreground">Atualizado em {new Date(r.at).toLocaleString("pt-BR")}</div>}
        </li>;
      })}</ul>
      {hist.length > 0 && <div className="mt-3"><div className="text-xs font-semibold">Histórico de retornos ao cliente</div>
        <ul className="mt-1 space-y-1 text-xs">{hist.map(r => <li key={r.id}>{new Date(r.feito_at).toLocaleString("pt-BR")} · {r.feito_por}: {r.nota}</li>)}</ul></div>}
      <p className="mt-2 text-xs text-muted-foreground">Observação: {a.item.obs || "—"}</p>
    </td></tr>}
  </>;
}
