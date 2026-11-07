import { supabase } from "@/integrations/supabase/client";

export type Categoria = "revisao" | "diagnostico" | "recall";
export type AgendItem = { hora: string; status: string; cliente: string; os: string; celular: string; consultor: string; produto: string; placa: string; segmento: "carro" | "moto"; categoria: Categoria; obs: string };
export type AgendReport = { tipo: "d1" | "d0"; data: string; itens: AgendItem[] };

const txt = (v: unknown) => String(v ?? "").trim();
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
const dataBR = (s: string) => { const m = s.match(/(\d{2})\/(\d{2})\/(\d{4})/); return m ? `${m[3]}-${m[2]}-${m[1]}` : ""; };

/** Reconhece o "Controle de Agendamento" pelo conteúdo (título + cabeçalho Agendada/Status/Placa), nunca pelo nome do arquivo. */
export function ehAgendamento(raw: unknown[][]) {
  const flat = raw.slice(0, 35).map((r) => norm(r.map(txt).join(" ")));
  return flat.some((l) => l.includes("CONTROLE DE AGENDAMENTO")) && flat.some((l) => l.includes("AGENDADA") && l.includes("STATUS") && l.includes("PLACA"));
}

export const segmentoProduto = (p: string): "carro" | "moto" => /SERIE [FGRKC]\b|MOTO/.test(norm(p)) ? "moto" : "carro";

/** Classifica pela descrição: linhas negativas ("NÃO", "NÃO POSSUI") são ignoradas. */
const NEG = /^\s*(N|NA|NAO|NENHUM[A]?|SEM|-|0|NAO POSSUI|NAO HA|NAO TEM)\b|^\s*$/;
const REV = /MANUTENC|REVISA|OLEO|PASTILHA|FLUIDO|FILTRO|PREVENTIV|\bBSI\b/;
const RECALL = /TROCA DE PECA|\bMEC\b|\bMEC\d|RECALL|CAMPANHA|ATUALIZACAO DE SOFTWARE/;
const DIAG = /\bDIAG|ALEGA|BARULHO|\bLUZ|SUSPENSAO|RUIDO|LIQUIDO|BAIXO|QUEBRAD|SOLT[OA]|FALHA|DEFEITO|VAZAMENTO|NAO (LIGA|PEGA|FUNCIONA)|TRAVAND|VIBRA|AQUEC|ESQUENT|BATID/;

/**
 * Leitura contextual de "Observações e Reclamações": campos "RÓTULO: valor" contam pelo
 * sentido do rótulo só quando o valor é positivo (ex.: "MANUTENÇÃO: NÃO" é ignorado), e
 * frases negadas ("não quer revisão", "sem manutenção") são descartadas.
 * Precedência: revisão (mesmo com outros serviços) > recall > diagnóstico.
 */
export function classificar(obs: string): Categoria {
  const cru = norm(obs);
  if (/\b0000105|\b0000111/.test(cru)) return "revisao";
  let rev = false, rec = false, diag = false;
  const livre: string[] = [];
  const PREF = /PREFERENCIA|CONSULTOR|TECNICO|PRODUTIVO|TELEFONE|CONTATO|EMAIL/;
  // Rótulos conhecidos do DMS (inclui compostos como "CAMPANHA TECNICA").
  const ROTULOS = /^(MANUTENC\w*|REVISA\w*|CAMPANHA( TECNICA)?|RECALL|ALEGA\w*|RECLAMA\w*|OBSERVAC\w*|BSI|PREFERENCIA\w*|CONSULTOR\w*|TECNICO\w*|PRODUTIVO\w*|TELEFONE|CONTATO|EMAIL)$/;
  // Separa em campos "RÓTULO: valor" (vários por linha são aceitos).
  const campos: Array<[string, string]> = [];
  for (const linha of cru.split(/\n|;/)) {
    const partes = linha.split(/([A-Z][A-Z/ .]{1,40}):/);
    if (partes[0]?.trim()) livre.push(partes[0]);
    for (let i = 1; i < partes.length; i += 2) {
      let rot = partes[i]!.trim();
      const val = (partes[i + 1] ?? "").trim();
      // Quando vários campos vêm na mesma linha só com espaços ("MANUTENÇÃO: SIM CAMPANHA TÉCNICA: SIM"),
      // o valor do campo anterior é engolido pelo rótulo seguinte; devolve as palavras iniciais ao campo anterior.
      while (rot.includes(" ") && !ROTULOS.test(rot)) {
        const sp = rot.indexOf(" ");
        const w = rot.slice(0, sp);
        rot = rot.slice(sp + 1).trim();
        if (campos.length) campos[campos.length - 1]![1] = (campos[campos.length - 1]![1] + " " + w).trim();
        else livre.push(w);
      }
      campos.push([rot, val]);
    }
  }
  for (const [rot, val] of campos) {
    if (NEG.test(val) || PREF.test(rot)) continue;
    if (/CAMPANHA|RECALL/.test(rot)) { if (/^(SIM|S\b|\d)/.test(val) || RECALL.test(val)) rec = true; else livre.push(val); continue; }
    if (/MANUTENC|REVISA/.test(rot)) { if (/^(SIM|S\b)/.test(val)) rev = true; livre.push(val); continue; }
    if (/ALEGA|RECLAMA/.test(rot)) { diag = true; livre.push(val); continue; }
    if (/^BSI$/.test(rot)) { if (/^(SIM|S\b)/.test(val)) rev = true; continue; }
    livre.push(val);
  }
  // Remove frases negadas antes de buscar termos.
  const t = livre.join(" ").replace(/\s+/g, " ")
    .replace(/\b(NAO|SEM|NEM)\s+(\w+\s+){0,3}?(MANUTENC\w*|REVISA\w*|OLEO|PASTILHA\w*|FLUIDO|FILTRO\w*|CAMPANHA\w*|RECALL|BARULHO\w*|RUIDO\w*|VAZAMENTO\w*|DEFEITO\w*|FALHA\w*|LUZ\w*)/g, " ");
  if (REV.test(t)) rev = true;
  if (RECALL.test(t)) rec = true;
  if (DIAG.test(t)) diag = true;
  if (rev) return "revisao";
  if (rec) return "recall";
  if (diag) return "diagnostico";
  return "revisao";
}

