/** Cálculos compartilhados dos cockpits da oficina (Marcos/Delmir) e Tunap. */
export function ritmo(v: number, m: number, dec: number, tot: number) {
  const proj = dec ? (v / dec) * tot : 0;
  const rest = Math.max(1, tot - dec);
  return { proj, projP: m ? proj / m : 0, nec: Math.max(0, m - v) / rest };
}

/** Ratio peças ÷ M.O.; faixa ideal R$ 2,50–3,50 por R$ 1,00 de serviço. */
export function ratioFaixa(pecas: number, servicos: number) {
  const r = servicos ? pecas / servicos : 0;
  const cls = r >= 2.5 && r <= 3.5 ? "text-success" : r >= 2 ? "text-warning" : "text-destructive";
  return { r, cls, txt: "R$ " + r.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) };
}

/** Conversão em unidades por passagem de revisão (ex.: 14 vendas ÷ 2 passagens = 7,0). */
export const porPassagem = (qtd: number, passagens: number) => (passagens ? qtd / passagens : 0);

export function dicaTecnico(t: { servicos: number; pecas: number; meta_servicos: number; meta_pecas: number }, dec: number, tot: number): string {
  const s = ritmo(+t.servicos, +t.meta_servicos, dec, tot), p = ritmo(+t.pecas, +t.meta_pecas, dec, tot);
  const r = ratioFaixa(+t.pecas, +t.servicos).r;
  if (s.projP >= 1 && p.projP >= 1) return "No ritmo da meta: manter o padrão e priorizar O.S. de maior ticket.";
  if (r < 2.5 && +t.servicos > 0) return "Peças abaixo da faixa ideal: reforçar inspeção completa e orçamento de itens de desgaste em cada passagem.";
  if (s.projP < p.projP) return `Serviços abaixo do ritmo: distribuir mais revisões/reparos a este box (precisa ${Math.round(s.nec).toLocaleString("pt-BR")} R$/dia).`;
  return `Peças abaixo do ritmo: precisa ${Math.round(p.nec).toLocaleString("pt-BR")} R$/dia; revisar diagnósticos pendentes de aprovação.`;
}
