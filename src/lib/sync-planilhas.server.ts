/** Sincronização das planilhas online: baixa do SharePoint, lê pelo conteúdo e grava no painel do dono da equipe. Só roda no servidor. */
import * as XLSX from "xlsx";
import { FONTES, urlDownload, isoBahia, hashConteudo, lerAgendaOnline, separarAgenda, lerEsteticaOnline, type Fonte, type StatusSync } from "./sync-planilhas";
import { lerAbaNps } from "./nps";
import { parseRvd, casarVendedor, diferencaRvd, targetTicket, type VendaC } from "./acessorios-estetica";
import { classificar } from "./agendamento";

const AUTOR = "sincronização";
type Db = any; // eslint-disable-line @typescript-eslint/no-explicit-any

async function baixar(f: Fonte) {
  const r = await fetch(urlDownload(f), { headers: { "User-Agent": "Mozilla/5.0 HausPainel" }, redirect: "follow" });
  if (!r.ok) throw new Error(`SharePoint respondeu ${r.status}`);
  const buf = new Uint8Array(await r.arrayBuffer());
  if (buf[0] !== 0x50 || buf[1] !== 0x4b) throw new Error("O link não devolveu uma planilha (o compartilhamento pode ter mudado)");
  return XLSX.read(buf, { type: "array", cellDates: true });
}
const aba = (wb: XLSX.WorkBook, re: RegExp) => { const n = wb.SheetNames.find((s) => re.test(s)); if (!n) throw new Error("Aba da loja não encontrada na planilha"); return XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[n]!, { header: 1, defval: "", raw: true }); };
const chk = (e: { error: { message: string } | null }) => { if (e.error) throw new Error(e.error.message); };

/** Lê a fonte e devolve o conteúdo relevante + a gravação (executada só quando o conteúdo mudou). */
async function preparar(db: Db, f: Fonte, owner: string): Promise<{ conteudo: unknown; linhas: number; resumo: string; gravar: () => Promise<string[]> }> {
  const wb = await baixar(f);
  const hoje = isoBahia(), mes = hoje.slice(0, 7);
  if (f === "nps") {
    // Só a base oficial de pós-vendas (as demais abas são vendas de novos, resumos ou cópias).
    const base = wb.SheetNames.filter((s) => /^BASE DE P[OÓ]S/i.test(s.trim()));
    const lst = (base.length ? base : wb.SheetNames).flatMap((s) => lerAbaNps(XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[s]!, { header: 1, defval: "" }), s));
    if (!lst.length) throw new Error("Não reconheci as colunas NOTA PSI e CONSULTOR");
    return { conteudo: lst, linhas: lst.length, resumo: `${lst.length} pesquisas`, gravar: async () => {
      const { data: novo, error } = await db.from("nps_imports").insert({ user_id: owner, itens: lst, arquivo: "SharePoint (sincronização automática)", nome: AUTOR }).select("id").single();
      if (error) throw new Error(error.message);
      // Mantém só a leitura mais recente da sincronização (evita acumular cópias a cada hora).
      await db.from("nps_imports").delete().eq("user_id", owner).eq("nome", AUTOR).neq("id", novo.id);
      return ["NPS"];
    } };
  }
  if (f === "agenda") {
    const s = separarAgenda(lerAgendaOnline(aba(wb, /HAUS SALVADOR/i)), hoje);
    const lotes = [{ tipo: "d0", data: hoje, itens: s.d0 }, ...(s.dataD1 ? [{ tipo: "d1", data: s.dataD1, itens: s.d1 }] : [])];
    return { conteudo: lotes, linhas: s.d0.length + s.d1.length, resumo: `Hoje ${s.d0.length} · D+1 ${s.d1.length}`, gravar: async () => {
      const origens: string[] = [];
      for (const l of lotes) {
        chk(await db.from("agendamentos").delete().eq("user_id", owner).eq("tipo", l.tipo).eq("data", l.data));
        const vistos = new Set<string>();
        const rows = l.itens.map((it) => {
          const placa = (it.chassi || `SEM-PLACA ${it.cliente}`).slice(0, 40);
          const sv = it.servico.toUpperCase();
          const categoria = /RECALL|CAMPANHA/.test(sv) ? "recall" : /DIAG/.test(sv) ? "diagnostico" : /REV|MANUT/.test(sv) ? "revisao" : classificar(`${it.obs} ${it.servico}`);
          return { user_id: owner, data: l.data, tipo: l.tipo, hora: it.hora, status: it.status, cliente: it.cliente, os: "", celular: it.celular, consultor: it.operador, produto: it.modelo, placa, segmento: it.segmento, categoria, obs: it.obs, arquivo: "SharePoint (sincronização automática)", importado_por: AUTOR };
        }).filter((r) => { const k = `${r.placa}|${r.hora}`; if (vistos.has(k)) return false; vistos.add(k); return true; });
        if (rows.length) chk(await db.from("agendamentos").insert(rows));
        origens.push(l.tipo === "d1" ? "Agendamento D+1" : "Agendamento do dia");
      }
      return origens;
    } };
  }
  if (f === "estetica") {
    const v = lerEsteticaOnline(aba(wb, /HAUS SALVADOR/i)).filter((x) => x.dia.slice(0, 7) === mes);
    return { conteudo: v, linhas: v.length, resumo: `${v.length} vendas no mês`, gravar: async () => {
      chk(await db.from("vendas_complementares").delete().eq("user_id", owner).eq("mes", mes).eq("departamento", "ESTETICA").eq("criado_por", AUTOR));
      const rows = v.map((x) => ({ user_id: owner, mes, dia: x.dia, departamento: "ESTETICA", cliente: x.cliente, vendedor: x.vendedor, canal: "NOVO", segmento: "CARRO", produto: x.tipo, valor: x.valor, premiacao: x.premiacao, status: x.faturado ? "FATURADO" : "A_FATURAR", placa: x.chassi.slice(-7), criado_por: AUTOR }));
      if (rows.length) chk(await db.from("vendas_complementares").insert(rows));
      return ["Estética (planilha online)"];
    } };
  }
  const linhas = parseRvd(aba(wb, /HAUS SSA/i));
  if (!linhas.length) throw new Error("Não encontrei os blocos NOVO/SEMINOVO/OFICINA");
  return { conteudo: linhas, linhas: linhas.length, resumo: `${linhas.length} vendedores`, gravar: async () => {
    const { data: cadV } = await db.from("vendedores_showroom").select("nome").eq("user_id", owner);
    const cad = ((cadV ?? []) as { nome: string }[]).map((x) => x.nome);
    const prev = linhas.map((l) => ({ ...l, vendedor: casarVendedor(l.vendedor, cad) }));
    const { data: vend } = await db.from("vendas_complementares").select("*").eq("user_id", owner).eq("mes", mes);
    const vendas = (vend ?? []) as VendaC[];
    const at = new Date().toISOString();
    chk(await db.from("vendedores_showroom").upsert(prev.map((l) => ({ user_id: owner, nome: l.vendedor, canal: l.canal, segmento: l.segmento })), { onConflict: "user_id,nome" }));
    chk(await db.from("rvd_volumes_mes").upsert(prev.map((l) => ({ user_id: owner, mes, vendedor: l.vendedor, veiculos: l.veiculos, target: targetTicket(l.canal, l.segmento), atualizado_por: AUTOR, updated_at: at })), { onConflict: "user_id,mes,vendedor" }));
    chk(await db.from("vendas_complementares").delete().eq("user_id", owner).eq("mes", mes).eq("departamento", "ACESSORIOS").eq("produto", "IMPORTAÇÃO RVD"));
    const rows = prev.flatMap((l) => { const d = diferencaRvd(l, vendas); return ([[d.fat, "FATURADO"], [d.af, "A_FATURAR"]] as const).filter(([x]) => x > 0).map(([x, st]) => ({ user_id: owner, mes, dia: `${mes}-01`, departamento: "ACESSORIOS", cliente: "CONSOLIDADO RVD", vendedor: l.vendedor, canal: l.canal, segmento: l.segmento, produto: "IMPORTAÇÃO RVD", valor: x, status: st, criado_por: AUTOR })); });
    if (rows.length) chk(await db.from("vendas_complementares").insert(rows));
    // A planilha é a fonte única: remove vendedores fora dela (evita duplicados com nomes abreviados).
    const nomes = new Set(prev.map((l) => l.vendedor));
    const fora = cad.filter((n) => !nomes.has(n));
    if (fora.length) chk(await db.from("vendedores_showroom").delete().eq("user_id", owner).in("nome", fora));
    return ["Acessórios RVD (planilha online)"];
  } };
}

