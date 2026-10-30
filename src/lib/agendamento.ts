export type Categoria = "revisao" | "diagnostico" | "recall";
export type AgendItem = { hora: string; status: string; cliente: string; os: string; celular: string; consultor: string; produto: string; placa: string; segmento: "carro" | "moto"; categoria: Categoria; obs: string };
export type AgendReport = { tipo: "d1" | "d0"; data: string; itens: AgendItem[] };

const txt = (v: unknown) => String(v ?? "").trim();
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
const dataBR = (s: string) => { const m = s.match(/(\d{2})\/(\d{2})\/(\d{4})/); return m ? `${m[3]}-${m[2]}-${m[1]}` : ""; };

/** Reconhece o "Controle de Agendamento" pelo conteúdo (título + cabeçalho Agendada/Status/Placa), nunca pelo nome do arquivo. */
export function ehAgendamento(raw: unknown[][]) {
  const flat = raw.slice(0, 15).map((r) => norm(r.map(txt).join(" ")));
  return flat.some((l) => l.includes("CONTROLE DE AGENDAMENTO")) && flat.some((l) => l.includes("AGENDADA") && l.includes("STATUS") && l.includes("PLACA"));
}

export const segmentoProduto = (p: string): "carro" | "moto" => /SERIE [FGRKC]\b|MOTO/.test(norm(p)) ? "moto" : "carro";

/** Classifica pela descrição: linhas negativas ("NÃO", "NÃO POSSUI") são ignoradas. */
export function classificar(obs: string): Categoria {
  const pos = obs.split("\n").map(norm).filter((l) => l && !/:\s*(NAO|NAO POSSUI|N\/A|-)?\s*$/.test(l) && !/NAO POSSUI/.test(l)).join(" ");
  if (/CAMPANHA|RECALL|ATUALIZACAO DE SOFTWARE/.test(pos)) return "recall";
  if (/ALEGA|BARULHO|RUIDO|MENSAGEM|LUZ|FALHA|DEFEITO|VAZAMENTO|DIAGNOS|NAO LIGA|BARULH/.test(pos)) return "diagnostico";
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
      itens.push({ hora: ag.slice(6), status: g(r, "STATUS"), cliente: g(r, "CLIENTE"), os: g(r, "NR O.S"), celular: g(r, "CELULAR"), consultor: g(r, "TECNICO"), produto, placa: g(r, "PLACA").toUpperCase(), segmento: segmentoProduto(produto), categoria: "revisao", obs: obsCol >= 0 ? txt(r[obsCol]) : "" });
    } else if (itens.length && obsCol >= 0 && txt(r[obsCol]) && !norm(txt(r[obsCol])).startsWith("PAGINA")) {
      itens[itens.length - 1]!.obs += "\n" + txt(r[obsCol]);
    }
  }
  itens.forEach((it) => { it.categoria = classificar(it.obs); });
  return { tipo: impressao && periodo > impressao ? "d1" : "d0", data: periodo, itens };
}

import { supabase } from "@/integrations/supabase/client";

/** Agendas ficam numa linha própria de oficina_mes (mes = "agenda-AAAA-MM"), chave "tipo:data": reimportar o mesmo dia substitui. */
export async function salvarAgendamento(r: AgendReport, arquivo: string, nome: string) {
  const mes = `agenda-${r.data.slice(0, 7)}`;
  const { data: atual } = await supabase.from("oficina_mes").select("diario").eq("mes", mes).maybeSingle();
  const diario = { ...((atual?.diario as Record<string, unknown> | null) ?? {}), [`${r.tipo}:${r.data}`]: { ...r, arquivo, nome, at: new Date().toISOString() } };
  const { error } = await supabase.from("oficina_mes").upsert({ mes, diario: diario as never, updated_at: new Date().toISOString() }, { onConflict: "user_id,mes" });
  if (error) throw new Error("Erro ao salvar agendamento: " + error.message);
  await supabase.from("update_log").insert({ nome, origem: r.tipo === "d1" ? "Agendamento D+1" : "Agendamento do dia", mes: new Date().toISOString().slice(0, 7) });
}

export const resumoAgenda = (r: AgendReport) => {
  const c = (s: "carro" | "moto", k?: Categoria) => r.itens.filter((i) => i.segmento === s && (!k || i.categoria === k)).length;
  return `${r.itens.length} veículos · Carros ${c("carro")} (Rev ${c("carro", "revisao")} · Diag ${c("carro", "diagnostico")} · Recall ${c("carro", "recall")}) · Motos ${c("moto")}`;
};
