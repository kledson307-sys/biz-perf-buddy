/** Sincronização automática das planilhas online (SharePoint): fontes, janela de horário e saúde da alimentação. Regras puras e testadas. */
export type Fonte = "agenda" | "nps" | "estetica" | "acessorios";

export const FONTES: Record<Fonte, { label: string; responsavel: string; minutos: number; share: string; usuario: string }> = {
  agenda: { label: "Agendamento", responsavel: "Ezequiel Silva", minutos: 15, usuario: "ezequielsilva_gruponewchase_com_br", share: "IQBdMnVXuQV5QIUIu_3s34D2AUHICHD4Ww4UkDXzZlsjHOE" },
  nps: { label: "NPS & Satisfação", responsavel: "Ezequiel Silva", minutos: 60, usuario: "ezequielsilva_gruponewchase_com_br", share: "IQDxrPigB0E_RY11RRssK8IfAWa7pAs9bNwBYLUCq924_oE" },
  estetica: { label: "Estética", responsavel: "Micheli Cruz", minutos: 60, usuario: "michelicruz_gruponewchase_com_br", share: "IQASApprwciTRp9om8w--oXKAZ-uW1R0KSiqMkQnv7HIf5o" },
  acessorios: { label: "Acessórios (RVD)", responsavel: "Geovana Lima", minutos: 60, usuario: "geovanalima_gruponewchase_com_br", share: "IQCrd4fQZkV9RIYg10not0Z8ASGVROAm3RQxf-LJtomW8b0" },
};
export const LISTA_FONTES = Object.keys(FONTES) as Fonte[];
export const urlDownload = (f: Fonte) => `https://gruponewchase-my.sharepoint.com/personal/${FONTES[f].usuario}/_layouts/15/download.aspx?share=${FONTES[f].share}`;

/** Horário da Bahia (UTC-3, sem horário de verão) lido pelos getters UTC. */
export const horaBahia = (d = new Date()) => new Date(d.getTime() - 3 * 3600_000);
export const isoBahia = (d = new Date()) => horaBahia(d).toISOString().slice(0, 10);

/** Seg–Sex 07:00–20:00, Sáb 07:00–14:00, Domingo pausa; no último dia do mês roda até 23:59 (fechamento). */
export function janela(d = new Date()): { ativa: boolean; fechamento: boolean } {
  const b = horaBahia(d);
  const h = b.getUTCHours(), dow = b.getUTCDay();
  const amanha = new Date(b.getTime() + 86400_000);
  const fechamento = amanha.getUTCMonth() !== b.getUTCMonth();
  if (h < 7) return { ativa: false, fechamento };
  if (fechamento) return { ativa: true, fechamento };
  if (dow === 0) return { ativa: false, fechamento };
  if (dow === 6) return { ativa: h < 14, fechamento };
  return { ativa: h < 20, fechamento };
}

/** Dias sem novidade na planilha, sem contar domingos: 0 verde, 1 amarelo, 2+ vermelho. */
export function diasSemNovidade(desdeIso: string, agora = new Date()): number {
  let d = new Date(isoBahia(new Date(desdeIso)) + "T12:00:00Z");
  const fim = isoBahia(agora); let n = 0;
  while (d.toISOString().slice(0, 10) < fim) { d = new Date(d.getTime() + 86400_000); if (d.getUTCDay() !== 0) n++; }
  return n;
}
export const corSaude = (dias: number) => (dias <= 0 ? "verde" : dias === 1 ? "amarelo" : "vermelho");

export type StatusSync = { at: string; ok: boolean; erro?: string; hash?: string; mudouEm?: string; linhas?: number; resumo?: string };

/** Hash curto e estável do conteúdo lido (detecta se a equipe lançou algo novo). */
export function hashConteudo(v: unknown): string {
  const s = JSON.stringify(v); let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36) + ":" + s.length;
}

