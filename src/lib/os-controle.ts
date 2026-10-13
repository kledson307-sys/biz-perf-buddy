import { norm } from "@/components/painel-ui";

export type Status = "pronto" | "pecas" | "judicial" | "diag" | "faturar" | "garantia" | "outros";
export type OsItem = {
  n: string; cons: string; cli: string; mod: string; placa: string; emi: string;
  pec: number; serv: number; valor: number; dias: number; obs: string; st: Status; desde: string;
};
export type OsImport = { id: string; at: string; nome: string; arquivo: string; itens: OsItem[] };

export const STATUS: { k: Status; nome: string }[] = [
  { k: "pronto", nome: "Prontos" },
  { k: "pecas", nome: "Aguardando peças" },
  { k: "judicial", nome: "Processos judiciais" },
  { k: "diag", nome: "Em diagnóstico" },
  { k: "faturar", nome: "Faturar" },
  { k: "garantia", nome: "Garantia / autorização" },
  { k: "outros", nome: "Outros" },
];

export function classificar(obs: string): Status {
  const o = norm(obs);
  if (/judic|justica/.test(o)) return "judicial";
  if (/garantia/.test(o) && /autoriza/.test(o)) return "garantia";
  if (/faturar/.test(o)) return "faturar";
  if (/pronto|aguard\w* retirada|liberado, aguardando pagamento/.test(o)) return "pronto";
  if (/aguardando pe[cç]a/.test(o)) return "pecas";
  if (/diagnost/.test(o)) return "diag";
  return "outros";
}

const toNum = (v: unknown) => typeof v === "number" ? v : Number(String(v ?? "").replace(/\./g, "").replace(",", ".")) || 0;
const iso = (d: Date) => d.toISOString().slice(0, 10);
export const hoje = () => iso(new Date(Date.now() - 3 * 3600e3));
export const diasEntre = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400e3);
const addDias = (d: string, n: number) => iso(new Date(Date.parse(d) + n * 86400e3));

/** Lê o relatório "Geral" do sistema (Número, Recep., Observação…). */
export function lerRelatorio(rows: unknown[][], anterior: OsImport | undefined, dataImport: string): OsItem[] {
  const h = rows.findIndex(r => r.some(c => norm(String(c)).trim() === "numero") && r.some(c => norm(String(c)).includes("observ")));
  if (h < 0) throw new Error("Não encontrei as colunas Número e Observação na planilha.");
  const head = (rows[h] ?? []).map(c => norm(String(c)).trim());
  const col = (re: RegExp) => head.findIndex(c => re.test(c));
  const c = { n: col(/^numero$/), cli: col(/cliente/), mod: col(/modelo/), cons: col(/recep|consultor|vendedor/), placa: col(/placa/), emi: col(/emissao/), pec: col(/itens/), serv: col(/serv/), valor: col(/valor/), dias: col(/dias/), obs: col(/observ/) };
  if (c.cons < 0) throw new Error("Não encontrei a coluna do consultor (Recep.).");
  const prev = new Map((anterior?.itens ?? []).map(i => [i.n, i]));
  const out: OsItem[] = [];
  for (const r of rows.slice(h + 1)) {
    const n = String(r[c.n] ?? "").trim();
    if (!n || !/\d/.test(n)) continue;
    const obs = String(r[c.obs] ?? "").trim();
    const st = classificar(obs);
    const dias = Math.max(0, Math.round(toNum(r[c.dias])));
    const p = prev.get(n);
    const desde = p && p.st === st ? p.desde : anterior ? dataImport : addDias(dataImport, -dias);
    out.push({
      n, st, obs, dias, desde,
      cons: String(r[c.cons] ?? "").trim().toUpperCase() || "SEM CONSULTOR",
      cli: String(r[c.cli] ?? "").trim(), mod: String(r[c.mod] ?? "").trim(), placa: String(r[c.placa] ?? "").trim(),
      emi: String(r[c.emi] ?? "").trim(),
      pec: toNum(r[c.pec]), serv: toNum(r[c.serv]), valor: toNum(r[c.valor]),
    });
  }
  if (!out.length) throw new Error("Nenhuma O.S. encontrada na planilha.");
  return out;
}

/** Data de previsão escrita na observação (ex.: "previsão dia 13/10"). */
export function previsao(obs: string, ref: string): string | null {
  const m = obs.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (!m) return null;
  const y3 = m[3]; const y = y3 ? (y3.length === 2 ? 2000 + +y3 : +y3) : +ref.slice(0, 4);
  const d = new Date(Date.UTC(y, Number(m[2]) - 1, Number(m[1])));
  return isNaN(+d) ? null : iso(d);
}

export type Alerta = { nivel: "alto" | "medio" | "info"; texto: string };
export type Analise = { item: OsItem; diasStatus: number; semMudanca: boolean; alertas: Alerta[]; acoes: string[]; prev: string | null; proxContato: string | undefined; contatoHoje: boolean };

