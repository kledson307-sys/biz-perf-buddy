import { Box, Pizza, brl, div, pct, tone } from "@/components/painel-ui";

type Linha = {
  c: { id: string; nome: string };
  servicos: number; pecas: number; real: number; mS: number; mP: number; meta: number;
  projS: number; projP: number; proj: number;
  perfS: number; perfP: number; perf: number;
  projPctS: number; projPctP: number; projPct: number;
  mediaDia: number; necS: number; necP: number; nec: number;
};
type Tot = Omit<Linha, "c">;
type Dept = { nome: string } & Tot;
type Sale = { consultant_id: string; dia: string; servicos: number; pecas: number };
type Dia = { dia: number; valor: number; ac: number };

const diasDoMes = (sales: Sale[], tot: number): Dia[] => {
  const m = new Map<number, number>();
  sales.forEach((s) => {
    const d = +s.dia.slice(8, 10);
    if (d) m.set(d, (m.get(d) ?? 0) + s.servicos + s.pecas);
  });
  let ac = 0;
  return Array.from({ length: Math.max(tot, 1) }, (_, i) => i + 1).map((d) => {
    const valor = m.get(d) ?? 0;
    ac += valor;
    return { dia: d, valor, ac };
  });
};

const nomes = (arr: Linha[]) => arr.map((l) => l.c.nome).join(", ");

type Leitura = { geral: string[]; forcas: string[]; atencao: string[]; plano: string[] };