const txt = (v: unknown) => String(v ?? "").trim();
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
export function dataCel(v: unknown): string {
  if (v instanceof Date) return new Date(v.getTime() + 12 * 3600_000).toISOString().slice(0, 10);
  if (typeof v === "number" && v > 30000 && v < 80000) return new Date(Date.UTC(1899, 11, 30) + v * 86400_000).toISOString().slice(0, 10);
  const m = txt(v).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}` : /^\d{4}-\d{2}-\d{2}/.test(txt(v)) ? txt(v).slice(0, 10) : "";
}
const horaCel = (v: unknown) => {
  if (v instanceof Date) return `${String(v.getUTCHours()).padStart(2, "0")}:${String(v.getUTCMinutes()).padStart(2, "0")}`;
  if (typeof v === "number" && v < 1) { const m = Math.round(v * 1440); return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; }
  const m = txt(v).match(/(\d{1,2}):(\d{2})/); return m ? `${m[1]!.padStart(2, "0")}:${m[2]}` : "";
};
const numv = (x: unknown) => (typeof x === "number" ? x : Number(txt(x).replace(/[R$\s]/g, "").replace(/\.(?=\d{3})/g, "").replace(",", ".")) || 0);

export type AgendaOnline = { data: string; hora: string; cliente: string; celular: string; servico: string; obs: string; status: string; modelo: string; operador: string; chassi: string; segmento: "carro" | "moto" };

/** Controle de Agendamento online (aba da loja): cabeçalho DATA/CLIENTE/SERVIÇO/STATUS/HORA AGENDADA/CHASSI. */
export function lerAgendaOnline(raw: unknown[][]): AgendaOnline[] {
  const hi = raw.findIndex((r) => { const h = r.map((c) => norm(txt(c))); return h.includes("DATA") && h.includes("CLIENTE") && h.includes("HORA AGENDADA"); });
  if (hi < 0) return [];
  const h = raw[hi]!.map((c) => norm(txt(c)));
  const c = (n: string) => h.indexOf(n);
  const k = { d: c("DATA"), cli: c("CLIENTE"), tel: c("CONTATO"), sv: c("SERVICO"), obs: c("OBSERVACAO"), st: c("STATUS"), hr: c("HORA AGENDADA"), mod: c("MODELO"), op: c("OPERADOR"), ch: c("CHASSI") };
  const g = (r: unknown[], i: number) => (i >= 0 ? r[i] : "");
  return raw.slice(hi + 1).map((r) => {
    const servico = txt(g(r, k.sv)), modelo = txt(g(r, k.mod)), chassi = txt(g(r, k.ch)).toUpperCase();
    const moto = /^99Z|^WB10/.test(chassi) || /MOTO/.test(norm(servico)) || /\b(GS|RT|RR|R 1300|G ?310|F ?\d{3,4})\b/.test(norm(modelo));
    return { data: dataCel(g(r, k.d)), hora: horaCel(g(r, k.hr)), cliente: txt(g(r, k.cli)), celular: txt(g(r, k.tel)), servico, obs: txt(g(r, k.obs)), status: txt(g(r, k.st)), modelo, operador: txt(g(r, k.op)), chassi, segmento: moto ? "moto" as const : "carro" as const };
  }).filter((x) => x.data && x.cliente);
}

/** Agenda do dia (hoje) e D+1 (próxima data agendada depois de hoje). */
export function separarAgenda(itens: AgendaOnline[], hoje: string) {
  const prox = itens.map((x) => x.data).filter((d) => d > hoje).sort()[0] ?? "";
  return { d0: itens.filter((x) => x.data === hoje), d1: prox ? itens.filter((x) => x.data === prox) : [], dataD1: prox };
}

export type EsteticaOnline = { dia: string; tipo: string; executivo: string; faturado: boolean; cliente: string; modelo: string; descricao: string; valor: number; pagamento: string; chassi: string; vendedor: string; premiacao: number };

/** Planilha de vendas de Estética (aba da loja): cabeçalho "Data Venda … Valor Venda … Vendedor Estet.". */
export function lerEsteticaOnline(raw: unknown[][]): EsteticaOnline[] {
  const hi = raw.findIndex((r) => { const h = r.map((c) => norm(txt(c))); return h.includes("DATA VENDA") && h.includes("VALOR VENDA"); });
  if (hi < 0) return [];
  const h = raw[hi]!.map((c) => norm(txt(c)));
  const c = (re: RegExp) => h.findIndex((x) => re.test(x));
  const k = { d: c(/^DATA VENDA/), t: c(/^TIPO/), ex: c(/^EXECUTIVO/), f: c(/^FATURADO/), cli: c(/^CLIENTE/), mod: c(/^MODELO/), ob: c(/^OBS/), v: c(/^VALOR VENDA/), pg: c(/^PAGAMENTO/), ch: c(/^CHASSI/), ve: c(/^VENDEDOR EST/), pr: c(/^PREMIA/) };
  const g = (r: unknown[], i: number) => (i >= 0 ? r[i] : "");
  return raw.slice(hi + 1).map((r) => {
    const executivo = txt(g(r, k.ex)).toUpperCase();
    return {
      dia: dataCel(g(r, k.d)), tipo: txt(g(r, k.t)).toUpperCase(), executivo, faturado: /^FATURADO/.test(norm(txt(g(r, k.f)))),
      cliente: txt(g(r, k.cli)).toUpperCase(), modelo: txt(g(r, k.mod)).toUpperCase(), descricao: txt(g(r, k.ob)), valor: numv(g(r, k.v)),
      pagamento: txt(g(r, k.pg)), chassi: txt(g(r, k.ch)).toUpperCase(), vendedor: executivo || "MARCELA", premiacao: numv(g(r, k.pr)),
    };
  }).filter((x) => x.dia && x.valor > 0 && (x.cliente || x.tipo));
}

/** Avisos do sininho: planilha parada há 2+ dias (sem domingo) ou leitura com falha. */
export function alertasSync(st: Partial<Record<Fonte, StatusSync>>, agora = new Date()) {
  return LISTA_FONTES.flatMap((f) => {
    const s = st[f]; if (!s) return [];
    const out: { id: string; titulo: string; texto: string; feito: boolean }[] = [];
    const dias = s.mudouEm ? diasSemNovidade(s.mudouEm, agora) : 0;
    if (dias >= 2) out.push({ id: `sync-parada-${f}-${isoBahia(agora)}`, titulo: `⚠️ Planilha de ${FONTES[f].label} sem novos lançamentos há ${dias} dias`, texto: `Responsável: ${FONTES[f].responsavel} · última novidade em ${new Date(s.mudouEm!).toLocaleDateString("pt-BR")}`, feito: false });
    if (!s.ok) out.push({ id: `sync-falha-${f}-${isoBahia(agora)}`, titulo: `Falha ao ler a planilha de ${FONTES[f].label}`, texto: `${s.erro ?? ""} · dados anteriores mantidos`, feito: false });
    return out;
  });
}
