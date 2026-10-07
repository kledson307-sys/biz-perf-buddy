import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Box, brl, norm, num } from "./painel-ui";
import { GRUPO_NOME, ITENS, distribuir, lerRanking, splitCods, type Relatorio } from "@/lib/agregados";

type Cons = { id: string; nome: string; department_id: string | null };
const br = (d: string) => d.split("-").reverse().join("/");

export function AgregadosImport({ allCons, codigos, ini, end, onDone }: {
  allCons: Cons[]; codigos: Record<string, string[]>; ini: string; end: string; onDone: () => void;
}) {
  const hoje = new Date().toISOString().slice(0, 10);
  const [rel, setRel] = useState<Relatorio | null>(null);
  const [arquivo, setArquivo] = useState("");
  const [txt, setTxt] = useState("");
  const [dia, setDia] = useState(hoje >= ini && hoje <= end ? hoje : end);
  const [msg, setMsg] = useState("");
  const [salvando, setSalvando] = useState(false);

  const res = useMemo(() => (rel ? distribuir(rel, codigos) : null), [rel, codigos]);
  // Só substitui o grupo (serviços ou peças) que aparece no relatório, para que importar um não apague o outro.
  const grupos = new Set((res?.usados ?? []).map((u) => ITENS.find((i) => i.k === u.item)?.g));
  const itensAtivos = ITENS.filter((i) => (codigos[i.k] ?? []).length > 0 && grupos.has(i.g));
  const itensSubst = itensAtivos;
  const periodo = rel?.periodo ?? { ini: dia, fim: dia };
  const conhecidos = new Set(allCons.map((c) => norm(c.nome)));

  const ler = (rows: (string | number)[][], nome: string) => {
    try {
      const r = lerRanking(rows);
      setRel(r); setArquivo(nome);
      setMsg(r.periodo ? "" : "Não encontrei o período no relatório — escolha a data abaixo.");
    } catch (e) { setRel(null); setMsg((e as Error).message); }
  };

  const abrir = async (f: File | undefined) => {
    if (!f) return;
    const XLSX = await import("xlsx");
    const wb = XLSX.read(await f.arrayBuffer(), { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]!]!;
    ler(XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1, raw: true, defval: "" }), f.name);
  };

  const salvar = async () => {
    if (!res) return;
    setSalvando(true); setMsg("Salvando…");
    try {
      const cmap = new Map(allCons.map((c) => [norm(c.nome), c.id]));
      for (const l of res.linhas) {
        if (cmap.has(norm(l.nome))) continue;
        const { data, error } = await supabase.from("consultants").insert({ nome: l.nome }).select("id").single();
        if (error || !data) throw new Error(`Não consegui cadastrar ${l.nome}: ${error?.message ?? ""}`);
        cmap.set(norm(l.nome), data.id);
      }
      const items = itensSubst.map((i) => i.k);
      const del = await supabase.from("agg_sales").delete().in("item", items).gte("dia", periodo.ini).lte("dia", periodo.fim);
      if (del.error) throw del.error;
      const rows = res.registros.map((l) => ({ consultant_id: cmap.get(norm(l.nome))!, dia: l.dia ?? periodo.fim, item: l.item, qtd: l.qtd, valor: l.valor }));
      if (rows.length) {
        const up = await supabase.from("agg_sales").upsert(rows, { onConflict: "consultant_id,dia,item" });
        if (up.error) throw up.error;
      }
      setMsg(`Importado: ${rows.length} lançamentos de ${br(periodo.ini)} a ${br(periodo.fim)}. Importar de novo o mesmo período substitui os valores.`);
      setRel(null); setTxt(""); setArquivo("");
      onDone();
    } catch (e) { setMsg("Erro ao salvar: " + (e as Error).message); }
    setSalvando(false);
  };

  // Tabela: consultor × item
  const nomes = res ? [...new Set(res.linhas.map((l) => l.nome))].sort() : [];
  const get = (nome: string, item: string) => res?.linhas.find((l) => l.nome === nome && l.item === item);
  const avisos = res?.usados.filter((u) => u.soma !== u.qtd) ?? [];

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-xl border border-border bg-card p-6">
        <div>
          <h3 className="font-semibold">Importar relatório de ranking do sistema (serviços ou peças)</h3>
          <p className="text-sm text-muted-foreground">
            Escolha o arquivo Excel exportado do sistema. Só os códigos cadastrados abaixo são considerados. A quantidade de cada consultor vem do relatório e o valor é calculado assim: <b>valor bruto do item ÷ quantidade total do item × quantidade do consultor</b>. Importar o relatório de serviços não altera as peças, e vice-versa.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="cursor-pointer rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            Escolher arquivo Excel
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { abrir(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
          {arquivo && <span className="text-sm text-muted-foreground">{arquivo}</span>}
        </div>
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">Ou colar o relatório copiado do Excel</summary>
          <textarea value={txt} onChange={(e) => setTxt(e.target.value)} rows={6} placeholder="Selecione o relatório inteiro no Excel (incluindo o cabeçalho Rank / Serviço / Descrição / Qtde / Valor Bruto) e cole aqui" className="mt-2 w-full rounded-lg border border-input bg-background p-3 font-mono text-xs" />
          <button onClick={() => ler(txt.split(/\r?\n/).map((l) => l.split("\t")), "Relatório colado")} className="mt-2 rounded-lg border border-input px-4 py-1.5 font-medium">Ler colagem</button>
        </details>
        {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
      </section>

      {res && (
        <Box title={`Prévia da importação — ${br(periodo.ini)} a ${br(periodo.fim)}`} right={
          <div className="flex items-center gap-2">
            {!rel?.periodo && <input type="date" value={dia} onChange={(e) => setDia(e.target.value)} className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm" />}
            <button disabled={salvando || res.linhas.length === 0} onClick={salvar} className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50">Confirmar importação</button>
          </div>
        }>
          <div className="space-y-4 p-4 text-sm">
            <p className="text-muted-foreground">
              {res.usados.length} itens encontrados de {rel!.servicos.length} no relatório. Ao confirmar, os valores de {itensAtivos.map((i) => i.nome).join(", ")} deste período são substituídos por estes. {rel?.porDia ? "Cada venda fica registrada no dia em que aconteceu." : rel?.periodo && rel.periodo.ini !== rel.periodo.fim && "Como o relatório é acumulado do período, o total fica registrado no último dia."}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left" rowSpan={2}>Consultor</th>
                    {itensAtivos.map((it) => <th key={it.k} colSpan={2} className="border-l border-border px-3 py-2">{it.nome}</th>)}
                  </tr>
                  <tr>{itensAtivos.map((it) => [<th key={it.k + "q"} className="border-l border-border px-2 py-1">Qtd</th>, <th key={it.k + "v"} className="px-2 py-1">R$</th>])}</tr>
                </thead>
                <tbody>
                  {nomes.length === 0 && <tr><td colSpan={1 + itensAtivos.length * 2} className="px-3 py-6 text-center text-muted-foreground">Nenhum serviço com os códigos cadastrados neste relatório.</td></tr>}
                  {nomes.map((n) => (
                    <tr key={n} className="border-t border-border">
                      <td className="whitespace-nowrap px-3 py-2 font-medium">{n}{!conhecidos.has(norm(n)) && <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">novo</span>}</td>
                      {itensAtivos.map((it) => { const l = get(n, it.k); return [
                        <td key={it.k + "q"} className="border-l border-border px-2 py-2 text-right">{l ? num(l.qtd) : "—"}</td>,
                        <td key={it.k + "v"} className="px-2 py-2 text-right">{l ? brl(l.valor) : "—"}</td>,
                      ]; })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <details>
              <summary className="cursor-pointer text-muted-foreground">Ver serviços considerados ({res.usados.length})</summary>
              <table className="mt-2 w-full text-xs">
                <thead className="text-left text-muted-foreground"><tr><th className="py-1">Código</th><th>Descrição</th><th>Item</th><th className="text-right">Qtd</th><th className="text-right">Valor bruto</th><th className="text-right">Valor por unidade</th></tr></thead>
                <tbody>
                  {res.usados.map((u) => (
                    <tr key={u.codigo} className="border-t border-border">
                      <td className="py-1 font-mono">{u.codigo}</td><td>{u.desc}</td><td>{ITENS.find((i) => i.k === u.item)?.nome}</td>
                      <td className="text-right">{num(u.qtd)}</td><td className="text-right">{brl(u.bruto)}</td><td className="text-right">{brl(u.qtd ? u.bruto / u.qtd : 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
            {avisos.length > 0 && (
              <p className="text-destructive">Atenção: a soma por consultor não bate com o total em {avisos.map((a) => `${a.codigo} (${a.soma} de ${a.qtd})`).join(", ")}.</p>
            )}
          </div>
        </Box>
      )}

      <Codigos codigos={codigos} onSaved={onDone} />
    </div>
  );
}

function Codigos({ codigos, onSaved }: { codigos: Record<string, string[]>; onSaved: () => void }) {
  const [v, setV] = useState<Record<string, string>>({});
  useEffect(() => { setV(Object.fromEntries(ITENS.map((i) => [i.k, (codigos[i.k] ?? []).join(", ")]))); }, [codigos]);
  const salvar = async (item: string) => {
    const novo = splitCods(v[item] ?? "").join(",");
    if (novo === (codigos[item] ?? []).join(",")) return;
    await supabase.from("agg_codes").upsert({ item, codigos: novo }, { onConflict: "user_id,item" });
    onSaved();
  };
  return (
    <Box title="Códigos do sistema por item">
      <div className="space-y-3 p-4 text-sm">
        <p className="text-muted-foreground">Separe os códigos por vírgula. Salva ao sair do campo. Itens sem código não são alterados pela importação.</p>
        {ITENS.map((it) => (
          <label key={it.k} className="grid items-center gap-2 sm:grid-cols-[220px_1fr]">
            <span><b>{it.nome}</b> <span className="text-xs text-muted-foreground">· {GRUPO_NOME[it.g]}</span></span>
            <input value={v[it.k] ?? ""} onChange={(e) => setV({ ...v, [it.k]: e.target.value })} onBlur={() => salvar(it.k)} placeholder="Nenhum código" className="rounded-lg border border-input bg-background px-3 py-1.5 font-mono text-xs" />
          </label>
        ))}
      </div>
    </Box>
  );
}