function lerFechamento(linhas: Linha[], total: Tot, porDept: Dept[], dias: Dia[], dec: number, tot: number): Leitura {
  const rest = Math.max(tot - dec, 0);
  const comMeta = linhas.filter((l) => l.meta > 0);
  const batem = comMeta.filter((l) => l.perf >= 1);
  const quase = comMeta.filter((l) => l.perf >= 0.85 && l.perf < 1);
  const longe = comMeta.filter((l) => l.perf < 0.85).sort((a, b) => a.perf - b.perf);
  const ord = [...linhas].sort((a, b) => b.perf - a.perf);
  const lider = ord[0];
  const liderServ = [...linhas].sort((a, b) => b.perfS - a.perfS)[0];
  const liderPec = [...linhas].sort((a, b) => b.perfP - a.perfP)[0];
  const melhor = [...dias].sort((a, b) => b.valor - a.valor)[0];
  const mixS = div(total.servicos, total.real);

  const geral: string[] = [];
  if (total.meta === 0) {
    geral.push(`Ainda não há metas cadastradas para este mês, então os números abaixo não medem performance — medem apenas o que foi faturado: ${brl(total.real)} (${brl(total.servicos)} em serviços e ${brl(total.pecas)} em peças).`);
  } else {
    geral.push(`Até o dia ${dec} de ${tot}, o time faturou ${brl(total.real)} contra uma meta de ${brl(total.meta)} — ${pct(total.perf)} do que foi combinado. Do que já entrou, ${pct(mixS)} veio de serviços (${brl(total.servicos)}) e ${pct(1 - mixS)} de peças (${brl(total.pecas)}).`);
    geral.push(`A projeção de fechamento é ${brl(total.proj)} (${pct(total.projPct)} da meta). ${rest ? `Faltam ${rest} ${rest === 1 ? "dia" : "dias"} e o ritmo necessário é ${brl(total.nec)} por dia — hoje o time faz ${brl(total.mediaDia)} por dia.` : "Mês encerrado: os números acima são o resultado final."}`);
    const forte = total.perfS >= total.perfP ? "serviços" : "peças";
    const fraco = forte === "serviços" ? "peças" : "serviços";
    if (Math.abs(total.perfS - total.perfP) > 0.08) {
      geral.push(`O grupo de ${forte} está puxando o resultado (${pct(forte === "serviços" ? total.perfS : total.perfP)} da meta) e ${fraco} está ficando para trás (${pct(fraco === "serviços" ? total.perfS : total.perfP)}). O esforço do mês precisa pesar em ${fraco}.`);
    } else {
      geral.push(`Serviços e peças estão andando no mesmo ritmo (${pct(total.perfS)} e ${pct(total.perfP)}) — é um bom sinal de equilíbrio.`);
    }
  }

  const forcas: string[] = [];
  if (lider && lider.real > 0) forcas.push(`🏆 ${lider.c.nome} é o nome do mês: ${pct(lider.perf)} da meta, ${brl(lider.real)} faturados e ${brl(lider.mediaDia)} por dia.`);
  if (batem.length) forcas.push(`🎉 ${nomes(batem)} já bateram a meta. Vale parar, agradecer e entender o que eles estão fazendo de diferente.`);
  if (quase.length) forcas.push(`👏 ${nomes(quase)} está a um passo da meta (${pct(quase[0]!.perf)} ou mais) — um esforço a mais fecha o mês.`);
  if (liderServ && liderServ.mS > 0 && liderServ !== lider) forcas.push(`🔧 Em serviços, a referência é ${liderServ.c.nome} com ${pct(liderServ.perfS)} da meta.`);
  if (liderPec && liderPec.mP > 0 && liderPec !== lider && liderPec !== liderServ) forcas.push(`🔩 Em peças, quem dá a linha é ${liderPec.c.nome} com ${pct(liderPec.perfP)} da meta.`);
  if (melhor && melhor.valor > 0) forcas.push(`⭐ O melhor dia do mês foi o dia ${melhor.dia}, com ${brl(melhor.valor)} faturados — foi o dia em que o time mais vendeu.`);
  const deptOk = porDept.filter((d) => d.meta > 0 && d.perf >= 1);
  if (deptOk.length) forcas.push(`📈 ${deptOk.map((d) => d.nome).join(", ")} ${deptOk.length === 1 ? "está" : "estão"} acima da meta do mês.`);
  if (!forcas.length) forcas.push("O mês ainda está no começo: os números vão aparecer assim que as primeiras vendas forem lançadas.");

  const atencao: string[] = [];
  if (total.meta === 0) atencao.push("⚠️ Cadastre as metas do mês — sem meta, o painel mostra o faturamento mas não diz se ele é bom.");
  longe.forEach((l) => atencao.push(`${l.c.nome}: ${pct(l.perf)} da meta, faltam ${brl(Math.max(l.meta - l.real, 0))}${rest ? ` — precisa de ${brl(l.nec)} por dia` : ""}.`));
  porDept.filter((d) => d.real === 0).forEach((d) => atencao.push(`⚠️ ${d.nome} ainda não lançou nenhuma venda neste mês.`));
  if (total.meta > 0 && Math.abs(total.perfS - total.perfP) > 0.08) {
    if (total.perfS < total.perfP) atencao.push(`🔧 Serviços está atrás (${pct(total.perfS)} contra ${pct(total.perfP)} de peças): retomar orçamentos parados e confirmar agendamentos.`);
    else atencao.push(`🔩 Peças está atrás (${pct(total.perfP)} contra ${pct(total.perfS)} de serviços): oferecer item complementar em todo atendimento.`);
  }
  if (!atencao.length) atencao.push("✅ Nenhum ponto crítico à vista: todos os consultores estão acima de 85% da meta.");

  const plano: string[] = [];
  if (rest) plano.push(`Dividir o que falta em metas diárias: ${brl(total.necS)} de serviços e ${brl(total.necP)} de peças por dia.`);
  plano.push("Pente-fino em orçamento parado: ligar para todo cliente que pediu cotação e não voltou. É a venda mais barata que existe.");
  plano.push("Oferecer item complementar em todo atendimento — quem já leva peça tem que sair com serviço agendado, e vice-versa.");
  if (longe.length) plano.push(`Acompanhar de perto ${nomes(longe.slice(0, 3))}: uma conversa por dia com quem está mais longe da meta.`);
  if (lider && lider.real > 0) plano.push(`Pedir para ${lider.c.nome} dividir com o time a rotina que está usando. Quinze minutos na reunião já mudam o mês.`);
  if (quase.length) plano.push(`Fechar quem está perto: ${nomes(quase)} depende só dos últimos dias.`);

  return { geral, forcas, atencao, plano };
}

function Colunas({ dias, metaDia, ate }: { dias: Dia[]; metaDia: number; ate: number }) {
  const lista = dias.slice(0, Math.max(ate, 1));
  const max = Math.max(...lista.map((d) => d.valor), metaDia, 1);
  const W = 760, H = 170, B = 10;
  const bw = (W - B * 2) / Math.max(lista.length, 1);
  const y = (v: number) => H - B - div(v, max) * (H - B * 2);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Faturamento de cada dia do mês">
      {metaDia > 0 && <line x1={B} y1={y(metaDia)} x2={W - B} y2={y(metaDia)} stroke="var(--destructive)" strokeDasharray="5 4" strokeWidth="1.2" />}
      {lista.map((d, i) => (
        <g key={d.dia}>
          <rect x={B + i * bw + bw * 0.18} y={y(d.valor)} width={bw * 0.64} height={Math.max(H - B - y(d.valor), d.valor > 0 ? 2 : 0)} rx="1.5" fill={d.valor > 0 ? "var(--primary)" : "var(--border)"} />
          {i % Math.ceil(lista.length / 15) === 0 && <text x={B + i * bw + bw * 0.5} y={H - 1} fontSize="8" textAnchor="middle" fill="var(--muted-foreground)">{d.dia}</text>}
        </g>
      ))}
    </svg>
  );
}