/** Sincroniza uma fonte; grava só quando a planilha mudou e sempre registra o status (conexão + última novidade). */
export async function sincronizar(db: Db, f: Fonte, owner: string): Promise<StatusSync> {
  const chave = `sync-${f}`;
  const { data: ant } = await db.from("oficina_mes").select("diario").eq("user_id", owner).eq("mes", chave).maybeSingle();
  const anterior = (ant?.diario ?? {}) as StatusSync;
  const at = new Date().toISOString();
  let st: StatusSync;
  try {
    const p = await preparar(db, f, owner);
    const hash = hashConteudo(p.conteudo);
    const mudou = hash !== anterior.hash;
    if (mudou) {
      const origens = await p.gravar();
      const mes = isoBahia().slice(0, 7);
      for (const origem of origens) await db.from("update_log").insert({ user_id: owner, nome: AUTOR, origem, mes });
    }
    st = { at, ok: true, hash, mudouEm: mudou ? at : anterior.mudouEm ?? at, linhas: p.linhas, resumo: `${FONTES[f].label}: ${p.resumo}${mudou ? " · atualizado" : " · sem novidades"}` };
  } catch (e) {
    st = { ...anterior, at, ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
  await db.from("oficina_mes").upsert({ user_id: owner, mes: chave, diario: st, updated_at: at }, { onConflict: "user_id,mes" });
  return st;
}

/** Dono dos dados da equipe (o gestor), para a sincronização automática sem usuário logado. */
export async function donoDaEquipe(db: Db): Promise<string | null> {
  const { data } = await db.from("team_members").select("owner_id").not("owner_id", "is", null).limit(1).maybeSingle();
  if (data?.owner_id) return data.owner_id as string;
  const { data: n } = await db.from("nps_imports").select("user_id").order("at", { ascending: false }).limit(1).maybeSingle();
  return (n?.user_id as string) ?? null;
}