export function lerAgendamento(raw: unknown[][]): AgendReport | null {
  if (!ehAgendamento(raw)) return null;
  let periodo = "", impressao = ""; let h = -1; const col: Record<string, number> = {};
  raw.forEach((r, i) => r.forEach((c, j) => {
    const s = txt(c), n = norm(s);
    if (!periodo && /\bDE \d{2}\/\d{2}\/\d{4}/.test(n)) periodo = dataBR(s);
    if (!impressao && n.startsWith("DATA DE IMPRESSAO")) impressao = dataBR(r.slice(j).map(txt).join(" "));
    if (h < 0 && n === "AGENDADA") h = i;
  }));
  if (h < 0 || !periodo) return null;
  raw[h]!.forEach((c, j) => { const n = norm(txt(c)); if (n && !(n in col)) col[n] = j; });
  const g = (r: unknown[], k: string) => (col[k] === undefined ? "" : txt(r[col[k]!]));
  const obsCol = col["RECLAMACOES"] ?? -1;
  const itens: AgendItem[] = [];
  for (let i = h + 1; i < raw.length; i++) {
    const r = raw[i]!; const ag = g(r, "AGENDADA");
    if (/^\d{2}\/\d{2} \d{2}:\d{2}/.test(ag)) {
      const produto = g(r, "PRODUTO");
      itens.push({ hora: ag.slice(6), status: g(r, "STATUS"), cliente: g(r, "CLIENTE"), os: g(r, "NR O.S"), celular: g(r, "CELULAR"), consultor: g(r, "AGENTE") || g(r, "TECNICO") || g(r, "CONSULTOR"), produto, placa: g(r, "PLACA").toUpperCase(), segmento: segmentoProduto(produto), categoria: "revisao", obs: obsCol >= 0 ? txt(r[obsCol]) : "" });
    } else if (itens.length && obsCol >= 0 && txt(r[obsCol]) && !/^(PAGINA|DATA DE IMPRESSAO|OBSERVACOES E|RECLAMACOES)/.test(norm(txt(r[obsCol])))) {
      itens[itens.length - 1]!.obs += "\n" + txt(r[obsCol]);
    }
  }
  itens.forEach((it) => { it.categoria = classificar(`${it.obs} ${it.produto}`); if (/\b0000111/.test(norm(it.obs))) it.segmento = "moto"; if (/\b0000105/.test(norm(it.obs))) it.segmento = "carro"; });
  return { tipo: impressao && periodo > impressao ? "d1" : "d0", data: periodo, itens };
}


/** Agendas ficam na tabela `agendamentos`: reimportar o mesmo dia/tipo substitui as linhas. */
export async function salvarAgendamento(r: AgendReport, arquivo: string, nome: string) {
  const { error: del } = await supabase.from("agendamentos").delete().eq("tipo", r.tipo).eq("data", r.data);
  if (del) throw new Error("Erro ao substituir agendamento: " + del.message);
  // A mesma placa/horário pode aparecer repetida no relatório (quebra de página ou placa vazia): mantém uma linha só.
  const unicos = new Map<string, AgendReport["itens"][number]>();
  for (const it of r.itens) {
    const k = `${it.placa || norm(it.cliente)}|${it.hora}`;
    const ja = unicos.get(k);
    if (!ja) { unicos.set(k, { ...it, placa: it.placa || `SEM-PLACA ${norm(it.cliente)}`.slice(0, 40) }); continue; }
    if (it.obs && !ja.obs.includes(it.obs)) ja.obs += "\n" + it.obs;
  }
  const rows = [...unicos.values()].map((it) => ({
    data: r.data, tipo: r.tipo, hora: it.hora, status: it.status, cliente: it.cliente, os: it.os,
    celular: it.celular, consultor: it.consultor, produto: it.produto, placa: it.placa,
    segmento: it.segmento, categoria: it.categoria, obs: it.obs, arquivo, importado_por: nome,
  }));
  if (rows.length) {
    const { error } = await supabase.from("agendamentos").insert(rows);
    if (error) throw new Error("Erro ao salvar agendamento: " + error.message);
  }
  await supabase.from("update_log").insert({ nome, origem: r.tipo === "d1" ? "Agendamento D+1" : "Agendamento do dia", mes: r.data.slice(0, 7) });
}

export const resumoAgenda = (r: AgendReport) => {
  const c = (s: "carro" | "moto", k?: Categoria) => r.itens.filter((i) => i.segmento === s && (!k || i.categoria === k)).length;
  return `${r.itens.length} veículos · Carros ${c("carro")} (Rev ${c("carro", "revisao")} · Diag ${c("carro", "diagnostico")} · Recall ${c("carro", "recall")}) · Motos ${c("moto")}`;
};
