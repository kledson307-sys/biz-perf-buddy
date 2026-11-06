import { norm } from "@/components/painel-ui";
import { ITENS, normCod, naoVendeAgregado, type Registro } from "@/lib/agregados";
import { nomeVendedor } from "@/lib/sales-report";
import { TIPOS_INTERNOS } from "@/lib/mecanicos";

const txt = (v: unknown) => String(v ?? "").trim();
const low = (v: unknown) => norm(txt(v)).toLowerCase();
const num = (v: unknown) => (typeof v === "number" ? v : Number(txt(v).replace(/\./g, "").replace(",", ".")) || 0);
const iso = (v: unknown): string => {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const m = txt(v).match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
};

/**
 * Agregados de SERVIÇO dentro do relatório "O.S. Fechadas": cada linha com TMO Ref. de um código de agregado
 * vira 1 unidade para o consultor (login) no dia do encerramento, valor = Serv. Líquido. O.S. internas ficam fora.
 * `codigos` = item → códigos (códigos do usuário substituem os padrão).
 */
export function agregadosDoFatServicos(raw: unknown[][], codigos?: Record<string, string[]>) {
  const hi = raw.findIndex((r) => { const h = r.map(low); return h.some((x) => /^tmo ref/.test(x)) && h.includes("encerrada") && h.some((x) => /^serv\.? liq/.test(x)); });
  if (hi < 0) return null;
  const h = raw[hi]!.map(low);
  const cRef = h.findIndex((x) => /^tmo ref/.test(x)), cEnc = h.indexOf("encerrada"), cServ = h.findIndex((x) => /^serv\.? liq/.test(x));
  const cTipo = h.findIndex((x) => x === "tipo"), cCons = h.lastIndexOf("consultor");
  const porCod = new Map<string, string>();
  for (const it of ITENS.filter((i) => i.g === "servicos")) for (const c of codigos?.[it.k] ?? it.cod) porCod.set(normCod(c), it.k);
  const acc = new Map<string, Registro>();
  for (const r of raw.slice(hi + 1)) {
    const codigo = normCod(txt(r[cRef])); const item = porCod.get(codigo);
    if (!item) continue;
    if (cTipo >= 0 && TIPOS_INTERNOS.has(txt(r[cTipo]).toUpperCase())) continue;
    const dia = iso(r[cEnc]); const nome = nomeVendedor(txt(r[cCons]));
    if (!dia || !nome || naoVendeAgregado(nome)) continue;
    const k = `${nome}|${item}|${codigo}|${dia}`;
    const l = acc.get(k) ?? { nome, item, codigo, dia, qtd: 0, valor: 0 };
    l.qtd += 1; l.valor = Math.round((l.valor + num(r[cServ])) * 100) / 100;
    acc.set(k, l);
  }
  const registros = [...acc.values()];
  if (!registros.length) return null;
  const dias = registros.map((r) => r.dia!).sort();
  return { registros, ini: dias[0]!, fim: dias[dias.length - 1]!, itens: [...new Set(registros.map((r) => r.item))] };
}
