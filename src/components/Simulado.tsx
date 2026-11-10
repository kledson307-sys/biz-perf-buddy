import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Printer, Calculator, Upload, Lock, AlertTriangle, CheckCircle2, Lightbulb, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { brl, dataHora } from "@/components/painel-ui";
import { Button } from "@/components/ui/button";
import {
  DEPTOS, DEPTO_NOME, DEPTO_EQUIPE, EFETIVO_ABA, GRUPO_NOME, MESES,
  calcularDepto, resumoLoja, viloes, diasDesde, lerEfetivoAba, lerGnc, lerSimuladoAba, pontosGerenciais, serialParaMes,
  type Depto, type EfetivoDados, type GncDados, type SimuladoDados, type DeptoCalc,
} from "@/lib/simulado";

type Reg = { tipo: string; mes: string; arquivo: string; dados: unknown; updated_at: string };
type Vista = Depto | "LOJA";
const ORIGEM: Record<string, [string, string]> = {
  simulado: ["Simulado", "text-muted-foreground"], orcado: ["Orçado", "text-muted-foreground"],
  media5: ["Média 5m", "text-warning"], gnc: ["GNC SYS", "text-destructive"],
};

export function Simulado({ mes }: { mes: string }) {
  const ano = mes.slice(0, 4);
  const mesIdx = Number(mes.slice(5, 7)) - 1;
  const [regs, setRegs] = useState<Reg[]>([]);
  const [vista, setVista] = useState<Vista>("LOJA");
  const [lendo, setLendo] = useState("");
  const [pend, setPend] = useState<{ tipo: string; m: string; arquivo: string; dados: unknown; resumo: string }[]>([]);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("simulado_imports").select("tipo,mes,arquivo,dados,updated_at").in("mes", [mes, ano]);
    if (error) { toast.error(error.message); return; }
    setRegs((data ?? []) as Reg[]);
  }, [mes, ano]);
  useEffect(() => { void load(); }, [load]);

  const reg = (t: string) => regs.find((r) => r.tipo === t);
  const sim = reg("simulado")?.dados as SimuladoDados | undefined;
  const efet = reg("efetivo")?.dados as EfetivoDados | undefined;
  const gnc = reg("gnc")?.dados as GncDados | undefined;

  const calc = useMemo(() => DEPTOS.map((d) => calcularDepto(d, sim?.deptos[d], efet?.deptos[d], gnc, mesIdx)), [sim, efet, gnc, mesIdx]);
  const pontos = useMemo(() => (sim ? pontosGerenciais(calc, efet, mesIdx) : []), [calc, efet, sim, mesIdx]);

  async function salvar(tipo: string, m: string, arquivo: string, dados: unknown) {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("simulado_imports").upsert({ user_id: u.user!.id, tipo, mes: m, arquivo, dados: dados as never, updated_at: new Date().toISOString() }, { onConflict: "user_id,tipo,mes" });
    if (error) throw error;
  }

  async function importar(files: FileList | null) {
    if (!files?.length) return;
    const XLSX = await import("xlsx");
    const out: typeof pend = [];
    for (const f of Array.from(files)) {
      try {
        setLendo(`Lendo ${f.name}…`);
        const buf = await f.arrayBuffer();
        const nomes = XLSX.read(buf, { bookSheets: true }).SheetNames;
        const tem = (s: string) => nomes.includes(s);
        if (tem("SG") && tem("PC") && tem("AC") && tem("SC") && tem("LOJA")) {
          const wb = XLSX.read(buf, { sheets: ["SG", "PC", "AC", "SC"] });
          const rows = (s: string) => XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[s]!, { header: 1, raw: true, defval: null });
          const m = serialParaMes(rows("SG")[0]?.[0]) ?? mes;
          const deptos: SimuladoDados["deptos"] = {};
          for (const d of DEPTOS) { const x = lerSimuladoAba(rows(d)); if (x) deptos[d] = x; }
          if (!Object.keys(deptos).length) throw new Error("Bloco BMW HAUS SSA não encontrado no Simulador");
          const vb = Object.values(deptos).reduce((a, x) => a + (((x as unknown as { venda?: number }).venda) ?? 0), 0);
          out.push({ tipo: "simulado", m, arquivo: f.name, dados: { mes: m, deptos }, resumo: `Simulador ${m.split("-").reverse().join("/")} · HAUS SSA · departamentos ${Object.keys(deptos).join(", ")}${vb ? ` · venda ${brl(vb)}` : ""}` });
        } else if (tem("EFETIVO") && Object.values(EFETIVO_ABA).every(tem)) {
          const wb = XLSX.read(buf, { sheets: Object.values(EFETIVO_ABA) });
          const deptos: EfetivoDados["deptos"] = {};
          for (const d of DEPTOS) { const x = lerEfetivoAba(XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[EFETIVO_ABA[d]]!, { header: 1, raw: true, defval: null })); if (x) deptos[d] = x; }
          const a = Number(f.name.match(/20\d\d/)?.[0] ?? ano);
          out.push({ tipo: "efetivo", m: String(a), arquivo: f.name, dados: { ano: a, deptos }, resumo: `Efetivo ${a} · departamentos ${Object.keys(deptos).join(", ")}` });
        } else {
          const wb = XLSX.read(buf);
          let g: GncDados | null = null;
          for (const sn of wb.SheetNames) { g = lerGnc(XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sn]!, { defval: null })); if (g) break; }
          if (!g) throw new Error("não reconheci como Simulador, Efetivo ou GNC SYS");
          const m = g.mes || mes;
          out.push({ tipo: "gnc", m, arquivo: f.name, dados: g, resumo: `GNC SYS ${m.split("-").reverse().join("/")} · ${g.lancamentos.length} lançamentos dos centros marcados` });
        }
      } catch (e) { toast.error(`${f.name}: ${(e as Error).message}`); }
    }
    setLendo("");
    setPend(out);
    if (out.length) toast.info(`${out.length} planilha(s) lida(s) — confira e clique em Confirmar importação`);
  }

  const [salvando, setSalvando] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  const [recibo, setRecibo] = useState<string[]>([]);
  async function confirmar() {
    setSalvando(true);
    const ok: string[] = [];
    for (const p of pend) {
      try { await salvar(p.tipo, p.m, p.arquivo, p.dados); ok.push(p.resumo); toast.success(`${p.arquivo} importado`); } catch (e) { toast.error(`${p.arquivo}: ${(e as Error).message}`); }
    }
    setPend([]); setRecibo(ok); setSalvando(false); await load();
  }

  const loja = calc.reduce((s, d) => ({ venda: s.venda + d.venda, lbr: s.lbr + d.lbr, db: s.db + d.despBase, da: s.da + d.despAjustada }), { venda: 0, lbr: 0, db: 0, da: 0 });
  const atual = calc.find((c) => c.depto === vista);
  const rl = resumoLoja(calc);
  const vil = viloes(calc);
  const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

  return (
    <div className="space-y-3">
      <div className="lux-card flex flex-wrap items-center gap-3 p-3">
        <Calculator className="h-5 w-5 text-primary" />
        <div className="mr-auto">
          <h2 className="text-sm font-semibold">Simulado de L.O. · BMW HAUS SSA <span className="ml-1 inline-flex items-center gap-0.5 rounded bg-muted px-1 text-[10px] font-normal text-muted-foreground"><Lock className="h-2.5 w-2.5" /> Exclusivo gestão</span></h2>
          <p className="text-xs text-muted-foreground">Exclusivo do gestor. Despesa ajustada = maior entre simulado, média dos últimos 5 meses do Efetivo e o já lançado no GNC SYS.</p>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">
          <Upload className="h-4 w-4" /> {lendo || "Importar planilhas"}
          <input type="file" multiple accept=".xlsx,.xlsm,.xlsb,.xls" className="hidden" disabled={!!lendo} onChange={(e) => { void importar(e.target.files); e.target.value = ""; }} />
        </label>
        {sim && <Button size="sm" variant="outline" className="print:hidden" onClick={() => window.print()}><Printer className="mr-1 h-4 w-4" /> Imprimir / PDF</Button>}
      </div>

      <label
        onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => { e.preventDefault(); setArrastando(false); void importar(e.dataTransfer.files); }}
        className={`flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-dashed p-4 text-center text-xs print:hidden ${arrastando ? "border-primary bg-primary/10" : "border-border text-muted-foreground"}`}>
        <Upload className="h-5 w-5 text-primary" />
        <b className="text-foreground">{lendo || "Solte aqui as planilhas do Simulado (Simulador, GNC SYS ou Efetivo) — em qualquer ordem"}</b>
        <span>Reconheço pelo conteúdo das abas e colunas, não pelo nome do arquivo.</span>
        <input type="file" multiple accept=".xlsx,.xlsm,.xlsb,.xls" className="hidden" disabled={!!lendo} onChange={(e) => { void importar(e.target.files); e.target.value = ""; }} />
      </label>

      {pend.length > 0 && <div className="lux-card space-y-1 border-2 border-primary p-3 text-xs">
        <b className="text-sm">Confira antes de importar</b>
        {pend.map((p) => <p key={p.arquivo} className="flex items-center gap-1"><CheckCircle2 className="h-4 w-4 shrink-0 text-success" /> {p.arquivo} → <b>{p.resumo}</b></p>)}
        <div className="flex gap-2 pt-1"><Button size="sm" disabled={salvando} onClick={() => void confirmar()}>{salvando ? "Salvando…" : "Confirmar importação"}</Button><Button size="sm" variant="ghost" onClick={() => setPend([])}>Cancelar</Button></div>
      </div>}
      {recibo.length > 0 && <div className="lux-card space-y-1 border border-success p-3 text-xs">
        <div className="flex items-center justify-between"><b className="text-sm text-success">✓ Importação concluída</b><Button size="sm" variant="ghost" onClick={() => setRecibo([])}>Fechar</Button></div>
        {recibo.map((r) => <p key={r}>• {r}</p>)}
      </div>}
      <div className="grid gap-2 sm:grid-cols-3">
        {([["simulado", "Simulador (toda segunda)"], ["gnc", "GNC SYS – despesas (toda segunda)"], ["efetivo", `Efetivo ${ano} (mensal)`]] as const).map(([t, l]) => {
          const r = reg(t);
          const dias = diasDesde(r?.updated_at);
          const lim = t === "efetivo" ? 35 : 7;
          const velho = dias !== null && dias > lim;
          return (
            <div key={t} className="lux-card flex items-center gap-2 p-2 text-xs">
              {r && !velho ? <CheckCircle2 className="h-4 w-4 text-success" /> : <AlertTriangle className={`h-4 w-4 ${velho ? "text-destructive" : "text-warning"}`} />}
              <div className="min-w-0"><div className="font-semibold">{l}</div><div className="truncate text-muted-foreground">{r ? `${r.arquivo} · ${dataHora(r.updated_at)}` : "Ainda não importado"}</div>
                {r && <div className={velho ? "font-semibold text-destructive" : "text-success"}>{velho ? `⚠️ Desatualizado há ${dias} dias` : `✓ Atualizado há ${dias} dia(s)`}</div>}</div>
            </div>
          );
        })}
      </div>

      {!sim ? (
        gnc ? <PainelGnc gnc={gnc} /> : <div className="lux-card p-6 text-center text-sm text-muted-foreground">Importe o Simulador do mês para montar a visão. O Efetivo e o GNC SYS refinam as despesas.</div>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-5">
            {([
              ["Venda bruta", brl(rl.venda), "loja pós-venda", ""],
              ["L.B. + rendas", brl(rl.lbr), `margem ${pct(rl.margem)}`, ""],
              ["Despesas ajustadas", brl(rl.despAjustada), rl.estouro > 0 ? `+${brl(rl.estouro)} acima do simulado` : "dentro do simulado", rl.estouro > 0 ? "text-destructive" : "text-success"],
              ["L.O. ajustado", brl(rl.lo), `margem op. ${pct(rl.margemLo)}`, rl.lo < 0 ? "text-destructive" : "text-success"],
              ["Ponto de equilíbrio", brl(rl.breakEven), rl.venda >= rl.breakEven ? `folga ${brl(rl.venda - rl.breakEven)}` : `faltam ${brl(rl.breakEven - rl.venda)}`, rl.venda >= rl.breakEven ? "text-success" : "text-destructive"],
            ] as const).map(([l, v, sub, c]) => (
              <div key={l} className="lux-card p-3"><div className="text-[11px] uppercase text-muted-foreground">{l}</div><div className={`text-lg font-bold ${c}`}>{v}</div><div className={`text-[11px] ${c || "text-muted-foreground"}`}>{sub}</div></div>
            ))}
          </div>
          {vil.length > 0 && <div className="lux-card p-3 text-xs">
            <h3 className="mb-1 flex items-center gap-1 text-sm font-semibold"><AlertTriangle className="h-4 w-4 text-destructive" /> Contas que mais puxam a despesa</h3>
            <div className="grid gap-1 sm:grid-cols-2 xl:grid-cols-5">
              {vil.map((v, i) => <div key={i} className="rounded-md bg-muted/30 p-2"><b>{v.depto} · {v.nome}</b><div className="text-destructive">+{brl(v.excesso)}</div><div className="text-muted-foreground">pela {ORIGEM[v.origem]?.[0] ?? v.origem}</div></div>)}
            </div>
          </div>}
          <div className="flex flex-wrap gap-1 print:hidden">
            {(["LOJA", ...DEPTOS] as Vista[]).map((v) => (
              <Button key={v} size="sm" variant={vista === v ? "default" : "outline"} onClick={() => setVista(v)}>{v === "LOJA" ? "LOJA (consolidado)" : v}</Button>
            ))}
          </div>

          <div className="grid gap-3 xl:grid-cols-[1.6fr_1fr]">
            <div className="lux-card overflow-x-auto p-0">
              {vista === "LOJA" ? <TabelaLoja calc={calc} loja={loja} /> : atual && <TabelaDepto c={atual} linhas={sim.deptos[vista]?.linhas ?? []} efetivoOk={!!efet} />}
            </div>
            <div className="lux-card p-3 xl:max-h-[calc(100vh-260px)] xl:overflow-y-auto">
              <h3 className="mb-2 flex items-center gap-1 text-sm font-semibold"><Lightbulb className="h-4 w-4 text-primary" /> Avaliação gerencial {vista !== "LOJA" && `· ${vista}`}</h3>
              {vista !== "LOJA" && <p className="mb-2 text-xs text-muted-foreground">{DEPTO_NOME[vista]} · equipe: {DEPTO_EQUIPE[vista]}</p>}
              <ul className="space-y-1.5">
                {pontos.filter((p) => vista === "LOJA" || p.depto === vista).map((p, i) => (
                  <li key={i} className="flex gap-2 text-xs">
                    <span className={p.nivel === "alerta" ? "text-destructive" : p.nivel === "atencao" ? "text-warning" : p.nivel === "ok" ? "text-success" : "text-primary"}>●</span>
                    <span>{vista === "LOJA" && p.depto !== "LOJA" && <b>{p.depto}: </b>}{p.texto}</span>
                  </li>
                ))}
              </ul>
              {efet && calc[0]?.mesesMedia.length ? <p className="mt-3 flex gap-1 text-[11px] text-muted-foreground"><Info className="h-3 w-3 shrink-0" /> Média usa {calc[0].mesesMedia.map((k) => MESES[k]!.slice(0, 3).toLowerCase()).join(", ")} do Efetivo. Atualize o Efetivo todo mês para a base evoluir.</p> : null}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const loCls = (v: number) => (v < 0 ? "text-destructive" : "text-success");

function TabelaLoja({ calc, loja }: { calc: DeptoCalc[]; loja: { venda: number; lbr: number; db: number; da: number } }) {
  return (
    <table className="w-full text-xs">
      <thead className="bg-muted/40 text-muted-foreground"><tr>
        <th className="p-2 text-left">Departamento</th><th className="p-2 text-right">Venda bruta</th><th className="p-2 text-right">L.B. + rendas</th>
        <th className="p-2 text-right">Despesas (simulado)</th><th className="p-2 text-right">Despesas ajustadas</th><th className="p-2 text-right">L.O. simulado</th><th className="p-2 text-right">L.O. ajustado</th>
      </tr></thead>
      <tbody>
        {calc.map((c) => (
          <tr key={c.depto} className="border-t border-border/50">
            <td className="p-2 font-semibold">{c.depto} <span className="font-normal text-muted-foreground">{DEPTO_NOME[c.depto]}</span></td>
            <td className="p-2 text-right">{brl(c.venda)}</td><td className="p-2 text-right">{brl(c.lbr)}</td>
            <td className="p-2 text-right">{brl(c.despBase)}</td><td className="p-2 text-right">{brl(c.despAjustada)}</td>
            <td className={`p-2 text-right ${loCls(c.loOrcado)}`}>{brl(c.loOrcado)}</td><td className={`p-2 text-right font-semibold ${loCls(c.loAjustado)}`}>{brl(c.loAjustado)}</td>
          </tr>
        ))}
        <tr className="border-t-2 border-primary/50 font-semibold">
          <td className="p-2">LOJA · Pós-venda</td><td className="p-2 text-right">{brl(loja.venda)}</td><td className="p-2 text-right">{brl(loja.lbr)}</td>
          <td className="p-2 text-right">{brl(loja.db)}</td><td className="p-2 text-right">{brl(loja.da)}</td>
          <td className={`p-2 text-right ${loCls(loja.lbr - loja.db)}`}>{brl(loja.lbr - loja.db)}</td><td className={`p-2 text-right ${loCls(loja.lbr - loja.da)}`}>{brl(loja.lbr - loja.da)}</td>
        </tr>
      </tbody>
    </table>
  );
}

function TabelaDepto({ c, linhas, efetivoOk }: { c: DeptoCalc; linhas: { nome: string; orcado: number; simulado: number; chave?: string | undefined }[]; efetivoOk: boolean }) {
  const porGrupo = new Map(c.grupos.map((g) => [g.grupo as string, g]));
  const total = /^(VENDA BRUTA|LUCRO|TOTAL|CUSTO DA VENDA|VENDA L)/i;
  return (
    <table className="w-full text-xs">
      <thead className="bg-muted/40 text-muted-foreground"><tr>
        <th className="p-2 text-left">{DEPTO_NOME[c.depto]}</th><th className="p-2 text-right">Orçado</th><th className="p-2 text-right">Simulado</th>
        <th className="p-2 text-right">Média 5m</th><th className="p-2 text-right">GNC SYS</th><th className="p-2 text-right">Ajustado</th>
      </tr></thead>
      <tbody>
        {linhas.map((l, i) => {
          const g = l.chave ? porGrupo.get(l.chave) : undefined;
          const ehTotal = total.test(l.nome.trim());
          const vazio = !l.orcado && !l.simulado && !g;
          if (vazio && !ehTotal) return null;
          let aj: number | undefined;
          if (g) aj = g.ajustado; else if (l.chave === "desp") aj = c.despAjustada; else if (l.chave === "lo") aj = c.loAjustado;
          return (
            <tr key={i} className={`border-t border-border/40 ${ehTotal ? "bg-muted/20 font-semibold" : ""}`}>
              <td className="p-1.5 pl-2">{l.nome}{g && <span className="ml-1 text-[10px] text-muted-foreground">{g.fixo ? "🔒 fixa" : "variável"}</span>}</td>
              <td className="p-1.5 text-right">{brl(l.orcado)}</td>
              <td className="p-1.5 text-right">{l.simulado ? brl(l.simulado) : "–"}</td>
              <td className="p-1.5 text-right">{g ? (efetivoOk ? brl(g.media5) : "–") : ""}</td>
              <td className="p-1.5 text-right">{g ? (g.gnc ? brl(g.gnc) : "–") : ""}</td>
              <td className={`p-1.5 text-right ${l.chave === "lo" ? `font-bold ${loCls(c.loAjustado)}` : ""}`}>
                {aj !== undefined ? brl(aj) : ""}
                {g && g.origem !== g.origemBase && <span className={`ml-1 text-[10px] ${ORIGEM[g.origem]![1]}`}>{ORIGEM[g.origem]![0]}</span>}
              </td>
            </tr>
          );
        })}
        {c.grupos.some((g) => !linhas.some((l) => l.chave === g.grupo)) && c.grupos.filter((g) => !linhas.some((l) => l.chave === g.grupo) && (g.media5 || g.gnc)).map((g) => (
          <tr key={g.grupo} className="border-t border-border/40 text-muted-foreground"><td className="p-1.5 pl-2">{GRUPO_NOME[g.grupo]} (fora do simulado)</td><td /><td /><td className="p-1.5 text-right">{brl(g.media5)}</td><td className="p-1.5 text-right">{brl(g.gnc)}</td><td className="p-1.5 text-right">{brl(g.ajustado)}</td></tr>
        ))}
      </tbody>
    </table>
  );
}

/** Despesas reais do GNC SYS sem precisar do Simulador: por centro, por grupo e maiores contas. */
function PainelGnc({ gnc }: { gnc: GncDados }) {
  const l = gnc.lancamentos;
  const total = l.reduce((a, x) => a + x.valor, 0);
  const soma = (f: (x: (typeof l)[number]) => string) => Object.entries(l.reduce<Record<string, number>>((a, x) => { const k = f(x); a[k] = (a[k] ?? 0) + x.valor; return a; }, {})).sort((a, b) => b[1] - a[1]);
  const porDepto = soma((x) => x.depto), porGrupo = soma((x) => x.grupo), contas = soma((x) => `${x.depto} · ${x.conta}`).slice(0, 10);
  const Lista = ({ t, d, nome }: { t: string; d: [string, number][]; nome?: (k: string) => string }) => (
    <div className="lux-card p-3 text-xs"><h3 className="mb-2 text-sm font-semibold">{t}</h3>
      {d.map(([k, v]) => <div key={k} className="flex justify-between border-b border-border/40 py-1"><span>{nome ? nome(k) : k}</span><b>{brl(v)} <span className="font-normal text-muted-foreground">{total ? `${((v / total) * 100).toFixed(1)}%` : ""}</span></b></div>)}
    </div>);
  return (
    <div className="space-y-3">
      <div className="lux-card p-3 text-xs"><div className="text-[11px] uppercase text-muted-foreground">Despesas lançadas no GNC SYS · {gnc.mes.split("-").reverse().join("/")}</div><div className="text-lg font-bold">{brl(total)}</div><div className="text-muted-foreground">{l.length} lançamentos do pós-venda · importe o Simulador para ver L.O. e ponto de equilíbrio</div></div>
      <div className="grid gap-3 xl:grid-cols-3">
        <Lista t="Por centro de custo" d={porDepto} nome={(k) => `${k} · ${DEPTO_NOME[k as Depto] ?? ""}`} />
        <Lista t="Por grupo" d={porGrupo} nome={(k) => GRUPO_NOME[k as keyof typeof GRUPO_NOME] ?? k} />
        <Lista t="Maiores contas" d={contas} />
      </div>
    </div>);
}