function Acumulado({ dias, meta, ate }: { dias: Dia[]; meta: number; ate: number }) {
  const max = Math.max(meta, ...dias.map((d) => d.ac), 1);
  const W = 760, H = 170, B = 12;
  const x = (d: number) => B + div(d - 1, Math.max(ate - 1, 1)) * (W - B * 2);
  const y = (v: number) => H - B - div(v, max) * (H - B * 2);
  const lista = dias.slice(0, Math.max(ate, 1));
  const pts = lista.map((d) => `${x(d.dia)},${y(d.ac)}`).join(" ");
  const ultimo = lista[lista.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Acumulado do mês comparado com a meta">
      <line x1={x(1)} y1={y(0)} x2={x(ate)} y2={y(meta)} stroke="var(--muted-foreground)" strokeDasharray="5 4" strokeWidth="1.2" />
      {pts && <polyline points={pts} fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinejoin="round" />}
      {ultimo && <circle cx={x(ultimo.dia)} cy={y(ultimo.ac)} r="3.5" fill="var(--primary)" />}
      {ultimo && <text x={Math.min(x(ultimo.dia), W - 70)} y={Math.max(y(ultimo.ac) - 8, 12)} fontSize="10" fill="var(--primary)" fontWeight="700">{brl(ultimo.ac)}</text>}
      <text x={x(ate) - 60} y={Math.max(y(meta) - 6, 12)} fontSize="9" fill="var(--muted-foreground)">meta {brl(meta)}</text>
    </svg>
  );
}

export function AnaliseFechamento({ linhas, total, porDept, sales, dec, tot, mes }: {
  linhas: Linha[]; total: Tot; porDept: Dept[]; sales: Sale[]; dec: number; tot: number; mes: string;
}) {
  const dias = diasDoMes(sales, tot);
  const l = lerFechamento(linhas, total, porDept, dias, dec, tot);
  const mix = [
    { label: "Serviços", valor: total.servicos },
    { label: "Peças", valor: total.pecas },
  ].filter((d) => d.valor > 0);
  const perf = [...linhas].sort((a, b) => b.perf - a.perf).slice(0, 10).map((x) => ({ label: x.c.nome, valor: x.perf, extra: brl(x.real) }));
  const metaDia = div(total.meta, tot);

  return (
    <div className="space-y-4">
      <Box title="Como estamos">
        <div className="space-y-3 p-4 text-sm leading-relaxed">
          {l.geral.map((t, i) => <p key={i}>{t}</p>)}
          <p className="text-xs text-muted-foreground">Mês {mes} · dia {dec} de {tot} · {linhas.length} consultores no painel.</p>
        </div>
      </Box>

      <div className="grid gap-4 lg:grid-cols-3">
        <Box title="Mix do que já entrou">
          <div className="p-4">
            {mix.length ? <Pizza dados={mix} centro={<span className="text-xs font-semibold">mix</span>} /> : <p className="text-sm text-muted-foreground">Sem vendas lançadas.</p>}
          </div>
        </Box>
        <Box title="Performance por consultor">
          <div className="p-4">
            {perf.length ? <Pizza dados={perf} centro={<span className="text-xs font-semibold">ranking</span>} /> : <p className="text-sm text-muted-foreground">Sem dados.</p>}
          </div>
        </Box>
        <Box title="Ritmo diário">
          <div className="p-4">
            <Colunas dias={dias} metaDia={metaDia} ate={Math.max(dec, 1)} />
            <p className="mt-2 text-xs text-muted-foreground">Cada barra é um dia. A linha tracejada é o ritmo de {brl(metaDia)}/dia necessário para bater a meta.</p>
          </div>
        </Box>
      </div>

      <Box title="Acumulado do mês × meta">
        <div className="p-4">
          <Acumulado dias={dias} meta={total.meta} ate={Math.max(dec, 1)} />
          <p className="mt-2 text-xs text-muted-foreground">A linha cheia é o que já foi faturado; a tracejada é a caminhada da meta até o fim do mês. Ficar acima da tracejada significa estar no ritmo certo.</p>
        </div>
      </Box>

      <div className="grid gap-4 lg:grid-cols-2">
        <Box title="O que está funcionando">
          <ul className="space-y-2 p-4 text-sm">
            {l.forcas.map((t, i) => <li key={i} className="rounded-md bg-success/10 px-3 py-2">{t}</li>)}
          </ul>
        </Box>
        <Box title="Onde precisa de atenção">
          <ul className="space-y-2 p-4 text-sm">
            {l.atencao.map((t, i) => <li key={i} className="rounded-md bg-warning/10 px-3 py-2">{t}</li>)}
          </ul>
        </Box>
      </div>

      <Box title="Plano para os próximos dias">
        <ul className="space-y-2 p-4 text-sm">
          {l.plano.map((t, i) => <li key={i} className="flex gap-3 rounded-md bg-muted/60 px-3 py-2"><span className="font-bold text-primary">{i + 1}.</span><span>{t}</span></li>)}
        </ul>
      </Box>
    </div>
  );
}