export function analisar(item: OsItem, anterior: OsImport | undefined, ref: string, prevManual?: string | null): Analise {
  const a = anterior?.itens.find(i => i.n === item.n);
  const semMudanca = Boolean(a && a.st === item.st);
  const diasStatus = Math.max(0, diasEntre(item.desde, ref));
  const prev = prevManual || previsao(item.obs, ref);
  const alertas: Alerta[] = []; let acoes: string[] = []; let proxContato: string | undefined; let contatoHoje = false;
  switch (item.st) {
    case "pronto":
      if (semMudanca) alertas.push({ nivel: "alto", texto: `Continua pronto desde a última atualização (${diasStatus} dias) — veículo parado sem faturar.` });
      acoes = semMudanca
        ? ["Enviar telegrama com AR convocando a retirada", "Enviar e-mail formal com prazo de retirada e valor em aberto", "Ligação registrada + WhatsApp com resumo do serviço", "Informar início da cobrança de diária de pátio (conforme política da loja)", "Após 30 dias pronto: notificação extrajudicial via jurídico", "Oferecer formas de pagamento / parcelamento para destravar a retirada"]
        : ["Confirmar data e horário de retirada com o cliente", "Deixar a O.S. pronta para faturar no momento da entrega", "Agendar a entrega técnica e lavagem"];
      break;
    case "pecas": {
      const noMes = prev && prev.slice(0, 7) === ref.slice(0, 7);
      if (prev) alertas.push({ nivel: "info", texto: noMes ? `Peça prevista para ${fmt(prev)} — chega dentro do mês.` : `Peça prevista para ${fmt(prev)}.` });
      else alertas.push({ nivel: "medio", texto: "Sem previsão de chegada na observação — confirmar com o setor de peças." });
      const k = Math.ceil(diasStatus / 7) * 7;
      proxContato = addDias(item.desde, Math.max(7, k));
      contatoHoje = diasStatus > 0 && diasStatus % 7 === 0;
      if (contatoHoje) alertas.push({ nivel: "alto", texto: "Hoje é dia de retorno semanal ao cliente sobre a peça." });
      if (diasStatus > 30) alertas.push({ nivel: "alto", texto: `${diasStatus} dias aguardando peça — risco de reclamação no Procon e ação judicial (CDC art. 18 / 32: prazo de 30 dias para sanar o vício).` });
      acoes = ["Contato semanal com o cliente informando a situação da peça", "Registrar cada contato (data, canal, o que foi dito)"];
      if (diasStatus > 30) acoes.push("Abrir caso crítico com a montadora (BMW) pedindo prioridade/back order", "Oferecer carro reserva ou solução de mobilidade", "Formalizar por e-mail a previsão e as tentativas de solução", "Alinhar com o jurídico antes de qualquer promessa de prazo", "Proteger o veículo parado: bateria no mantenedor, capa, vistoria de pátio");
      else acoes.push("Se a previsão passar de 30 dias, abrir caso crítico com a montadora já agora");
      break;
    }
    case "judicial":
      alertas.push({ nivel: "alto", texto: `Caso judicial — veículo há ${item.dias} dias na oficina.` });
      acoes = ["Não mexer no veículo sem autorização do jurídico", "Manter bateria no mantenedor e veículo coberto, em local seguro", "Fotos e checklist mensais do estado do veículo (prova de conservação)", "Registrar quilometragem e combustível; guardar chaves controladas", "Reunião mensal de acompanhamento com o jurídico e registro do andamento", "Separar documentos: O.S., orçamentos, e-mails e comunicações com o cliente"];
      break;
    case "diag":
      if (diasStatus >= 7) alertas.push({ nivel: "alto", texto: `Lembrete diário: ${diasStatus} dias em diagnóstico sem conclusão.` });
      acoes = diasStatus >= 7
        ? ["Cobrar o técnico responsável por um parecer hoje", "Escalar para a garantia/suporte técnico da montadora (TSARA/PUMA)", "Atualizar o cliente sobre o andamento e prazo do diagnóstico", "Avaliar veículo reserva se o cliente estiver sem mobilidade"]
        : ["Definir prazo de conclusão com o técnico", "Informar o cliente da previsão do diagnóstico"];
      break;
    case "faturar":
      if (semMudanca) alertas.push({ nivel: "alto", texto: "Continua para faturar desde a última atualização — demora no encerramento do processo." });
      acoes = ["Faturar a O.S. hoje ou registrar o motivo do bloqueio", "Conferir pendências com o financeiro (crédito, pagamento, nota)", "Encerrar no sistema para não inflar as O.S. abertas"];
      break;
    case "garantia":
      if (semMudanca && diasStatus >= 15) alertas.push({ nivel: "medio", texto: `Aguardando autorização há ${diasStatus} dias.` });
      acoes = ["Cobrar a autorização com a montadora/garantia", "Conferir se toda a documentação do processo foi enviada", "Faturar assim que autorizado"];
      break;
    default:
      if (semMudanca && diasStatus >= 14) alertas.push({ nivel: "medio", texto: `Sem mudança há ${diasStatus} dias.` });
      acoes = ["Definir próximo passo e responsável", "Atualizar a observação da O.S. no sistema"];
  }
  return { item, diasStatus, semMudanca, alertas, acoes, prev, proxContato, contatoHoje };
}

export const fmt = (d: string) => d.split("-").reverse().join("/");

/** Data do retorno semanal ao cliente que está vencido (aguardando peças ou diagnóstico há 7+ dias), ou null. */
export function retornoDevido(item: OsItem, ref: string): string | null {
  if (item.st !== "pecas" && item.st !== "diag") return null;
  const d = Math.max(0, diasEntre(item.desde, ref));
  if (d < 7) return null;
  return addDias(item.desde, Math.floor(d / 7) * 7);
}
