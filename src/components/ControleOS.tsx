import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Bell, ChevronDown, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { brl, Box, Tabela } from "@/components/painel-ui";
import { analisar, fmt, hoje, lerRelatorio, STATUS, type Analise, type OsImport, type OsItem, type Status } from "@/lib/os-controle";
import { registrarUpdate } from "@/lib/update-log";

const cor = { alto: "text-destructive", medio: "text-warning", info: "text-muted-foreground" } as const;

export function ControleOS() {
  const file = useRef<HTMLInputElement>(null);
  const [imps, setImps] = useState<OsImport[]>([]);
  const [sel, setSel] = useState(0);
  const [aba, setAba] = useState<Status>("pronto");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [aberto, setAberto] = useState<string | null>(null);

  const load = async () => {
    const { data, error } = await supabase.from("os_imports").select("id,at,nome,arquivo,itens").order("at", { ascending: false }).limit(60);
    if (error) { setMsg(error.message); return; }
    setImps((data ?? []).map(d => ({ ...d, itens: d.itens as unknown as OsItem[] })));
  };
  useEffect(() => { void load(); }, []);

  const atual = imps[sel];
  const anterior = imps[sel + 1];
  const ref = atual ? (sel === 0 ? hoje() : atual.at.slice(0, 10)) : hoje();
  const lista = useMemo<Analise[]>(() => (atual?.itens ?? []).map(i => analisar(i, anterior, ref)), [atual, anterior, ref]);
  const lembretes = lista.filter(a => (a.item.st === "diag" && a.diasStatus >= 7) || a.contatoHoje || (a.semMudanca && (a.item.st === "pronto" || a.item.st === "faturar")) || (a.item.st === "pecas" && a.diasStatus > 30));
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

        <Box title="Ranking por status — consultor com maior incidência">
          <Tabela head={["Status", "Ranking de consultores (maior → menor)"]}>
            {ranking.map(({ s, total, cons }) => (
              <tr key={s.k} className="border-t border-border align-top">
                <td className="whitespace-nowrap px-3 py-2 font-semibold">
                  {s.nome}
                  <div className="text-xs font-normal text-muted-foreground">{total} O.S.</div>
                </td>
                <td className="px-3 py-2 text-sm">
                  {cons.length === 0 && <span className="text-muted-foreground">Nenhuma O.S. neste status.</span>}
                  {cons.map((r, i) => (
                    <span key={r.c} className="mr-4 inline-block whitespace-nowrap">
                      <span className="font-semibold">{i + 1}º {r.c}</span>{" "}
                      <span className="text-muted-foreground">{r.qtd} O.S. · {brl(r.valor)}</span>
                    </span>
                  ))}
                </td>
              </tr>
            ))}
          </Tabela>
        </Box>

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
              {l.map(a => <FragmentRow key={a.item.n} a={a} aba={aba} aberto={aberto === a.item.n} toggle={() => setAberto(aberto === a.item.n ? null : a.item.n)} />)}
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

function FragmentRow({ a, aba, aberto, toggle }: { a: Analise; aba: Status; aberto: boolean; toggle: () => void }) {
  const alto = a.alertas.some(x => x.nivel === "alto");
  return <>
    <tr className="border-t border-border align-top">
      <td className="px-3 py-2 font-semibold">{a.item.n}{a.semMudanca && <div className="text-xs font-normal text-warning">sem mudança</div>}</td>
      <td className="px-3 py-2">{a.item.cli}<div className="text-xs text-muted-foreground">{a.item.mod} {a.item.placa}</div></td>
      <td className="whitespace-nowrap px-3 py-2">{brl(a.item.valor)}</td>
      <td className="px-3 py-2">{a.item.dias} d</td>
      <td className="px-3 py-2">{a.diasStatus} d</td>
      <td className="max-w-xs px-3 py-2 text-xs">{aba === "pecas" ? <>{a.prev ? `Chega ${fmt(a.prev)}` : "Sem previsão"}{a.proxContato && <div className={a.contatoHoje ? "font-semibold text-destructive" : "text-muted-foreground"}>Contato: {a.contatoHoje ? "HOJE" : fmt(a.proxContato)}</div>}</> : a.item.obs}</td>
      <td className="max-w-sm px-3 py-2 text-xs">{a.alertas.map((x, i) => <div key={i} className={cor[x.nivel]}>{x.nivel === "alto" && <AlertTriangle className="mr-1 inline size-3" />}{x.texto}</div>)}</td>
      <td className="px-3 py-2"><Button size="sm" variant={alto ? "default" : "ghost"} onClick={toggle}>Ações<ChevronDown className={aberto ? "rotate-180" : ""} /></Button></td>
    </tr>
    {aberto && <tr className="bg-muted/40"><td colSpan={8} className="px-5 py-3 text-sm">
      {aba === "pecas" && <p className="mb-2 text-xs text-muted-foreground">Cronograma de contato semanal: {Array.from({ length: 4 }, (_, k) => fmt(new Date(Date.parse(a.proxContato ?? a.item.desde) + k * 7 * 86400e3).toISOString().slice(0, 10))).join(" · ")}</p>}
      <ul className="list-disc space-y-1 pl-5">{a.acoes.map(x => <li key={x}>{x}</li>)}</ul>
      <p className="mt-2 text-xs text-muted-foreground">Observação: {a.item.obs || "—"}</p>
    </td></tr>}
  </>;
}