const MEDALHAS = ["🥇", "🥈", "🥉"];
const ELOGIO = [
  "Puxou o time o mês inteiro. É a referência que todo mundo devia olhar.",
  "Foi atrás o tempo todo e chegou pertinho. Continua que a meta vem.",
  "Fez o trabalho duro, o que sustenta o resultado do grupo.",
];

export function Reconhecimento({ linhas, sales, dec, tot, mes }: { linhas: Linha[]; sales: Sale[]; dec: number; tot: number; mes: string }) {
  const dias = diasDoMes(sales, tot);
  const melhores = [...linhas].filter((l) => l.real > 0).sort((a, b) => b.perf - a.perf);
  const liderServ = [...linhas].filter((l) => l.mS > 0).sort((a, b) => b.perfS - a.perfS)[0];
  const liderPec = [...linhas].filter((l) => l.mP > 0).sort((a, b) => b.perfP - a.perfP)[0];
  const melhor = [...dias].sort((a, b) => b.valor - a.valor)[0];
  const batem = linhas.filter((l) => l.meta > 0 && l.perf >= 1);

  if (!melhores.length) {
    return <Box title="Reconhecimento"><p className="p-4 text-sm text-muted-foreground">Assim que as primeiras vendas do mês aparecerem, os nomes desta página mudam — eles vêm de quem fez acontecer.</p></Box>;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        {melhores.slice(0, 3).map((l, i) => (
          <div key={l.c.id} className="lux-card p-5 text-center shadow-sm">
            <p className="text-4xl">{MEDALHAS[i]}</p>
            <p className="mt-2 text-lg font-bold">{l.c.nome}</p>
            <p className={`text-sm font-semibold ${tone(l.perf)}`}>{pct(l.perf)} da meta</p>
            <p className="mt-1 text-xs text-muted-foreground">{brl(l.real)} faturados · {brl(l.mediaDia)} por dia</p>
            <p className="mt-3 text-sm">{ELOGIO[i]}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {liderServ && <KpiMini rotulo="Referência em serviços" nome={liderServ.c.nome} valor={`${pct(liderServ.perfS)} da meta · ${brl(liderServ.servicos)}`} />}
        {liderPec && <KpiMini rotulo="Referência em peças" nome={liderPec.c.nome} valor={`${pct(liderPec.perfP)} da meta · ${brl(liderPec.pecas)}`} />}
        {melhor && melhor.valor > 0 && <KpiMini rotulo="Melhor dia do mês" nome={`dia ${melhor.dia}`} valor={`${brl(melhor.valor)} faturados`} />}
        {batem.length > 0 && <KpiMini rotulo="Já bateram a meta" nome={nomes(batem)} valor={`${batem.length} ${batem.length === 1 ? "consultor" : "consultores"}`} />}
      </div>

      <p className="rounded-lg border border-primary/40 bg-primary/5 p-4 text-sm">
        Nada deste resultado acontece sozinho. Ele é feito por quem atendeu, orçou, ligou de novo e fechou.
        Obrigado a cada um que fez o mês de {mes} andar — e parabéns a quem está fazendo acontecer.
      </p>
    </div>
  );
}

function KpiMini({ rotulo, nome, valor }: { rotulo: string; nome: string; valor: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{rotulo}</p>
      <p className="mt-1 font-semibold">{nome}</p>
      <p className="text-sm text-muted-foreground">{valor}</p>
    </div>
  );
}
